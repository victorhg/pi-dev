import { describe, it, expect } from "vitest";
import {
  slugify,
  auditPath,
  evaluateContent,
  calculateScores,
  renderMarkdownReport,
  makeCleanSession,
} from "./index.js";
import type { WebAuditResult, WebViolation } from "./index.js";

describe("slugify", () => {
  it("converts target names to URL-safe slugs", () => {
    expect(slugify("Header Component")).toBe("header-component");
    expect(slugify("Landing Page (v2)")).toBe("landing-page-v2");
    expect(slugify("   ")).toBe("web-audit");
  });
});

describe("auditPath", () => {
  it("formats audit report paths correctly", () => {
    expect(auditPath("header-component")).toBe("web-quality/header-component-audit.md");
  });
});

describe("makeCleanSession", () => {
  it("initializes clean session state", () => {
    const state = makeCleanSession();
    expect(state.ctx).toBeUndefined();
    expect(state.lastAudit).toBeNull();
    expect(state.auditCount).toBe(0);
  });
});

describe("evaluateContent", () => {
  it("detects <img> missing alt attribute", () => {
    const code = '<div><img src="/logo.png" /></div>';
    const violations = evaluateContent(code, "App.tsx");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.category === "accessibility" && v.message.includes("alt"))).toBe(true);
  });

  it("detects empty buttons without aria-label", () => {
    const code = '<button></button>';
    const violations = evaluateContent(code, "Button.tsx");
    expect(violations.some((v) => v.category === "accessibility" && v.message.includes("aria-label"))).toBe(true);
  });
});

describe("calculateScores", () => {
  it("calculates 100% when there are no violations", () => {
    const scores = calculateScores([]);
    expect(scores.overall).toBe(100);
    expect(scores.accessibility).toBe(100);
  });

  it("deducts points based on violation severity", () => {
    const violations: WebViolation[] = [
      { category: "accessibility", severity: "error", message: "Missing alt" },
      { category: "seo", severity: "warning", message: "Missing meta desc" },
    ];
    const scores = calculateScores(violations);
    expect(scores.accessibility).toBeLessThan(100);
    expect(scores.seo).toBeLessThan(100);
    expect(scores.overall).toBeLessThan(100);
  });
});

describe("renderMarkdownReport", () => {
  it("renders a valid Markdown document from audit results", () => {
    const audit: WebAuditResult = {
      target: "Landing Page",
      scores: { accessibility: 85, performance: 90, seo: 95, semantics: 90, overall: 90 },
      violations: [
        { category: "accessibility", severity: "error", message: "Missing alt", file: "Hero.tsx", line: 12 },
      ],
      createdAt: "2026-02-28T00:00:00.000Z",
      slug: "landing-page",
    };

    const md = renderMarkdownReport(audit);
    expect(md).toContain("# Web Quality Audit Report: Landing Page");
    expect(md).toContain("> **Overall Health Score:** 90/100");
    expect(md).toContain("Missing alt");
  });
});
