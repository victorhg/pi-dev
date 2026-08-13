import { describe, it, expect } from "vitest";
import {
  runTool,
  detectTool,
  resolveToolCommand,
  ToolRunError,
  TOOL_SPECS,
  type ExecFn,
  type WhichFn,
} from "./runners.js";

const okExec: ExecFn = async (command, args) => ({
  stdout: `${command} ${args.join(" ")}`,
  stderr: "",
  code: 0,
});

describe("runTool", () => {
  it("passes stdout through on success", async () => {
    const res = await runTool(okExec, "lizard", ["--csv"], {});
    expect(res.code).toBe(0);
    expect(res.stdout).toBe("lizard --csv");
  });

  it("throws ToolRunError on non-zero exit with stderr", async () => {
    const failing: ExecFn = async () => ({
      stdout: "",
      stderr: "file not found",
      code: 1,
    });
    await expect(runTool(failing, "semgrep", ["scan"])).rejects.toThrow(ToolRunError);
    await expect(runTool(failing, "semgrep", ["scan"])).rejects.toMatchObject({
      code: 1,
      stderr: "file not found",
      command: "semgrep scan",
    });
  });

  it("reads a result file into stdout when configured", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "", code: 0 });
    const readFile = async () => '{"ok": true}';
    const res = await runTool(exec, "jscpd", ["src"], {
      cwd: "/tmp/report",
      resultFile: "jscpd-report.json",
      readFile,
    });
    expect(res.stdout).toBe('{"ok": true}');
  });

  it("does not read the result file when the command fails", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "boom", code: 2 });
    let readCalled = false;
    const readFile = async () => {
      readCalled = true;
      return "unused";
    };
    await expect(
      runTool(exec, "jscpd", ["src"], { resultFile: "jscpd-report.json", readFile }),
    ).rejects.toThrow(ToolRunError);
    expect(readCalled).toBe(false);
  });
});

describe("detectTool", () => {
  const which: WhichFn = (bin) => (bin === "lizard" ? "/usr/bin/lizard" : null);

  it("returns the resolved path when found", () => {
    expect(detectTool("lizard", which)).toBe("/usr/bin/lizard");
  });

  it("returns null when not found", () => {
    expect(detectTool("semgrep", which)).toBeNull();
  });
});

describe("resolveToolCommand", () => {
  const which: WhichFn = (bin) => (bin === "npx" ? "/usr/bin/npx" : null);

  it("returns the first available candidate", () => {
    // jscpd itself is not installed, but npx is → fallback candidate wins.
    const argv = resolveToolCommand(TOOL_SPECS.duplication, which);
    expect(argv).toEqual(["npx", "jscpd"]);
  });

  it("prefers a directly installed binary over a runner fallback", () => {
    const whichBoth: WhichFn = (bin) =>
      bin === "aislop" ? "/usr/local/bin/aislop" : bin === "npx" ? "/usr/bin/npx" : null;
    expect(resolveToolCommand(TOOL_SPECS.slop, whichBoth)).toEqual(["aislop"]);
  });

  it("returns null when no candidate is available", () => {
    expect(resolveToolCommand(TOOL_SPECS.secrets, which)).toBeNull();
  });

  it("has a spec for every metric", () => {
    expect(Object.keys(TOOL_SPECS).sort()).toEqual([
      "complexity",
      "duplication",
      "secrets",
      "security",
      "slop",
      "spaghetti",
    ]);
  });
});
