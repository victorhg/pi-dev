import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseCsv,
  mapToolSeverity,
  parseLizardCsv,
  parseJscpdJson,
  parseAislopJson,
  parseSemgrepJson,
  parseGitleaksJson,
} from "./normalize.js";

function fixture(name: string): string {
  const url = new URL(`../test/fixtures/${name}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8");
}

describe("parseCsv", () => {
  it("splits simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('1,2,"a,b",4')).toEqual([["1", "2", "a,b", "4"]]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("mapToolSeverity", () => {
  it("maps error/warning/info onto the severity scale", () => {
    expect(mapToolSeverity("ERROR")).toBe("high");
    expect(mapToolSeverity("error")).toBe("high");
    expect(mapToolSeverity("WARNING")).toBe("medium");
    expect(mapToolSeverity("info")).toBe("low");
    expect(mapToolSeverity(undefined)).toBe("info");
  });
});

describe("parseLizardCsv", () => {
  it("parses functions and flags those over threshold", () => {
    const result = parseLizardCsv(fixture("lizard.csv"), { complexityThreshold: 10 });
    expect(result.detail.functionsScanned).toBe(4);
    expect(result.detail.maxCyclomatic).toBe(35);

    // Functions over threshold 10: processOrder (12) and handleAll (35).
    const over = result.findings.filter((f) => f.metric === "complexity");
    expect(over).toHaveLength(2);
    expect(over.map((f) => f.file)).toEqual(["src/order.py", "src/legacy.js"]);

    const critical = over.find((f) => f.file === "src/legacy.js");
    expect(critical?.severity).toBe("critical");
    expect(critical?.line).toBe(1);
  });

  it("returns empty for blank input", () => {
    const result = parseLizardCsv("", {});
    expect(result.findings).toEqual([]);
    expect(result.detail.functionsScanned).toBe(0);
  });
});

describe("parseJscpdJson", () => {
  it("extracts duplication percentage and clone findings", () => {
    const result = parseJscpdJson(fixture("jscpd.json"));
    expect(result.detail.duplicationPercent).toBe(8.0);
    expect(result.detail.clonesCount).toBe(2);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]).toMatchObject({
      metric: "duplication",
      severity: "medium",
      ruleId: "jscpd/clone",
      file: "src/a.js",
      line: 5,
    });
  });

  it("returns gracefully on malformed JSON", () => {
    const result = parseJscpdJson("not json");
    expect(result.findings).toEqual([]);
    expect(result.detail.parseError).toBe(true);
  });
});

describe("parseAislopJson", () => {
  it("extracts score and maps diagnostics", () => {
    const result = parseAislopJson(fixture("aislop.json"));
    expect(result.detail.score).toBe(76);
    expect(result.detail.scoreable).toBe(true);
    expect(result.findings).toHaveLength(2);

    const [warning, error] = result.findings;
    expect(warning).toMatchObject({
      metric: "slop",
      severity: "medium",
      ruleId: "ai-slop/narrative-comment",
      file: "src/comp.ts",
      line: 4,
    });
    expect(error.severity).toBe("high");
  });

  it("reports null score when not scoreable", () => {
    const json = JSON.stringify({ score: null, scoreable: false, diagnostics: [] });
    const result = parseAislopJson(json);
    expect(result.detail.score).toBeNull();
    expect(result.detail.scoreable).toBe(false);
  });
});

describe("parseSemgrepJson", () => {
  it("extracts severity, cwe, and locations", () => {
    const result = parseSemgrepJson(fixture("semgrep.json"));
    expect(result.findings).toHaveLength(2);
    expect(result.detail.total).toBe(2);

    const [subprocess, evalFinding] = result.findings;
    expect(subprocess).toMatchObject({
      metric: "security",
      severity: "high",
      ruleId: "python.lang.security.audit.dangerous-subprocess-use.dangerous-subprocess-use",
      file: "src/run.py",
      line: 10,
    });
    expect(subprocess.meta?.cwe).toEqual(["CWE-78"]);
    expect(evalFinding.severity).toBe("medium");
  });

  it("counts findings by severity", () => {
    const result = parseSemgrepJson(fixture("semgrep.json"));
    expect(result.detail.bySeverity).toEqual({ high: 1, medium: 1 });
  });
});

describe("parseGitleaksJson", () => {
  it("extracts secret findings from the array", () => {
    const result = parseGitleaksJson(fixture("gitleaks.json"));
    expect(result.findings).toHaveLength(2);
    expect(result.detail.leakCount).toBe(2);

    expect(result.findings[0]).toMatchObject({
      metric: "secrets",
      severity: "high",
      ruleId: "aws-access-token",
      file: "config/aws.ts",
      line: 5,
    });
    expect(result.findings[0].meta?.entropy).toBe(4.5);
  });

  it("collects distinct rule ids", () => {
    const result = parseGitleaksJson(fixture("gitleaks.json"));
    expect(result.detail.rules).toEqual(["aws-access-token", "generic-api-key"]);
  });

  it("returns gracefully on malformed JSON", () => {
    const result = parseGitleaksJson("{");
    expect(result.findings).toEqual([]);
    expect(result.detail.parseError).toBe(true);
  });
});
