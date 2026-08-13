import { describe, it, expect } from "vitest";
import {
  slugify,
  reportPath,
  scoreEmoji,
  renderScorecardText,
  renderFindingsSummary,
  renderMarkdownReport,
} from "./report.js";
import type { MetricReport, MetricScore, MetricId } from "./schema.js";
import { METRIC_IDS } from "./schema.js";

function score(metric: MetricId, value: number, findings = 0): MetricScore {
  return {
    metric,
    score: value,
    status: value >= 80 ? "ok" : value >= 60 ? "warning" : "error",
    findings: Array.from({ length: findings }, (_, i) => ({
      metric,
      severity: "medium" as const,
      message: `${metric} finding ${i + 1}`,
      file: `src/file-${i + 1}.ts`,
      line: i + 1,
      ruleId: `rule-${i + 1}`,
    })),
    detail: {},
  };
}

function makeReport(overrides: Partial<MetricReport> = {}): MetricReport {
  const scores = Object.fromEntries(METRIC_IDS.map((id) => [id, score(id, 85)])) as Record<MetricId, MetricScore>;
  return {
    target: "src",
    scores,
    overall: 85,
    createdAt: "2026-08-12T00:00:00.000Z",
    slug: "src",
    gate: { failBelow: 70, passed: true },
    ...overrides,
  };
}

describe("slugify", () => {
  it("converts targets to URL-safe slugs", () => {
    expect(slugify("src/My App")).toBe("src-my-app");
    expect(slugify("   ")).toBe("code-quality");
    expect(slugify("")).toBe("code-quality");
  });
});

describe("reportPath", () => {
  it("formats the report path", () => {
    expect(reportPath("src")).toBe("quality/src-report.md");
  });
});

describe("scoreEmoji", () => {
  it("maps status and score to an emoji", () => {
    expect(scoreEmoji("ok", 90)).toBe("✅");
    expect(scoreEmoji("warning", 70)).toBe("⚠️");
    expect(scoreEmoji("error", 30)).toBe("❌");
    expect(scoreEmoji("unavailable", 0)).toBe("—");
  });
});

describe("renderScorecardText", () => {
  it("lists the overall score and every metric", () => {
    const text = renderScorecardText(makeReport());
    expect(text).toContain("Code Quality: 85/100 — src");
    for (const label of ["Complexity", "Duplication", "Spaghetti Factor", "Security", "Secrets", "Code Slop"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Gate: ✅ PASS");
  });

  it("renders n/a for an unscoreable report", () => {
    const text = renderScorecardText(makeReport({ overall: null }));
    expect(text).toContain("Code Quality: n/a");
  });
});

describe("renderFindingsSummary", () => {
  it("sorts by severity and respects the limit", () => {
    const report = makeReport();
    const critical = {
      metric: "security" as const,
      severity: "critical" as const,
      message: "critical finding",
      file: "src/critical.ts",
      line: 1,
      ruleId: "c1",
    };
    const mediums = ["a", "b", "c", "d"].map((n, i) => ({
      metric: "slop" as const,
      severity: "medium" as const,
      message: `medium finding ${n}`,
      file: `src/m${i}.ts`,
      line: i + 1,
      ruleId: `m${i}`,
    }));
    report.scores.security.findings = [critical];
    report.scores.slop.findings = mediums;

    const summary = renderFindingsSummary(report, 3);
    expect(summary.split("\n")).toHaveLength(3);
    expect(summary).toContain("critical finding");
    expect(summary.indexOf("critical")).toBeLessThan(summary.indexOf("medium finding a"));
  });

  it("returns a friendly message when there are no findings", () => {
    const report = makeReport();
    for (const id of METRIC_IDS) report.scores[id].findings = [];
    expect(renderFindingsSummary(report)).toBe("No findings.");
  });
});

describe("renderMarkdownReport", () => {
  it("includes the header, score, and findings", () => {
    const report = makeReport();
    report.scores.security.findings = [
      {
        metric: "security",
        severity: "high",
        message: "Dangerous eval",
        file: "src/app.js",
        line: 20,
        ruleId: "detect-eval",
      },
    ];
    const md = renderMarkdownReport(report);
    expect(md).toContain("# Code Quality Report: src");
    expect(md).toContain("> **Overall Score:** 85/100");
    expect(md).toContain("### Security");
    expect(md).toContain("Dangerous eval");
    expect(md).toContain("(src/app.js:20)");
  });

  it("reports no findings cleanly", () => {
    const report = makeReport();
    for (const id of METRIC_IDS) report.scores[id].findings = [];
    expect(renderMarkdownReport(report)).toContain("🎉 No findings.");
  });
});
