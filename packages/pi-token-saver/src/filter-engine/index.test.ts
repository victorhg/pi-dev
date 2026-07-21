import { describe, it, expect } from "vitest";
import { FilterEngine, redactSecrets, stripAnsiText } from "./index.js";

describe("redactSecrets", () => {
  it("redacts OpenAI API keys", () => {
    const input = "Error using key sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    const output = redactSecrets(input);
    expect(output).toContain("sk-[REDACTED]");
    expect(output).not.toContain("sk-proj");
  });

  it("redacts GitHub tokens", () => {
    const input = "token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";
    const output = redactSecrets(input);
    expect(output).toContain("ghp_[REDACTED]");
    expect(output).not.toContain("ghp_123");
  });
});

describe("FilterEngine", () => {
  const engine = new FilterEngine();

  it("matches and filters git status", () => {
    const raw = "On branch main\nChanges not staged for commit:\n\tmodified:   src/index.ts";
    const res = engine.applyWithMetadata("git status", raw);
    expect(res.matched).toBe(true);
    expect(res.output).toContain("main");
    expect(res.output).toContain("Modified");
  });

  it("matches and filters test runner output", () => {
    const raw = "FAILED tests/auth.test.ts - expected true to be false\n3 passed, 1 failed in 2.1s";
    const res = engine.applyWithMetadata("npm test", raw);
    expect(res.matched).toBe(true);
    expect(res.output).toContain("Failures");
  });

  it("returns clean unmasked output when no filter matches", () => {
    const raw = "Hello world";
    const res = engine.applyWithMetadata("echo hello", raw);
    expect(res.matched).toBe(false);
    expect(res.output).toBe("Hello world");
  });
});
