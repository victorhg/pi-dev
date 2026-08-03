import { describe, it, expect } from "vitest";
import {
  HALLMARK_THEMES,
  getThemeById,
  getRotatedTheme,
  createCustomTheme,
  renderTokensCss,
} from "./themes.js";

describe("themes module", () => {
  it("contains 10 initial named themes in catalog", () => {
    expect(HALLMARK_THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it("finds theme by id or name", () => {
    const carnival = getThemeById("carnival");
    expect(carnival?.name).toBe("Carnival");
    const cobalt = getThemeById("Cobalt");
    expect(cobalt?.id).toBe("cobalt");
  });

  it("rotates themes sequentially", () => {
    const t1 = getRotatedTheme();
    const t2 = getRotatedTheme(t1.id);
    expect(t1.id).not.toBe(t2.id);
  });

  it("creates custom OKLCH theme", () => {
    const custom = createCustomTheme("Acme SaaS", "oklch(0.60 0.22 250)", "Cabinet Grotesk, sans-serif", "Inter, sans-serif");
    expect(custom.id).toBe("custom-acme-saas");
    expect(custom.tokens.accent).toBe("oklch(0.60 0.22 250)");

    const css = renderTokensCss(custom);
    expect(css).toContain("--color-accent: oklch(0.60 0.22 250)");
    expect(css).toContain("--font-display: Cabinet Grotesk, sans-serif");
  });
});
