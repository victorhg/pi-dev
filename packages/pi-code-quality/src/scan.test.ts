import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  listProjectFiles,
  computeFunctionSpaghetti,
  checkToolAvailability,
  runScan,
  type ScanDeps,
} from "./scan.js";
import type { ExecFn, WhichFn } from "./runners.js";
import type { LizardFunction } from "./normalize.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)), "utf8");
}

const whichAll: WhichFn = (bin) =>
  ["lizard", "jscpd", "semgrep", "gitleaks", "aislop"].includes(bin) ? `/usr/bin/${bin}` : null;

const whichNone: WhichFn = () => null;

function makeFixtureExec(): ExecFn {
  return async (command) => {
    switch (command) {
      case "git":
        return { stdout: "src/a.ts\0src/b.py\0package.json\0", stderr: "", code: 0 };
      case "lizard":
        return { stdout: fixture("lizard.csv"), stderr: "", code: 0 };
      case "jscpd":
        return { stdout: "", stderr: "", code: 0 };
      case "semgrep":
        return { stdout: fixture("semgrep.json"), stderr: "", code: 1 };
      case "gitleaks":
        return { stdout: fixture("gitleaks.json"), stderr: "", code: 1 };
      case "aislop":
        return { stdout: fixture("aislop.json"), stderr: "", code: 0 };
      default:
        return { stdout: "", stderr: `no mock for ${command}`, code: 127 };
    }
  };
}

const deps: ScanDeps = {
  exec: makeFixtureExec(),
  which: whichAll,
  readFile: async () => fixture("jscpd.json"),
  tmpDir: () => "/tmp/pi-code-quality-test",
};

describe("listProjectFiles", () => {
  it("uses git ls-files scoped to the target", async () => {
    const calls: string[][] = [];
    const exec: ExecFn = async (_c, args) => {
      calls.push(args);
      return { stdout: "a.ts\0b.py\0c.go\0", stderr: "", code: 0 };
    };
    expect(await listProjectFiles(exec, "/repo", "src")).toEqual(["a.ts", "b.py", "c.go"]);
    expect(calls[0]).toEqual(["ls-files", "-z", "--", "src"]);
  });

  it("falls back to find when git is unavailable", async () => {
    const exec: ExecFn = async (command) => {
      if (command === "git") return { stdout: "", stderr: "not a repo", code: 128 };
      return { stdout: "src/a.ts\nsrc/b.py\n", stderr: "", code: 0 };
    };
    expect(await listProjectFiles(exec, "/repo", "src")).toEqual(["src/a.ts", "src/b.py"]);
  });
});

describe("computeFunctionSpaghetti", () => {
  const functions: LizardFunction[] = [
    { name: "a", file: "f1.py", startLine: 1, endLine: 5, cyclomaticComplexity: 9, nloc: 100, parameterCount: 0, tokenCount: 10 },
    { name: "b", file: "f1.py", startLine: 6, endLine: 10, cyclomaticComplexity: 2, nloc: 20, parameterCount: 0, tokenCount: 5 },
    { name: "c", file: "f2.py", startLine: 1, endLine: 5, cyclomaticComplexity: 1, nloc: 10, parameterCount: 0, tokenCount: 3 },
  ];

  it("computes per-function SF and sorts worst-first", () => {
    const results = computeFunctionSpaghetti(functions);
    expect(results).toHaveLength(3);
    // a: 9 + 100/20 = 14
    expect(results[0]).toMatchObject({ name: "a", file: "f1.py" });
    expect(results[0].value).toBe(14);
    expect(results[0].band).toBe("ok");
    // b: 2 + 20/20 = 3
    expect(results[1].value).toBe(3);
    // c: 1 + 10/20 = 1.5
    expect(results[2].value).toBeCloseTo(1.5, 5);
  });

  it("includes globals when provided", () => {
    const results = computeFunctionSpaghetti(functions, 2);
    // a: 9 + 10 + 5 = 24
    expect(results[0].value).toBe(24);
  });
});

describe("checkToolAvailability", () => {
  it("reports all metrics with availability and install hints", () => {
    const result = checkToolAvailability((bin) => (bin === "lizard" ? "/usr/bin/lizard" : null));
    expect(result).toHaveLength(6);

    const complexity = result.find((t) => t.metric === "complexity")!;
    expect(complexity.available).toBe(true);
    expect(complexity.command).toEqual(["lizard"]);

    const secrets = result.find((t) => t.metric === "secrets")!;
    expect(secrets.available).toBe(false);
    expect(secrets.installHint).toContain("gitleaks");
  });

  it("resolves npx fallbacks when the runner is available", () => {
    const result = checkToolAvailability((bin) => (bin === "npx" ? "/usr/bin/npx" : null));
    const slop = result.find((t) => t.metric === "slop")!;
    expect(slop.available).toBe(true);
    expect(slop.command).toEqual(["npx", "--yes", "aislop"]);
  });
});

describe("runScan", () => {
  it("produces a full report with all six metrics scored", async () => {
    const report = await runScan(deps, { target: ".", cwd: "/repo" });

    for (const id of ["complexity", "duplication", "spaghetti", "security", "secrets", "slop"]) {
      expect(report.scores[id as keyof typeof report.scores].metric).toBe(id);
      expect(report.scores[id as keyof typeof report.scores].status).not.toBe("unavailable");
    }

    expect(report.overall).toBe(55);
    expect(report.gate).toEqual({ failBelow: 70, passed: false });
  });

  it("marks every metric unavailable when no tools are installed", async () => {
    const noTools: ScanDeps = { ...deps, which: whichNone };
    const report = await runScan(noTools, { target: ".", cwd: "/repo" });

    for (const id of ["complexity", "duplication", "spaghetti", "security", "secrets", "slop"]) {
      expect(report.scores[id as keyof typeof report.scores].status).toBe("unavailable");
    }
    expect(report.overall).toBeNull();
    expect(report.gate).toBeUndefined();
  });

  it("marks a metric unavailable on tool error without failing the scan", async () => {
    const brokenExec: ExecFn = async (command) => {
      if (command === "semgrep") return { stdout: "", stderr: "config error", code: 2 };
      return makeFixtureExec()(command, []);
    };
    const report = await runScan({ ...deps, exec: brokenExec }, { target: ".", cwd: "/repo" });

    expect(report.scores.security.status).toBe("unavailable");
    expect(report.scores.security.detail?.unavailableReason).toContain("tool error");
    // Other metrics still computed.
    expect(report.scores.complexity.status).not.toBe("unavailable");
  });

  it("emits progress events for each step", async () => {
    const events: string[] = [];
    await runScan(deps, {
      target: ".",
      cwd: "/repo",
      onProgress: (p) => events.push(`${p.status}:${p.stage}`),
    });

    const starts = events.filter((e) => e.startsWith("start:"));
    const finishes = events.filter((e) => e.startsWith("done:") || e.startsWith("skipped:"));

    // 6 starts: file listing + 5 tool runs.
    expect(starts.length).toBe(6);
    expect(starts.some((e) => e.includes("lizard"))).toBe(true);
    expect(starts.some((e) => e.includes("semgrep"))).toBe(true);
    // Every tool also emits a finish event.
    expect(finishes.length).toBe(6);
  });
});
