/**
 * External-tool execution helpers.
 *
 * `pi.exec()` is the sanctioned way to run CLIs from an extension, but these
 * helpers are decoupled from the ExtensionAPI so they stay unit-testable via
 * injected `exec` / `which` functions.
 */

import { spawnSync } from "node:child_process";
import { readFile as fsReadFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { MetricId } from "./schema.js";

export interface RunOptions {
  signal?: AbortSignal;
  timeout?: number;
  cwd?: string;
  /**
   * When set and the command exits 0, read this file (relative to `cwd`)
   * and return its contents as `stdout`. Used by tools like jscpd whose JSON
   * reporter writes to a file instead of stdout.
   */
  resultFile?: string;
  /** Injectable file reader (test seam). Defaults to node:fs/promises readFile. */
  readFile?: (path: string) => Promise<string>;
  /**
   * Exit codes that are treated as success (default [0]). Detector tools
   * (lizard, semgrep, gitleaks, bandit) exit 1 when findings exist, which is
   * a successful run, not an error.
   */
  allowExitCodes?: number[];
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

export type ExecFn = (
  command: string,
  args: string[],
  options?: RunOptions,
) => Promise<ExecResult>;

export type WhichFn = (bin: string) => string | null;

/** Error thrown by runTool when a tool exits non-zero. */
export class ToolRunError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly stderr: string,
    public readonly command: string,
  ) {
    super(message);
    this.name = "ToolRunError";
  }
}

/**
 * Run an external tool, throwing `ToolRunError` on non-zero exit. When
 * `options.resultFile` is set, the file contents replace stdout on success.
 */
export async function runTool(
  exec: ExecFn,
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<ExecResult> {
  const result = await exec(command, args, options);

  const tolerated = options.allowExitCodes ?? [0];
  if (!tolerated.includes(result.code)) {
    throw new ToolRunError(
      `Tool "${command}" exited with code ${result.code}`,
      result.code,
      result.stderr,
      `${command} ${args.join(" ")}`,
    );
  }

  if (options.resultFile) {
    const readFile = options.readFile ?? defaultReadFile;
    const fullPath = isAbsolute(options.resultFile)
      ? options.resultFile
      : join(options.cwd ?? ".", options.resultFile);
    const content = await readFile(fullPath);
    return { ...result, stdout: content };
  }

  return result;
}

export async function defaultReadFile(path: string): Promise<string> {
  return fsReadFile(path, "utf8");
}

/** Check whether a binary resolves on PATH. Returns its path, or null. */
export function detectTool(bin: string, whichFn: WhichFn = defaultWhich): string | null {
  return whichFn(bin);
}

/** Default `which` via the system binary. */
export function defaultWhich(bin: string): string | null {
  const res = spawnSync("which", [bin], { encoding: "utf8" });
  if (res.status !== 0) return null;
  const first = res.stdout
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return first ?? null;
}

/**
 * A tool's ordered invocation candidates. Each candidate is a full argv
 * array; the first whose executable resolves wins. Fallbacks use package
 * runners (npx / pipx) so tools can be run ad hoc without global installs.
 */
export interface ToolSpec {
  metric: MetricId;
  candidates: string[][];
}

export const TOOL_SPECS: Record<MetricId, ToolSpec> = {
  complexity: {
    metric: "complexity",
    candidates: [
      ["lizard"],
      ["pipx", "run", "lizard"],
    ],
  },
  spaghetti: {
    metric: "spaghetti",
    candidates: [
      ["lizard"],
      ["pipx", "run", "lizard"],
    ],
  },
  duplication: {
    metric: "duplication",
    candidates: [
      ["jscpd"],
      ["npx", "--yes", "jscpd"],
    ],
  },
  security: {
    metric: "security",
    candidates: [
      ["semgrep"],
      ["pipx", "run", "semgrep"],
      ["bandit"],
      ["pipx", "run", "bandit"],
    ],
  },
  secrets: {
    metric: "secrets",
    candidates: [["gitleaks"]],
  },
  slop: {
    metric: "slop",
    candidates: [
      ["aislop"],
      ["npx", "--yes", "aislop"],
      ["pipx", "run", "aislop"],
    ],
  },
};

/**
 * Resolve the first available argv for a metric's tool spec, or null if none
 * of its candidates is available.
 */
export function resolveToolCommand(
  spec: ToolSpec,
  whichFn: WhichFn = defaultWhich,
): string[] | null {
  for (const candidate of spec.candidates) {
    if (detectTool(candidate[0], whichFn)) return candidate;
  }
  return null;
}
