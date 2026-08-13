/**
 * Scoring & aggregation (Phase 2).
 *
 * Pure functions that turn normalized tool output (`ParseResult`) into 0–100
 * per-metric scores, compute the Koopman Spaghetti Factor, aggregate a
 * weighted maintainability score, and evaluate a pass/fail gate.
 */

import type { MetricId, MetricScore, MetricStatus, Severity } from "./schema.js";
import { METRIC_IDS } from "./schema.js";
import type { ParseResult } from "./normalize.js";

// ── Shared helpers ───────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function statusForScore(score: number): MetricStatus {
  if (score >= 80) return "ok";
  if (score >= 60) return "warning";
  return "error";
}

/** Severity → point deduction. Mirrors pi-sec-quality's penalty model. */
export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 30,
  high: 15,
  medium: 8,
  low: 3,
  info: 1,
};

function parseFailed(input: ParseResult): boolean {
  return input.detail.parseError === true;
}

function unavailable(input: ParseResult, metric: MetricId, reason: string): MetricScore {
  return {
    metric,
    score: 0,
    status: "unavailable",
    findings: input.findings,
    detail: { ...input.detail, unavailableReason: reason },
  };
}

// ── Spaghetti Factor ─────────────────────────────────────────────────────────

export type SpaghettiBand =
  | "sweet-spot"
  | "ok"
  | "review"
  | "refactor"
  | "untestable"
  | "unmaintainable"
  | "nightmare";

export interface SpaghettiResult {
  /** SF = SCC + (Globals × 5) + (SLOC / 20). */
  value: number;
  scc: number;
  globals: number;
  sloc: number;
  band: SpaghettiBand;
}

/** Koopman's SF scoring bands (see research doc for the full table). */
export function spaghettiBand(value: number): SpaghettiBand {
  if (value <= 10) return "sweet-spot";
  if (value <= 15) return "ok";
  if (value <= 20) return "review";
  if (value <= 30) return "refactor";
  if (value <= 50) return "untestable";
  if (value <= 75) return "unmaintainable";
  return "nightmare";
}

/** Compute the Spaghetti Factor from strict cyclomatic complexity, globals, and SLOC. */
export function computeSpaghettiFactor(scc: number, globals: number, sloc: number): SpaghettiResult {
  const value = scc + globals * 5 + sloc / 20;
  return { value, scc, globals, sloc, band: spaghettiBand(value) };
}

/** Map an SF value to a 0–100 score (≤10 → 100, ≥50 → 0, linear between). */
export function scoreSpaghetti(sfValue: number): number {
  if (sfValue <= 10) return 100;
  if (sfValue >= 50) return 0;
  return Math.round(clamp(100 - (sfValue - 10) * 2.5, 0, 100));
}

/** The worst (highest SF) module gates project maintainability. */
export function worstSpaghetti(factors: SpaghettiResult[]): SpaghettiResult | null {
  if (factors.length === 0) return null;
  return factors.reduce((worst, f) => (f.value > worst.value ? f : worst));
}

// ── Per-metric scorers ───────────────────────────────────────────────────────

export type MetricScorer = (input: ParseResult) => MetricScore;

/**
 * Complexity: penalize the fraction of functions over threshold, plus how far
 * the worst function exceeds it.
 */
export function scoreComplexity(input: ParseResult): MetricScore {
  const total = typeof input.detail.functionsScanned === "number" ? input.detail.functionsScanned : 0;
  if (total === 0) return unavailable(input, "complexity", "no functions analyzed");

  const threshold = typeof input.detail.threshold === "number" ? input.detail.threshold : 15;
  const over = typeof input.detail.overThreshold === "number" ? input.detail.overThreshold : 0;
  const max = typeof input.detail.maxCyclomatic === "number" ? input.detail.maxCyclomatic : 0;

  const fractionPenalty = (over / total) * 50;
  const maxPenalty =
    max > threshold ? Math.min(50, ((max - threshold) / threshold) * 25) : 0;

  const score = clamp(Math.round(100 - fractionPenalty - maxPenalty), 0, 100);
  return {
    metric: "complexity",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: { ...input.detail, fractionPenalty, maxPenalty },
  };
}

/** Duplication: 100 − duplication percentage. */
export function scoreDuplication(input: ParseResult): MetricScore {
  const pct = input.detail.duplicationPercent;
  if (parseFailed(input) || typeof pct !== "number") {
    return unavailable(input, "duplication", "no duplication percentage");
  }
  const score = clamp(Math.round(100 - pct), 0, 100);
  return {
    metric: "duplication",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: input.detail,
  };
}

/** Spaghetti: score a precomputed SF value present in the parse detail. */
export function scoreSpaghettiFromDetail(input: ParseResult): MetricScore {
  const sf = input.detail.spaghettiFactor;
  if (typeof sf !== "number") {
    return unavailable(input, "spaghetti", "no spaghetti factor computed");
  }
  const score = scoreSpaghetti(sf);
  return {
    metric: "spaghetti",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: { ...input.detail, spaghettiScore: score },
  };
}

/** Security: deduct severity-weighted points per finding. */
export function scoreSecurity(input: ParseResult): MetricScore {
  if (parseFailed(input)) return unavailable(input, "security", "unparseable output");

  let penalty = 0;
  for (const f of input.findings) penalty += SEVERITY_PENALTY[f.severity] ?? 1;

  const score = clamp(Math.round(100 - penalty), 0, 100);
  return {
    metric: "security",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: { ...input.detail, penalty },
  };
}

/** Secrets: any exposed secret is serious; deduct 25 points each. */
export function scoreSecrets(input: ParseResult): MetricScore {
  if (parseFailed(input)) return unavailable(input, "secrets", "unparseable output");

  const count = input.findings.length;
  const score = clamp(100 - 25 * count, 0, 100);
  return {
    metric: "secrets",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: { ...input.detail, leakCount: count },
  };
}

/** Slop: adopt aislop's own 0–100 score when it is scoreable. */
export function scoreSlop(input: ParseResult): MetricScore {
  const s = input.detail.score;
  if (typeof s !== "number") {
    return unavailable(input, "slop", "not scoreable (unsupported language)");
  }
  const score = clamp(Math.round(s), 0, 100);
  return {
    metric: "slop",
    score,
    status: statusForScore(score),
    findings: input.findings,
    detail: input.detail,
  };
}

export const METRIC_SCORERS: Record<MetricId, MetricScorer> = {
  complexity: scoreComplexity,
  duplication: scoreDuplication,
  spaghetti: scoreSpaghettiFromDetail,
  security: scoreSecurity,
  secrets: scoreSecrets,
  slop: scoreSlop,
};

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Weighted aggregate over available metrics. Metrics with status
 * "unavailable" are excluded and the remaining weights renormalized.
 * Returns null when nothing is scoreable.
 */
export function aggregateScores(
  scores: Partial<Record<MetricId, MetricScore>>,
  weights: Record<MetricId, number>,
): number | null {
  let weightedSum = 0;
  let weightSum = 0;

  for (const id of METRIC_IDS) {
    const metric = scores[id];
    if (!metric) continue;
    if (metric.status === "unavailable") continue;
    const weight = weights[id] ?? 0;
    if (weight <= 0) continue;
    weightedSum += metric.score * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return null;
  return Math.round(clamp(weightedSum / weightSum, 0, 100));
}

// ── Gate ─────────────────────────────────────────────────────────────────────

/** Evaluate the pass/fail gate. Returns undefined when there is no score. */
export function evaluateGate(
  overall: number | null,
  failBelow: number,
): { failBelow: number; passed: boolean } | undefined {
  if (overall == null) return undefined;
  return { failBelow, passed: overall >= failBelow };
}
