import { describe, it, expect } from "vitest";
import {
  slugify,
  auditPath,
  evaluateContent,
  calculateScores,
  renderMarkdownReport,
  makeCleanSession,
} from "./index.js";
import type { SecAuditResult, SecViolation } from "./index.js";

describe("slugify", () => {
  it("converts target names to URL-safe slugs", () => {
    expect(slugify("API Routes")).toBe("api-routes");
    expect(slugify("Auth Module (v1)")).toBe("auth-module-v1");
    expect(slugify("   ")).toBe("sec-audit");
  });
});

describe("auditPath", () => {
  it("formats security audit report paths correctly", () => {
    expect(auditPath("api-routes")).toBe("security/api-routes-audit.md");
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
  it("detects hardcoded secret tokens", () => {
    const code = 'const jwt_secret = "placeholder-not-a-real-secret";';
    const violations = evaluateContent(code, "config.ts");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.category === "secrets" && v.severity === "critical")).toBe(true);
  });

  it("detects dangerouslySetInnerHTML usage", () => {
    const code = '<div dangerouslySetInnerHTML={{ __html: userInput }} />';
    const violations = evaluateContent(code, "Component.tsx");
    expect(violations.some((v) => v.category === "xss")).toBe(true);
  });
});

describe("calculateScores", () => {
  it("calculates 100% when there are no violations", () => {
    const scores = calculateScores([]);
    expect(scores.overall).toBe(100);
    expect(scores.secrets).toBe(100);
  });

  it("deducts points based on violation severity", () => {
    const violations: SecViolation[] = [
      { category: "secrets", severity: "critical", message: "Hardcoded secret" },
      { category: "xss", severity: "high", message: "XSS risk" },
    ];
    const scores = calculateScores(violations);
    expect(scores.secrets).toBeLessThan(100);
    expect(scores.xss).toBeLessThan(100);
    expect(scores.overall).toBeLessThan(100);
  });
});

describe("renderMarkdownReport", () => {
  it("renders a valid Markdown security document from audit results", () => {
    const audit: SecAuditResult = {
      target: "Auth Service",
      scores: { secrets: 70, xss: 85, apiSecurity: 90, misconfig: 95, overall: 85 },
      violations: [
        { category: "secrets", severity: "critical", message: "Hardcoded API key", file: "auth.ts", line: 5 },
      ],
      createdAt: "2026-02-28T00:00:00.000Z",
      slug: "auth-service",
    };

    const md = renderMarkdownReport(audit);
    expect(md).toContain("# Security Audit Report: Auth Service");
    expect(md).toContain("> **Overall Security Score:** 85/100");
    expect(md).toContain("Hardcoded API key");
  });
});
