import { describe, it, expect } from "vitest";
import {
  HALLMARK_MACROSTRUCTURES,
  getMacrostructureById,
  getRotatedMacrostructure,
} from "./macrostructures.js";

describe("macrostructures module", () => {
  it("contains 21 macrostructures in catalog", () => {
    expect(HALLMARK_MACROSTRUCTURES.length).toBe(21);
  });

  it("finds macrostructure by ID or number or name", () => {
    const bento = getMacrostructureById("01");
    expect(bento?.name).toBe("Bento Grid");

    const manifesto = getMacrostructureById("manifesto");
    expect(manifesto?.number).toBe("07");
  });

  it("rotates macrostructures sequentially", () => {
    const m1 = getRotatedMacrostructure();
    const m2 = getRotatedMacrostructure(m1.id);
    expect(m1.id).not.toBe(m2.id);
  });
});
