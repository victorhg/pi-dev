import { describe, it, expect } from "vitest";
import {
  evaluateSlopGates,
  calculateCritiqueScores,
  calculateOverallScore,
  auditContent,
  slugify,
  renderAuditReport,
} from "./audit.js";

describe("audit module", () => {
  it("slugify creates URL-safe string", () => {
    expect(slugify("My Test Landing Page")).toBe("my-test-landing-page");
    expect(slugify("!!!")).toBe("hallmark-audit");
  });

  it("detects purple/blue gradient violation (Gate 1)", () => {
    const code = `<div style="background: linear-gradient(135deg, #6366f1, #a855f7);">Hero</div>`;
    const violations = evaluateSlopGates(code, "test.html");
    expect(violations.some((v) => v.gateId === 1)).toBe(true);
  });

  it("detects symmetric 3-card grid violation (Gate 2)", () => {
    const code = `.grid { grid-template-columns: repeat(3, 1fr); }`;
    const violations = evaluateSlopGates(code, "test.css");
    expect(violations.some((v) => v.gateId === 2)).toBe(true);
  });

  it("detects excessive border-radius > 4px (Gate 3)", () => {
    const code = `.card { border-radius: 12px; }`;
    const violations = evaluateSlopGates(code, "test.css");
    expect(violations.some((v) => v.gateId === 3)).toBe(true);
  });

  it("does not flag border-radius > 4px on explicit pill/badge elements", () => {
    const code = `.badge-pill { border-radius: 20px; }`;
    const violations = evaluateSlopGates(code, "test.css");
    expect(violations.some((v) => v.gateId === 3)).toBe(false);
  });

  it("detects invented marketing claims (Gate 5)", () => {
    const code = `<h1>Trusted by 50,000+ teams and 10x faster</h1>`;
    const violations = evaluateSlopGates(code, "test.html");
    expect(violations.some((v) => v.gateId === 5)).toBe(true);
  });

  it("calculates critique scores and renders report", () => {
    const code = `<div style="background: linear-gradient(to right, #3b82f6, #a855f7);">Sample</div>`;
    const res = auditContent(code, "SampleComponent");
    expect(res.target).toBe("SampleComponent");
    expect(res.violations.length).toBeGreaterThan(0);
    expect(res.overallScore).toBeLessThan(100);

    const md = renderAuditReport(res);
    expect(md).toContain("# Hallmark Anti-Slop Audit: SampleComponent");
    expect(md).toContain("Pre-Emit Critique Axes");
  });
});
