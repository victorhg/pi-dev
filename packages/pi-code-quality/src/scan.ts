/**
 * Scan orchestration (Phase 3 core): detect languages, run the external
 * tools, normalize, score, and assemble a MetricReport. Decoupled from the
 * ExtensionAPI so it is testable via injected exec/which/readFile.
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import type { ExecFn, WhichFn, RunOptions } from "./runners.js";
import {
  runTool,
  resolveToolCommand,
  TOOL_SPECS,
  defaultWhich,
} from "./runners.js";
import { detectLanguages, isAislopScoreable, LIZARD_LANGUAGE_FLAGS, type Language } from "./languages.js";
import type { ParseResult, LizardFunction } from "./normalize.js";
import {
  parseLizardCsv,
  parseJscpdJson,
  parseAislopJson,
  parseSemgrepJson,
  parseGitleaksJson,
} from "./normalize.js";
import {
  computeSpaghettiFactor,
  worstSpaghetti,
  METRIC_SCORERS,
  aggregateScores,
  evaluateGate,
  type SpaghettiResult,
} from "./score.js";
import type { MetricId, MetricReport, MetricScore, ScanConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./schema.js";
import { slugify } from "./report.js";

export interface ScanDeps {
  exec: ExecFn;
  which?: WhichFn;
  readFile?: (path: string) => Promise<string>;
  tmpDir?: () => string;
}

export interface ScanOptions {
  /** Path to scan, relative to cwd. */
  target: string;
  /** Working directory for tool execution. */
  cwd: string;
  config?: ScanConfig;
}

const LIZARD_EXCLUDES = ["*/node_modules/*", "*/dist/*", "*/build/*", "*/coverage/*", "*/.git/*"];

function mergedConfig(config?: ScanConfig): ScanConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    weights: { ...DEFAULT_CONFIG.weights, ...(config?.weights ?? {}) },
  };
}

// ── File listing (for language detection) ────────────────────────────────────

export async function listProjectFiles(exec: ExecFn, cwd: string): Promise<string[]> {
  const git = await exec("git", ["ls-files", "-z"], { cwd });
  if (git.code === 0 && git.stdout) {
    return git.stdout.split("\0").filter(Boolean);
  }

  const find = await exec(
    "find",
    [".", "-type", "f", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*"],
    { cwd },
  );
  if (find.code === 0) {
    return find.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  return [];
}

// ── Metric result constructors ───────────────────────────────────────────────

function missingMetric(metric: MetricId, reason: string): MetricScore {
  return { metric, score: 0, status: "unavailable", findings: [], detail: { unavailableReason: reason } };
}

function erroredMetric(metric: MetricId, err: unknown): MetricScore {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    metric,
    score: 0,
    status: "unavailable",
    findings: [],
    detail: { unavailableReason: `tool error: ${msg}` },
  };
}

// ── Spaghetti factor from lizard functions ───────────────────────────────────

export interface FileSpaghetti extends SpaghettiResult {
  file: string;
}

/**
 * Aggregate per-function lizard data into per-file Spaghetti Factors.
 * SCC ≈ sum of function cyclomatic complexity; SLOC = sum of nloc.
 * `globals` defaults to 0 in v1 (language-ambiguous), documented approximation.
 */
export function computeFileSpaghetti(functions: LizardFunction[], globals = 0): FileSpaghetti[] {
  const byFile = new Map<string, LizardFunction[]>();
  for (const f of functions) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  const results: FileSpaghetti[] = [];
  for (const [file, fns] of byFile) {
    const scc = fns.reduce((sum, f) => sum + f.cyclomaticComplexity, 0);
    const sloc = fns.reduce((sum, f) => sum + f.nloc, 0);
    results.push({ ...computeSpaghettiFactor(scc, globals, sloc), file });
  }
  return results.sort((a, b) => b.value - a.value);
}

// ── Per-tool runners ─────────────────────────────────────────────────────────

function lizardArgs(languages: Language[]): string[] {
  const args = ["--csv", "-V"];
  for (const lang of languages) {
    const flag = LIZARD_LANGUAGE_FLAGS[lang];
    if (flag) args.push("-l", flag);
  }
  for (const exclude of LIZARD_EXCLUDES) args.push("-x", exclude);
  return args;
}

/** Complexity and spaghetti share a single lizard run. */
async function runLizard(
  deps: ScanDeps,
  cwd: string,
  target: string,
  languages: Language[],
  config: ScanConfig,
): Promise<{ complexity: MetricScore; spaghetti: MetricScore }> {
  const cmd = resolveToolCommand(TOOL_SPECS.complexity, deps.which ?? defaultWhich);
  if (!cmd) {
    return {
      complexity: missingMetric("complexity", "lizard not installed"),
      spaghetti: missingMetric("spaghetti", "lizard not installed"),
    };
  }

  try {
    const res = await runTool(deps.exec, cmd[0], [...cmd.slice(1), ...lizardArgs(languages), target], {
      cwd,
      allowExitCodes: [0, 1],
    });

    const parsed = parseLizardCsv(res.stdout, { complexityThreshold: config.complexityThreshold });
    const complexity = METRIC_SCORERS.complexity(parsed);

    const functions = (parsed.detail.functions ?? []) as LizardFunction[];
    const fileSfs = computeFileSpaghetti(functions);
    const worst = worstSpaghetti(fileSfs);
    const spaghetti = worst
      ? METRIC_SCORERS.spaghetti({
          findings: [],
          detail: {
            spaghettiFactor: worst.value,
            spaghettiBand: worst.band,
            perFileSpaghetti: fileSfs,
            globals: 0,
          },
        })
      : missingMetric("spaghetti", "no functions analyzed");

    return { complexity, spaghetti };
  } catch (err) {
    return {
      complexity: erroredMetric("complexity", err),
      spaghetti: erroredMetric("spaghetti", err),
    };
  }
}

/** jscpd writes its JSON report to a file, hence the temp-dir dance. */
async function runJscpd(deps: ScanDeps, cwd: string, target: string): Promise<MetricScore> {
  const cmd = resolveToolCommand(TOOL_SPECS.duplication, deps.which ?? defaultWhich);
  if (!cmd) return missingMetric("duplication", "jscpd not installed");

  const outDir = (deps.tmpDir ?? defaultTmpDir)();
  const resultFile = join(outDir, "jscpd-report.json");

  try {
    const res = await runTool(deps.exec, cmd[0], [...cmd.slice(1), target, "--reporters", "json", "--output", outDir, "--silent", "--ignore", "**/node_modules/**"], {
      cwd,
      resultFile,
      readFile: deps.readFile,
    });
    return METRIC_SCORERS.duplication(parseJscpdJson(res.stdout));
  } catch (err) {
    return erroredMetric("duplication", err);
  } finally {
    await cleanupDir(outDir).catch(() => {});
  }
}

function defaultTmpDir(): string {
  return join(tmpdir(), `pi-code-quality-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function cleanupDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup only
  }
}

/** Generic runner for metrics with one tool, one parse, one score. */
async function runOne(
  deps: ScanDeps,
  metric: MetricId,
  cwd: string,
  target: string,
  argsFor: (target: string) => string[],
  runOptions: RunOptions,
  normalize: (stdout: string) => ParseResult,
): Promise<MetricScore> {
  const cmd = resolveToolCommand(TOOL_SPECS[metric], deps.which ?? defaultWhich);
  if (!cmd) return missingMetric(metric, `${TOOL_SPECS[metric].candidates[0][0]} not installed`);

  try {
    const res = await runTool(deps.exec, cmd[0], [...cmd.slice(1), ...argsFor(target)], {
      cwd,
      ...runOptions,
    });
    return METRIC_SCORERS[metric](normalize(res.stdout));
  } catch (err) {
    return erroredMetric(metric, err);
  }
}

// ── Full scan ────────────────────────────────────────────────────────────────

export async function runScan(deps: ScanDeps, options: ScanOptions): Promise<MetricReport> {
  const { target, cwd } = options;
  const config = mergedConfig(options.config);

  const files = await listProjectFiles(deps.exec, cwd);
  const languages = detectLanguages(files);

  const scores: Partial<Record<MetricId, MetricScore>> = {};

  const lizard = await runLizard(deps, cwd, target, languages, config);
  scores.complexity = lizard.complexity;
  scores.spaghetti = lizard.spaghetti;

  scores.duplication = await runJscpd(deps, cwd, target);

  scores.security = await runOne(
    deps,
    "security",
    cwd,
    target,
    (t) => ["scan", "--json", "--config", "auto", "--quiet", t],
    { allowExitCodes: [0, 1], timeout: 120_000 },
    parseSemgrepJson,
  );

  scores.secrets = await runOne(
    deps,
    "secrets",
    cwd,
    target,
    (t) => ["detect", "--report-format", "json", "--no-git", "--redact", "--source", t],
    { allowExitCodes: [0, 1] },
    parseGitleaksJson,
  );

  scores.slop =
    languages.length === 0 || !isAislopScoreable(languages)
      ? missingMetric("slop", "aislop does not support the detected languages")
      : await runOne(
          deps,
          "slop",
          cwd,
          target,
          (t) => ["scan", "--json", t],
          { allowExitCodes: [0] },
          parseAislopJson,
        );

  const overall = aggregateScores(scores, config.weights);
  const gate = config.failBelow != null ? evaluateGate(overall, config.failBelow) : undefined;

  return {
    target,
    scores: scores as Record<MetricId, MetricScore>,
    overall,
    createdAt: new Date().toISOString(),
    slug: slugify(target),
    gate,
  };
}
