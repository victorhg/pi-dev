import { describe, it, expect } from "vitest";
import { parseRunString, makeCleanSession } from "./index.js";

// ── parseRunString ────────────────────────────────────────────────────────────

describe("parseRunString", () => {
  it("splits simple key=value pairs", () => {
    expect(parseRunString("search query=roadmap limit=10")).toEqual([
      "search",
      "query=roadmap",
      "limit=10",
    ]);
  });

  it("strips surrounding double-quotes from values", () => {
    expect(parseRunString('read file="My Note"')).toEqual([
      "read",
      "file=My Note",
    ]);
  });

  it("strips surrounding single-quotes from values", () => {
    expect(parseRunString("read file='My Note'")).toEqual([
      "read",
      "file=My Note",
    ]);
  });

  it("handles bare flags (no value)", () => {
    expect(parseRunString("files folder=Projects recursive")).toEqual([
      "files",
      "folder=Projects",
      "recursive",
    ]);
  });

  it("handles a single-word command", () => {
    expect(parseRunString("daily:read")).toEqual(["daily:read"]);
  });

  it("handles multi-word quoted content values", () => {
    const result = parseRunString('create path=note.md content="# Hello\n\nWorld"');
    expect(result).toContain("create");
    expect(result).toContain("path=note.md");
    expect(result.some((a) => a.startsWith("content="))).toBe(true);
  });

  it("returns empty array for empty string", () => {
    expect(parseRunString("")).toEqual([]);
    expect(parseRunString("   ")).toEqual([]);
  });
});

// ── makeCleanSession ──────────────────────────────────────────────────────────

describe("makeCleanSession", () => {
  it("returns a fresh state with nulls", () => {
    const s = makeCleanSession();
    expect(s.vault).toBeNull();
    expect(s.lastCommand).toBeNull();
    expect(s.ctx).toBeUndefined();
  });

  it("returns independent objects on each call", () => {
    const a = makeCleanSession();
    const b = makeCleanSession();
    a.vault = "Personal";
    expect(b.vault).toBeNull();
  });
});
