import { describe, it, expect } from "vitest";
import {
  clamp,
  statusForScore,
  spaghettiBand,
  computeSpaghettiFactor,
  scoreSpaghetti,
  worstSpaghetti,
  scoreComplexity,
  scoreDuplication,
  scoreSecurity,
  scoreSecrets,
  scoreSlop,
  aggregateScores,
  evaluateGate,
} from "./score.js";
import { parseLizardCsv } from "./normalize.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Finding, MetricScore } from "./schema.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)), "utf8");
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return { metric: "security", severity: "high", message: "x", ...overrides };
}

function metricScore(overrides: Partial<MetricScore> & { metric: MetricScore["metric"] }): MetricScore {
  return { score: 100, status: "ok", findings: [], detail: {}, ...overrides };
}

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("statusForScore", () => {
  it("maps score bands to status", () => {
    expect(statusForScore(90)).toBe("ok");
    expect(statusForScore(80)).toBe("ok");
    expect(statusForScore(70)).toBe("warning");
    expect(statusForScore(60)).toBe("warning");
    expect(statusForScore(59)).toBe("error");
  });
});

describe("computeSpaghettiFactor", () => {
  it("matches Koopman's reference example", () => {
    // SF = 9 + (1*5) + (100/20) = 19
    const result = computeSpaghettiFactor(9, 1, 100);
    expect(result.value).toBe(19);
    expect(result.band).toBe("review");
  });

  it("scores trivial code in the sweet spot", () => {
    const result = computeSpaghettiFactor(3, 0, 60);
    expect(result.value).toBe(6);
    expect(result.band).toBe("sweet-spot");
  });

  it("marks 50 as untestable", () => {
    expect(computeSpaghettiFactor(30, 3, 100).value).toBe(50);
    expect(spaghettiBand(50)).toBe("untestable");
  });

  it("covers every band boundary", () => {
    expect(spaghettiBand(10)).toBe("sweet-spot");
    expect(spaghettiBand(15)).toBe("ok");
    expect(spaghettiBand(20)).toBe("review");
    expect(spaghettiBand(30)).toBe("refactor");
    expect(spaghettiBand(75)).toBe("unmaintainable");
    expect(spaghettiBand(76)).toBe("nightmare");
  });
});

describe("scoreSpaghetti", () => {
  it("maps the linear range", () => {
    expect(scoreSpaghetti(10)).toBe(100);
    expect(scoreSpaghetti(30)).toBe(50);
    expect(scoreSpaghetti(50)).toBe(0);
    expect(scoreSpaghetti(5)).toBe(100);
    expect(scoreSpaghetti(99)).toBe(0);
  });
});

describe("worstSpaghetti", () => {
  it("returns the highest-SF module", () => {
    const factors = [
      computeSpaghettiFactor(3, 0, 60),
      computeSpaghettiFactor(30, 3, 100),
      computeSpaghettiFactor(9, 1, 100),
    ];
    expect(worstSpaghetti(factors)?.value).toBe(50);
  });

  it("returns null for empty input", () => {
    expect(worstSpaghetti([])).toBeNull();
  });
});

describe("scoreComplexity", () => {
  it("scores 100 when all functions are under threshold", () => {
    const result = scoreComplexity({
      findings: [],
      detail: { functionsScanned: 3, overThreshold: 0, maxCyclomatic: 5, threshold: 10 },
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe("ok");
  });

  it("scores below 100 when a function is over threshold", () => {
    const result = scoreComplexity({
      findings: [],
      detail: { functionsScanned: 2, overThreshold: 1, maxCyclomatic: 12, threshold: 10 },
    });
    expect(result.score).toBeLessThan(100);
  });

  it("returns unavailable when no functions were analyzed", () => {
    const result = scoreComplexity({
      findings: [],
      detail: { functionsScanned: 0, overThreshold: 0, maxCyclomatic: 0 },
    });
    expect(result.status).toBe("unavailable");
  });

  it("composes with parseLizardCsv on the fixture", () => {
    const parsed = parseLizardCsv(fixture("lizard.csv"), { complexityThreshold: 10 });
    const result = scoreComplexity(parsed);
    expect(result.status).toBe("error");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(60);
  });
});

describe("scoreDuplication", () => {
  it("scores 100 for 0% duplication", () => {
    expect(scoreDuplication({ findings: [], detail: { duplicationPercent: 0 } }).score).toBe(100);
  });

  it("scores 50 for 50% duplication", () => {
    expect(scoreDuplication({ findings: [], detail: { duplicationPercent: 50 } }).score).toBe(50);
  });

  it("clamps at 0 for extreme duplication", () => {
    expect(scoreDuplication({ findings: [], detail: { duplicationPercent: 200 } }).score).toBe(0);
  });

  it("returns unavailable when percentage is missing", () => {
    expect(scoreDuplication({ findings: [], detail: {} }).status).toBe("unavailable");
  });
});

describe("scoreSecurity", () => {
  it("scores 100 with no findings", () => {
    expect(scoreSecurity({ findings: [], detail: { total: 0 } }).score).toBe(100);
  });

  it("deducts severity-weighted points", () => {
    const result = scoreSecurity({
      findings: [
        finding({ severity: "critical" }),
        finding({ severity: "high" }),
        finding({ severity: "low" }),
      ],
      detail: { total: 3 },
    });
    // 100 - (30 + 15 + 3) = 52
    expect(result.score).toBe(52);
  });

  it("returns unavailable on parse error", () => {
    expect(scoreSecurity({ findings: [], detail: { parseError: true } }).status).toBe("unavailable");
  });
});

describe("scoreSecrets", () => {
  it("scores 100 with no leaks", () => {
    expect(scoreSecrets({ findings: [], detail: { leakCount: 0 } }).score).toBe(100);
  });

  it("deducts 25 per leak", () => {
    expect(scoreSecrets({ findings: [finding(), finding()], detail: {} }).score).toBe(50);
  });

  it("clamps at 0 for many leaks", () => {
    const many = [finding(), finding(), finding(), finding(), finding()];
    expect(scoreSecrets({ findings: many, detail: {} }).score).toBe(0);
  });
});

describe("scoreSlop", () => {
  it("adopts aislop's score", () => {
    expect(scoreSlop({ findings: [], detail: { score: 76 } }).score).toBe(76);
  });

  it("returns unavailable when not scoreable", () => {
    expect(scoreSlop({ findings: [], detail: { score: null, scoreable: false } }).status).toBe("unavailable");
  });
});

describe("aggregateScores", () => {
  const weights = {
    complexity: 25,
    duplication: 20,
    spaghetti: 20,
    security: 15,
    secrets: 10,
    slop: 10,
  };

  it("computes the weighted mean", () => {
    const scores = {
      complexity: metricScore({ metric: "complexity", score: 80 }),
      duplication: metricScore({ metric: "duplication", score: 90 }),
      spaghetti: metricScore({ metric: "spaghetti", score: 100 }),
      security: metricScore({ metric: "security", score: 70 }),
      secrets: metricScore({ metric: "secrets", score: 60 }),
      slop: metricScore({ metric: "slop", score: 50 }),
    };
    // (2000 + 1800 + 2000 + 1050 + 600 + 500) / 100 = 79.5 → 80
    expect(aggregateScores(scores, weights)).toBe(80);
  });

  it("renormalizes weights when a metric is unavailable", () => {
    const scores = {
      complexity: metricScore({ metric: "complexity", score: 80 }),
      slop: metricScore({ metric: "slop", score: 50 }),
    };
    // (80*25 + 50*10) / 35 = 71.43 → 71
    expect(aggregateScores(scores, weights)).toBe(71);
  });

  it("includes bad (error-status) metrics but excludes unavailable", () => {
    const scores = {
      complexity: metricScore({ metric: "complexity", score: 80 }),
      slop: metricScore({ metric: "slop", score: 0, status: "error" }),
    };
    // error-status metrics are real data (bad code) and count toward the score.
    expect(aggregateScores(scores, weights)).toBe(57);

    const withUnavailable = {
      complexity: metricScore({ metric: "complexity", score: 80 }),
      slop: metricScore({ metric: "slop", status: "unavailable", score: 0 }),
    };
    expect(aggregateScores(withUnavailable, weights)).toBe(80);
  });

  it("ignores zero-weight metrics", () => {
    const scores = {
      complexity: metricScore({ metric: "complexity", score: 80 }),
      slop: metricScore({ metric: "slop", score: 20 }),
    };
    expect(aggregateScores(scores, { ...weights, complexity: 0 })).toBe(20);
  });

  it("returns null when nothing is scoreable", () => {
    const scores = {
      complexity: metricScore({ metric: "complexity", status: "unavailable", score: 0 }),
      slop: metricScore({ metric: "slop", status: "unavailable", score: 0 }),
    };
    expect(aggregateScores(scores, weights)).toBeNull();
  });
});

describe("evaluateGate", () => {
  it("passes when overall meets the threshold", () => {
    expect(evaluateGate(80, 70)).toEqual({ failBelow: 70, passed: true });
  });

  it("fails when overall is below the threshold", () => {
    expect(evaluateGate(60, 80)).toEqual({ failBelow: 80, passed: false });
  });

  it("returns undefined when there is no overall score", () => {
    expect(evaluateGate(null, 70)).toBeUndefined();
  });
});
