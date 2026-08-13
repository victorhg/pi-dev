import { describe, it, expect } from "vitest";
import {
  METRIC_IDS,
  DEFAULT_WEIGHTS,
  DEFAULT_CONFIG,
} from "./schema.js";

describe("schema constants", () => {
  it("exposes exactly six metric ids", () => {
    expect(METRIC_IDS).toHaveLength(6);
    expect(METRIC_IDS).toEqual([
      "complexity",
      "duplication",
      "spaghetti",
      "security",
      "secrets",
      "slop",
    ]);
  });

  it("default weights sum to 100", () => {
    const total = METRIC_IDS.reduce((sum, id) => sum + DEFAULT_WEIGHTS[id], 0);
    expect(total).toBe(100);
  });

  it("default config has a gate and a complexity threshold", () => {
    expect(DEFAULT_CONFIG.failBelow).toBe(70);
    expect(DEFAULT_CONFIG.complexityThreshold).toBe(10);
  });
});
