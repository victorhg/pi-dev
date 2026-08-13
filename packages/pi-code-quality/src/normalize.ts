/**
 * Normalizers: convert each tool's raw output into a common `ParseResult`
 * (findings + scoring detail). All functions are pure and defensive — they
 * tolerate malformed input and unknown fields without throwing.
 */

import type { Finding, Severity } from "./schema.js";

export interface ParseResult {
  findings: Finding[];
  /** Metric-specific data used later by scoring (Phase 2). */
  detail: Record<string, unknown>;
}

// ── Generic helpers ──────────────────────────────────────────────────────────

/** Map tool severity strings (semgrep, aislop) onto our Severity scale. */
export function mapToolSeverity(raw: unknown): Severity {
  const s = String(raw ?? "").toLowerCase();
  switch (s) {
    case "error":
    case "critical":
      return "high";
    case "warning":
    case "warn":
      return "medium";
    case "info":
    case "note":
    case "low":
      return "low";
    default:
      return "info";
  }
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function getPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function toInt(v: unknown): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function unquote(v: unknown): string {
  let s = String(v ?? "").trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}

function countBySeverity(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ── lizard (cyclomatic complexity, CSV) ─────────────────────────────────────

export interface LizardFunction {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  cyclomaticComplexity: number;
  nloc: number;
  parameterCount: number;
  tokenCount: number;
}

function isLizardHeader(row: string[]): boolean {
  return row[0]?.trim().toLowerCase() === "nloc" && row[1]?.trim().toLowerCase() === "ccn";
}

function parseLizardRow(row: string[]): LizardFunction | null {
  if (row.length < 11) return null;
  const file = unquote(row[6]);
  const name = unquote(row[7]);
  if (!file || !name) return null;
  return {
    name,
    file,
    startLine: toInt(row[9]),
    endLine: toInt(row[10]),
    cyclomaticComplexity: toInt(row[1]),
    nloc: toInt(row[0]),
    parameterCount: toInt(row[3]),
    tokenCount: toInt(row[2]),
  };
}

function severityForCc(cc: number, threshold: number): Severity {
  if (cc >= threshold * 3) return "critical";
  if (cc >= threshold * 2) return "high";
  if (cc >= threshold * 1.5) return "medium";
  return "low";
}

/** Parse `lizard --csv -V` output into complexity findings. */
export function parseLizardCsv(csv: string, options?: { complexityThreshold?: number }): ParseResult {
  const threshold = options?.complexityThreshold ?? 15;
  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) {
    return { findings: [], detail: { functionsScanned: 0, maxCyclomatic: 0, overThreshold: 0, threshold } };
  }

  const dataRows = isLizardHeader(rows[0]) ? rows.slice(1) : rows;
  const functions: LizardFunction[] = [];
  for (const row of dataRows) {
    const fn = parseLizardRow(row);
    if (fn) functions.push(fn);
  }

  const findings: Finding[] = [];
  for (const fn of functions) {
    if (fn.cyclomaticComplexity > threshold) {
      findings.push({
        metric: "complexity",
        severity: severityForCc(fn.cyclomaticComplexity, threshold),
        message: `${fn.name} has cyclomatic complexity ${fn.cyclomaticComplexity} (threshold ${threshold})`,
        file: fn.file,
        line: fn.startLine,
        ruleId: "lizard/cyclomatic-complexity",
      });
    }
  }

  const maxCyclomatic = functions.reduce((max, f) => Math.max(max, f.cyclomaticComplexity), 0);

  return {
    findings,
    detail: {
      functionsScanned: functions.length,
      maxCyclomatic,
      overThreshold: findings.length,
      threshold,
      functions,
    },
  };
}

// ── jscpd (duplication, JSON) ───────────────────────────────────────────────

/** Parse jscpd JSON reporter output into duplication findings. */
export function parseJscpdJson(raw: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { findings: [], detail: { parseError: true } };
  }

  const stats = getPath(data, ["statistics", "total"]) as Record<string, unknown> | undefined;
  const percentage = typeof stats?.percentage === "number" ? stats.percentage : undefined;
  const clones = asArray(getPath(data, ["duplicates"]));

  const findings: Finding[] = [];
  for (const clone of clones) {
    const c = clone as any;
    const a = c?.firstFile;
    const b = c?.secondFile;
    findings.push({
      metric: "duplication",
      severity: "medium",
      message: `Duplicated block (${c?.lines ?? 0} lines) between ${a?.name ?? "?"} and ${b?.name ?? "?"}`,
      file: a?.name,
      line: typeof a?.start === "number" ? a.start : undefined,
      ruleId: "jscpd/clone",
      meta: {
        secondFile: b?.name,
        secondStart: typeof b?.start === "number" ? b.start : undefined,
        lines: c?.lines,
        tokens: c?.tokens,
        format: c?.format,
      },
    });
  }

  return {
    findings,
    detail: {
      duplicationPercent: percentage,
      clonesCount: clones.length,
      duplicatedLines: stats?.duplicatedLines,
      totalLines: stats?.lines,
      totalSources: stats?.sources,
    },
  };
}

// ── aislop (anti code-slop, JSON) ───────────────────────────────────────────

/** Parse `aislop scan --json` output into slop findings + score. */
export function parseAislopJson(raw: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { findings: [], detail: { parseError: true } };
  }

  const diagnostics = asArray(data?.diagnostics);
  const findings: Finding[] = diagnostics.map((d: any) => ({
    metric: "slop" as const,
    severity: mapToolSeverity(d?.severity),
    message: typeof d?.message === "string" ? d.message : "",
    file: typeof d?.filePath === "string" ? d.filePath : undefined,
    line: typeof d?.line === "number" ? d.line : undefined,
    ruleId: typeof d?.rule === "string" ? d.rule : undefined,
    meta: {
      engine: d?.engine,
      category: d?.category,
      fixable: d?.fixable,
      help: d?.help,
    },
  }));

  return {
    findings,
    detail: {
      score: typeof data?.score === "number" ? data.score : null,
      scoreable: data?.scoreable === true,
      label: data?.label,
      errors: data?.summary?.errors,
      warnings: data?.summary?.warnings,
      files: data?.summary?.files,
      engines: data?.engines,
    },
  };
}

// ── semgrep (security, JSON) ────────────────────────────────────────────────

/** Parse `semgrep --json` output into security findings. */
export function parseSemgrepJson(raw: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { findings: [], detail: { parseError: true } };
  }

  const results = asArray(data?.results);
  const findings: Finding[] = results.map((r: any) => ({
    metric: "security" as const,
    severity: mapToolSeverity(r?.extra?.severity),
    message:
      typeof r?.extra?.message === "string" ? r.extra.message : String(r?.check_id ?? "Security finding"),
    file: typeof r?.path === "string" ? r.path : undefined,
    line: typeof r?.start?.line === "number" ? r.start.line : undefined,
    ruleId: typeof r?.check_id === "string" ? r.check_id : undefined,
    meta: {
      cwe: r?.extra?.metadata?.cwe,
      category: r?.extra?.metadata?.category,
      code: r?.extra?.lines,
    },
  }));

  return {
    findings,
    detail: {
      total: results.length,
      errors: asArray(data?.errors).length,
      bySeverity: countBySeverity(findings),
    },
  };
}

// ── gitleaks (secrets, JSON) ────────────────────────────────────────────────

/** Parse `gitleaks detect --report-format json` output into secret findings. */
export function parseGitleaksJson(raw: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { findings: [], detail: { parseError: true } };
  }

  const leaks = asArray(data);
  const findings: Finding[] = leaks.map((l: any) => ({
    metric: "secrets" as const,
    severity: "high" as const,
    message:
      typeof l?.Description === "string" ? l.Description : String(l?.RuleID ?? "Exposed secret"),
    file: typeof l?.File === "string" ? l.File : undefined,
    line: typeof l?.StartLine === "number" ? l.StartLine : undefined,
    ruleId: typeof l?.RuleID === "string" ? l.RuleID : undefined,
    meta: {
      commit: l?.Commit,
      entropy: l?.Entropy,
      tags: l?.Tags,
      author: l?.Author,
    },
  }));

  const ruleIds = new Set(findings.map((f) => f.ruleId).filter(Boolean));
  return {
    findings,
    detail: {
      leakCount: findings.length,
      rules: [...ruleIds],
    },
  };
}
