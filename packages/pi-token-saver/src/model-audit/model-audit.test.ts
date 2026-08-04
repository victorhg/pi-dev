import { describe, it, expect } from "vitest";
import { detectCurrentModel, generateSuggestions, estimateMonthlyCost, MODEL_PRICING, runAudit, formatAuditReport } from "./index.js";

describe("detectCurrentModel", () => {
  it("detects known model by exact id", () => {
    const detected = detectCurrentModel({ id: "claude-sonnet-4" });
    expect(detected).not.toBeNull();
    expect(detected!.provider).toBe("anthropic");
    expect(detected!.tier).toBe("standard");
  });

  it("detects model by partial match", () => {
    const detected = detectCurrentModel({ id: "claude-opus-4-20250514" });
    expect(detected).not.toBeNull();
    expect(detected!.tier).toBe("premium");
  });

  it("detects model by heuristics (sonnet)", () => {
    const detected = detectCurrentModel({ id: "anthropic/claude-sonnet-4-20250514" });
    expect(detected).not.toBeNull();
    expect(detected!.provider).toBe("anthropic");
  });

  it("returns null for unknown models", () => {
    const detected = detectCurrentModel({ id: "nonexistent-model-v42" });
    expect(detected).toBeNull();
  });

  it("returns null for undefined model", () => {
    expect(detectCurrentModel(undefined)).toBeNull();
    expect(detectCurrentModel(null)).toBeNull();
  });
});

describe("estimateMonthlyCost", () => {
  it("returns reasonable cost for sonnet", () => {
    const cost = estimateMonthlyCost(MODEL_PRICING["claude-sonnet-4"]);
    // ~$82.5/month based on 15K input + 2K output tokens/turn, 50 turns/day, 22 days
    expect(cost).toBeGreaterThan(50);
    expect(cost).toBeLessThan(150);
  });

  it("returns lower cost for budget tier", () => {
    const premium = estimateMonthlyCost(MODEL_PRICING["claude-opus-4"]);
    const budget = estimateMonthlyCost(MODEL_PRICING["claude-haiku-3.5"]);
    expect(budget).toBeLessThan(premium);
  });

  it("returns 0 for free tier", () => {
    const cost = estimateMonthlyCost(MODEL_PRICING["gemini-2.0-flash"]);
    expect(cost).toBe(0);
  });
});

describe("generateSuggestions", () => {
  it("suggests downgrade for premium models", () => {
    const detected = detectCurrentModel({ id: "claude-opus-4" })!;
    const suggestions = generateSuggestions(detected);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggested).toContain("sonnet");
  });

  it("suggests downgrade for standard models", () => {
    const detected = detectCurrentModel({ id: "gpt-4o" })!;
    const suggestions = generateSuggestions(detected);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggested).toContain("mini");
  });

  it("generates no suggestions for budget models", () => {
    const detected = detectCurrentModel({ id: "claude-haiku-3.5" })!;
    const suggestions = generateSuggestions(detected);
    expect(suggestions.length).toBe(0);
  });

  it("generates no suggestions for free models", () => {
    const detected = detectCurrentModel({ id: "gemini-2.0-flash" })!;
    const suggestions = generateSuggestions(detected);
    expect(suggestions.length).toBe(0);
  });

  it("provides monthly saving estimate", () => {
    const detected = detectCurrentModel({ id: "claude-opus-4" })!;
    const suggestions = generateSuggestions(detected);
    expect(suggestions[0].monthlySaving).toBeGreaterThan(0);
  });
});

describe("runAudit", () => {
  it("returns a full audit report for known model", () => {
    const report = runAudit({ id: "claude-sonnet-4" } as any);
    expect(report.currentModel).not.toBeNull();
    expect(report.estimatedMonthlyCost).toBeGreaterThan(0);
    expect(report.suggestions).toBeDefined();
  });

  it("returns null current model for unknown model", () => {
    const report = runAudit({ id: "xyz-unknown" } as any);
    expect(report.currentModel).toBeNull();
    expect(report.suggestions.length).toBe(0);
  });
});

describe("formatAuditReport", () => {
  it("produces readable output", () => {
    const report = runAudit({ id: "claude-sonnet-4" } as any);
    const formatted = formatAuditReport(report);
    expect(formatted).toContain("Token Saver");
    expect(formatted).toContain("Claude Sonnet 4");
  });

  it("handles unknown model gracefully", () => {
    const report = runAudit(null);
    const formatted = formatAuditReport(report);
    expect(formatted).toContain("not be detected");
  });
});
