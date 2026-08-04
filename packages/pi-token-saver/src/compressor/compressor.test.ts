import { describe, it, expect } from "vitest";
import { compressContent, estimateTokens } from "./index.js";

describe("compressContent", () => {
  it("collapses multiple blank lines", () => {
    const input = "line1\n\n\n\nline2";
    const result = compressContent(input, "test.md");
    expect(result).not.toContain("\n\n\n\n");
    expect(result.split("\n").filter(l => l === "").length).toBeLessThanOrEqual(2);
  });

  it("compresses 'When X, I should Y' pattern", () => {
    const input = "When the user asks for help, I should respond promptly and clearly.";
    const result = compressContent(input, "test.md");
    expect(result).toContain("→");
    expect(result).not.toContain("I should");
  });

  it("compresses 'If X, then Y' pattern", () => {
    const input = "If the file exists, then read it and process the contents.";
    const result = compressContent(input, "test.md");
    expect(result).toContain("?");
  });

  it("compresses filler phrases (case insensitive)", () => {
    const input = "In order to proceed, I tend to check the configuration first. It is important to verify settings. Make sure to backup the file as well as the database.";
    const result = compressContent(input, "test.md");
    expect(result).not.toMatch(/\bin order to\b/i);
    expect(result).not.toMatch(/\bI tend to\b/i);
    expect(result).not.toMatch(/\bIt is important to\b/i);
    expect(result).not.toMatch(/\bMake sure to\b/i);
    expect(result).toContain("&");
  });

  it("converts bullet markers", () => {
    const input = "- item one\n  - item two\n- item three";
    const result = compressContent(input, "test.md");
    expect(result).toContain("• item one");
    expect(result).toContain("  • item two");
  });

  it("applies AGENTS-specific patterns", () => {
    const input = "When you receive a task, follow these steps:\n1. Read the code\n2. Analyze patterns\n3. Propose changes";
    const result = compressContent(input, "AGENTS.md");
    // Should have workflow compression
    const arrowCount = (result.match(/→/g) || []).length;
    expect(arrowCount).toBeGreaterThanOrEqual(2);
  });

  it("estimates tokens roughly", () => {
    const tokens = estimateTokens("This is a test string with 40 characters total");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThanOrEqual(15);
  });

  it("returns similar content if no patterns match", () => {
    const input = "simple text\nwith nothing compressible\nhere";
    const result = compressContent(input, "random.md");
    // Should be roughly the same (minus trailing whitespace and collapsed blank lines)
    const normalizedResult = result.replace(/\s+$/gm, '').replace(/\n{2,}/g, '\n\n');
    const normalizedInput = input.replace(/\s+$/gm, '').replace(/\n{2,}/g, '\n\n');
    expect(normalizedResult).toBe(normalizedInput);
  });
});
