/**
 * Shared types and constants for the code quality metrics extension.
 *
 * The MetricReport is the single contract between runners/normalizers,
 * scoring/aggregation, and rendering (TUI + Markdown report).
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type MetricId =
  | "complexity"
  | "duplication"
  | "spaghetti"
  | "security"
  | "secrets"
  | "slop";

export const METRIC_IDS: MetricId[] = [
  "complexity",
  "duplication",
  "spaghetti",
  "security",
  "secrets",
  "slop",
];

export interface Finding {
  /** Which metric produced this finding. */
  metric: MetricId;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  /** Tool-specific rule id (e.g. "ai-slop/narrative-comment"). */
  ruleId?: string;
  /** Human-readable direction on how to fix the finding. */
  remediation?: string;
  /** Raw extra data from the underlying tool. */
  meta?: Record<string, unknown>;
}

export type MetricStatus = "ok" | "warning" | "error" | "unavailable";

export interface MetricScore {
  metric: MetricId;
  /** 0–100. */
  score: number;
  status: MetricStatus;
  findings: Finding[];
  /** Optional per-metric extra data (e.g. duplication %, max cyclomatic). */
  detail?: Record<string, unknown>;
}

export interface GateResult {
  failBelow: number;
  passed: boolean;
}

export interface MetricReport {
  target: string;
  scores: Record<MetricId, MetricScore>;
  /** Weighted aggregate, 0–100. Null when no metric produced a score. */
  overall: number | null;
  createdAt: string;
  slug: string;
  gate?: GateResult;
}

export interface ScanConfig {
  /** Metric weights for the aggregate score. Should sum to 100. */
  weights: Record<MetricId, number>;
  /** Below this overall score the gate fails (CI mode). */
  failBelow?: number;
  /** Cyclomatic complexity flag threshold (functions above this become findings). */
  complexityThreshold?: number;
  /** Optional tool binary overrides per metric. */
  tools?: Partial<Record<MetricId, string>>;
  /**
   * Additional gitignore-style glob patterns to skip (additive to
   * DEFAULT_EXCLUDES). Used by jscpd, aislop, semgrep, and lizard.
   */
  exclude?: string[];
}

/**
 * Default noise exclusions applied to every scan: build artifacts, lockfiles,
 * test/spec files, fixtures, snapshots, and generated code.
 */
export const DEFAULT_EXCLUDES: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
  "**/vendor/**",
  "**/out/**",
  "**/.next/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.d.ts",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.js",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/fixtures/**",
  "**/__fixtures__/**",
  "**/*.snap",
  "**/*.generated.*",
];

export const DEFAULT_WEIGHTS: Record<MetricId, number> = {
  complexity: 25,
  duplication: 20,
  spaghetti: 20,
  security: 15,
  secrets: 10,
  slop: 10,
};

export const DEFAULT_CONFIG: ScanConfig = {
  weights: { ...DEFAULT_WEIGHTS },
  failBelow: 70,
  complexityThreshold: 10,
  exclude: [],
};
