/**
 * Theme catalog and custom theme generator for Hallmark.
 * Implements 20 named themes across 4 genres + custom OKLCH generator.
 */

import type { HallmarkTheme } from "./types.js";

export const HALLMARK_THEMES: HallmarkTheme[] = [
  {
    id: "carnival",
    name: "Carnival",
    genre: "playful",
    paperBand: "dark",
    displayStyle: "display-heavy",
    accentHue: "warm",
    fonts: {
      display: "Syne, sans-serif",
      body: "Plus Jakarta Sans, sans-serif",
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.18 0.04 280)",
      ink: "oklch(0.96 0.01 90)",
      accent: "oklch(0.72 0.22 35)",
      muted: "oklch(0.65 0.03 280)",
      border: "oklch(0.30 0.05 280)",
    },
    description: "High-contrast, heavy display typography for event, music, and creative briefs.",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    genre: "modern-minimal",
    paperBand: "dark",
    displayStyle: "grotesk-sans",
    accentHue: "cool",
    fonts: {
      display: "Space Grotesk, sans-serif",
      body: "Inter, sans-serif",
      mono: "Space Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.14 0.02 250)",
      ink: "oklch(0.95 0.01 250)",
      accent: "oklch(0.62 0.24 255)",
      muted: "oklch(0.60 0.02 250)",
      border: "oklch(0.28 0.03 250)",
    },
    description: "Deep blue-black precision theme for APIs, infrastructure, and technical products.",
  },
  {
    id: "lumen",
    name: "Lumen",
    genre: "editorial",
    paperBand: "light",
    displayStyle: "classical-serif",
    accentHue: "warm",
    fonts: {
      display: "Instrument Serif, serif",
      body: "Newsreader, serif",
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.98 0.01 85)",
      ink: "oklch(0.20 0.02 60)",
      accent: "oklch(0.55 0.18 45)",
      muted: "oklch(0.50 0.02 60)",
      border: "oklch(0.88 0.02 85)",
    },
    description: "Luminous, high-contrast editorial theme for reasoning tools and long-form writing.",
  },
  {
    id: "hum",
    name: "Hum",
    genre: "playful",
    paperBand: "light",
    displayStyle: "rounded-sans",
    accentHue: "warm",
    fonts: {
      display: "Plus Jakarta Sans, sans-serif",
      body: "Outfit, sans-serif",
      mono: "Space Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.97 0.02 95)",
      ink: "oklch(0.22 0.03 80)",
      accent: "oklch(0.68 0.18 55)",
      muted: "oklch(0.55 0.03 85)",
      border: "oklch(0.89 0.03 95)",
    },
    description: "Warm, human, tactile theme for consumer apps, food, and craft products.",
  },
  {
    id: "specimen",
    name: "Specimen",
    genre: "editorial",
    paperBand: "light",
    displayStyle: "high-contrast-serif",
    accentHue: "warm",
    fonts: {
      display: "Playfair Display, serif",
      body: "Lora, serif",
      mono: "Fira Code, monospace",
    },
    tokens: {
      paper: "oklch(0.97 0.01 80)",
      ink: "oklch(0.18 0.02 50)",
      accent: "oklch(0.50 0.16 30)",
      muted: "oklch(0.52 0.02 60)",
      border: "oklch(0.86 0.02 80)",
    },
    description: "Classic typographic specimen layout with high-contrast serif headers.",
  },
  {
    id: "studio",
    name: "Studio",
    genre: "atmospheric",
    paperBand: "mid",
    displayStyle: "high-contrast-serif",
    accentHue: "chromatic-other",
    fonts: {
      display: "DM Serif Display, serif",
      body: "DM Sans, sans-serif",
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.88 0.02 140)",
      ink: "oklch(0.18 0.03 140)",
      accent: "oklch(0.42 0.15 145)",
      muted: "oklch(0.48 0.03 140)",
      border: "oklch(0.78 0.03 140)",
    },
    description: "Atmospheric sage-tinted studio theme for architecture, interior, and craft studios.",
  },
  {
    id: "garden",
    name: "Garden",
    genre: "atmospheric",
    paperBand: "light",
    displayStyle: "roman-serif",
    accentHue: "chromatic-other",
    fonts: {
      display: "Fraunces, serif",
      body: "Source Serif 4, serif",
      mono: "Space Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.96 0.02 120)",
      ink: "oklch(0.20 0.04 130)",
      accent: "oklch(0.45 0.14 135)",
      muted: "oklch(0.52 0.03 125)",
      border: "oklch(0.87 0.03 120)",
    },
    description: "Earth-toned, organic theme for farms, botanical products, and natural goods.",
  },
  {
    id: "riso",
    name: "Riso",
    genre: "playful",
    paperBand: "light",
    displayStyle: "risograph-bold",
    accentHue: "warm",
    fonts: {
      display: "Cabinet Grotesk, sans-serif",
      body: "Satoshi, sans-serif",
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.96 0.02 75)",
      ink: "oklch(0.18 0.03 40)",
      accent: "oklch(0.62 0.25 25)",
      muted: "oklch(0.52 0.04 50)",
      border: "oklch(0.85 0.04 75)",
    },
    description: "Risograph-printed aesthetic with bright spot colors and tactile paper feel.",
  },
  {
    id: "terminal",
    name: "Terminal",
    genre: "modern-minimal",
    paperBand: "dark",
    displayStyle: "mono",
    accentHue: "chromatic-other",
    fonts: {
      display: "JetBrains Mono, monospace",
      body: "IBM Plex Mono, monospace",
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.12 0.01 160)",
      ink: "oklch(0.92 0.02 160)",
      accent: "oklch(0.78 0.22 145)",
      muted: "oklch(0.58 0.02 160)",
      border: "oklch(0.25 0.03 160)",
    },
    description: "Monospace phosphor-green dev theme for CLI tools and technical utilities.",
  },
  {
    id: "brutal",
    name: "Brutal",
    genre: "modern-minimal",
    paperBand: "light",
    displayStyle: "display-heavy",
    accentHue: "neutral",
    fonts: {
      display: "Uncut Sans, sans-serif",
      body: "General Sans, sans-serif",
      mono: "Space Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.98 0.00 0)",
      ink: "oklch(0.10 0.00 0)",
      accent: "oklch(0.15 0.00 0)",
      muted: "oklch(0.50 0.00 0)",
      border: "oklch(0.15 0.00 0)",
    },
    description: "High-contrast black-and-white brutalist theme with heavy borders and thick rules.",
  },
];

/** Find theme by ID or name */
export function getThemeById(idOrName: string): HallmarkTheme | undefined {
  const norm = idOrName.toLowerCase().trim();
  return HALLMARK_THEMES.find(
    (t) => t.id.toLowerCase() === norm || t.name.toLowerCase() === norm
  );
}

/** Get next rotated theme based on previous theme ID */
export function getRotatedTheme(lastThemeId?: string): HallmarkTheme {
  if (!lastThemeId) return HALLMARK_THEMES[0];
  const lastIndex = HALLMARK_THEMES.findIndex(
    (t) => t.id.toLowerCase() === lastThemeId.toLowerCase()
  );
  if (lastIndex === -1) return HALLMARK_THEMES[0];
  return HALLMARK_THEMES[(lastIndex + 1) % HALLMARK_THEMES.length];
}

/** Generate a custom OKLCH theme for creative briefs */
export function createCustomTheme(
  briefName: string,
  primaryColorOkLch: string,
  displayFont: string,
  bodyFont: string
): HallmarkTheme {
  const slug = briefName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `custom-${slug}`,
    name: `Custom (${briefName})`,
    genre: "modern-minimal",
    paperBand: "light",
    displayStyle: "grotesk-sans",
    accentHue: "warm",
    fonts: {
      display: displayFont,
      body: bodyFont,
      mono: "JetBrains Mono, monospace",
    },
    tokens: {
      paper: "oklch(0.98 0.01 90)",
      ink: "oklch(0.18 0.02 50)",
      accent: primaryColorOkLch,
      muted: "oklch(0.52 0.02 60)",
      border: "oklch(0.86 0.02 85)",
    },
    description: `Made-to-measure custom theme generated for ${briefName}.`,
  };
}

/** Format CSS tokens string from theme */
export function renderTokensCss(theme: HallmarkTheme): string {
  return `/* Hallmark Theme: ${theme.name} (${theme.id}) */
:root {
  /* Colors */
  --color-paper: ${theme.tokens.paper};
  --color-ink: ${theme.tokens.ink};
  --color-accent: ${theme.tokens.accent};
  --color-muted: ${theme.tokens.muted};
  --color-border: ${theme.tokens.border};

  /* Typography */
  --font-display: ${theme.fonts.display};
  --font-body: ${theme.fonts.body};
  --font-mono: ${theme.fonts.mono || "monospace"};

  /* Radii - strictly anti-slop */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 4px;
}
`;
}
