/**
 * Report rendering (Phase 3 support): slugs, scorecard text, and Markdown
 * report generation. Pure and testable.
 */

import type { Finding, MetricId, MetricReport, MetricStatus } from "./schema.js";
import { METRIC_IDS } from "./schema.js";

export const METRIC_LABELS: Record<MetricId, string> = {
  complexity: "Complexity",
  duplication: "Duplication",
  spaghetti: "Spaghetti Factor",
  security: "Security",
  secrets: "Secrets",
  slop: "Code Slop",
};

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "code-quality"
  );
}

export function reportPath(slug: string): string {
  return `quality/${slug}-report.md`;
}

export function scoreEmoji(status: MetricStatus, score: number): string {
  if (status === "unavailable") return "—";
  if (score >= 80) return "✅";
  if (score >= 60) return "⚠️";
  return "❌";
}

function formatMetric(metric: MetricReport["scores"][MetricId]): string {
  const label = METRIC_LABELS[metric.metric];
  if (metric.status === "unavailable") {
    const reason =
      typeof metric.detail?.unavailableReason === "string" && metric.detail.unavailableReason
        ? ` (${metric.detail.unavailableReason})`
        : "";
    return `${scoreEmoji(metric.status, metric.score)} ${label}: unavailable${reason}`;
  }
  const findings =
    metric.findings.length > 0 ? ` · ${metric.findings.length} finding${metric.findings.length === 1 ? "" : "s"}` : "";
  return `${scoreEmoji(metric.status, metric.score)} ${label}: ${metric.score}/100${findings}`;
}

/** Compact single-paragraph scorecard shown to the LLM and in the TUI. */
export function renderScorecardText(report: MetricReport): string {
  const overall = report.overall == null ? "n/a" : `${report.overall}/100`;
  const lines = [`Code Quality: ${overall} — ${report.target}`];
  for (const id of METRIC_IDS) {
    lines.push(`  ${formatMetric(report.scores[id])}`);
  }
  if (report.gate) {
    lines.push(`  Gate: ${report.gate.passed ? "✅ PASS" : "❌ FAIL"} (threshold ${report.gate.failBelow})`);
  }
  return lines.join("\n");
}

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** All findings flattened and sorted by severity (most severe first). */
export function severitySortedFindings(report: MetricReport): Finding[] {
  return METRIC_IDS.flatMap((id) => report.scores[id].findings).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/** Render findings with severity, location, and remediation direction. */
export function renderFindingsList(findings: Finding[]): string {
  return findings
    .map((f) => {
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "n/a";
      const fix = f.remediation ? ` → fix: ${f.remediation}` : "";
      return `- [${f.severity}] ${METRIC_LABELS[f.metric]}: ${f.message} (${loc})${fix}`;
    })
    .join("\n");
}

/** Top findings across all metrics, for LLM consumption. */
export function renderFindingsSummary(report: MetricReport, limit = 10): string {
  const top = severitySortedFindings(report).slice(0, limit);
  if (top.length === 0) return "No findings.";
  return renderFindingsList(top);
}

/** Lightweight, session-safe card data for the persistent TUI entry. */
export interface ReportCard {
  target: string;
  overall: number | null;
  createdAt: string;
  metrics: Array<{ id: MetricId; score: number; status: MetricStatus; findingsCount: number }>;
  findings: Finding[];
}

export function buildReportCard(report: MetricReport, maxFindings = 30): ReportCard {
  return {
    target: report.target,
    overall: report.overall,
    createdAt: report.createdAt,
    metrics: METRIC_IDS.map((id) => {
      const m = report.scores[id];
      return { id, score: m.score, status: m.status, findingsCount: m.findings.length };
    }),
    findings: severitySortedFindings(report).slice(0, maxFindings),
  };
}

/** Full Markdown report saved to `quality/<slug>-report.md`. */
export function renderMarkdownReport(report: MetricReport): string {
  const overall = report.overall == null ? "n/a" : `${report.overall}/100`;
  const lines: string[] = [
    `# Code Quality Report: ${report.target}`,
    "",
    `> **Generated:** ${report.createdAt}`,
    `> **Overall Score:** ${overall}`,
    "",
    "## Score Breakdown",
    "",
  ];

  for (const id of METRIC_IDS) {
    const metric = report.scores[id];
    if (metric.status === "unavailable") {
      const reason =
        typeof metric.detail?.unavailableReason === "string" && metric.detail.unavailableReason
          ? ` (${metric.detail.unavailableReason})`
          : "";
      lines.push(`- **${METRIC_LABELS[id]}:** unavailable${reason}`);
    } else {
      lines.push(`- **${METRIC_LABELS[id]}:** ${metric.score}/100 (${metric.findings.length} findings)`);
    }
  }

  lines.push("", "## Findings", "");

  let anyFindings = false;
  for (const id of METRIC_IDS) {
    const metric = report.scores[id];
    if (metric.findings.length === 0) continue;
    anyFindings = true;
    lines.push(`### ${METRIC_LABELS[id]}`, "");
    for (const f of metric.findings) {
      const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : "";
      const rule = f.ruleId ? `[${f.ruleId}] ` : "";
      const fix = f.remediation ? ` — *fix:* ${f.remediation}` : "";
      lines.push(`- **${f.severity}** ${rule}${f.message}${loc}${fix}`);
    }
    lines.push("");
  }

  if (!anyFindings) {
    lines.push("🎉 No findings.", "");
  }

  lines.push("---", "", "*Generated by @victorhg/pi-code-quality*");
  return lines.join("\n");
}
