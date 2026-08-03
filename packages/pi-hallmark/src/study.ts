/**
 * Design DNA study extractor for Hallmark (`hallmark study <target>`).
 * Analyzes HTML/URL content to extract visual and structural DNA without copying pixels.
 */

import type { DesignDNA, HallmarkStudyResult } from "./types.js";
import { slugify } from "./audit.js";

/** Extract Design DNA from target string / HTML */
export function extractDesignDNA(input: string, sourceName: string): DesignDNA {
  const isUrl = /^https?:\/\//i.test(sourceName);

  // Infer fonts from input
  const fontDisplayMatch = input.match(/font-family\s*:\s*([^;,}]+)/i);
  const displayFont = fontDisplayMatch ? fontDisplayMatch[1].trim() : "Instrument Serif, serif";

  // Infer colors from input
  const colorMatch = input.match(/(#([0-9a-f]{3,8})|oklch\([^)]+\)|rgb\([^)]+\))/i);
  const accentColor = colorMatch ? colorMatch[1] : "oklch(0.65 0.20 40)";

  // Infer paper tone
  const isDark = /background(-color)?\s*:\s*(#0|#1|#2|black|oklch\(0\.[0-2])/i.test(input);
  const paperTone = isDark ? "dark (L < 20%)" : "light (L > 90%)";

  // Infer macrostructure based on structural signals
  let macrostructure = "Bento Grid (01)";
  if (/marquee|hero-title/i.test(input)) macrostructure = "Marquee Hero (03)";
  else if (/letter|dear|signed/i.test(input)) macrostructure = "Letter (12)";
  else if (/manifesto|principles/i.test(input)) macrostructure = "Manifesto (07)";
  else if (/stat|metric|\d+%/i.test(input)) macrostructure = "Stat Led (04)";

  return {
    macrostructure,
    genre: isDark ? "modern-minimal" : "editorial",
    paperTone,
    displayFont,
    bodyFont: "Inter, sans-serif",
    accentColor,
    navArchetype: "N5 Floating pill",
    footerArchetype: "Ft5 Statement",
    keyArchetypes: ["F1 Bento Grid", "T1 Marginalia", "C2 Inline Form"],
    extractedFrom: sourceName,
  };
}

/** Perform Study on target HTML/URL */
export function studyTarget(input: string, sourceName: string): HallmarkStudyResult {
  const isUrl = /^https?:\/\//i.test(sourceName);
  const dna = extractDesignDNA(input, sourceName);

  const diagnosis = `# Design DNA Study Report: ${sourceName}

## Extracted Fingerprint
- **Macrostructure:** ${dna.macrostructure}
- **Genre:** ${dna.genre}
- **Paper Tone:** ${dna.paperTone}
- **Display Font:** \`${dna.displayFont}\`
- **Body Font:** \`${dna.bodyFont}\`
- **Accent Color Anchor:** \`${dna.accentColor}\`
- **Nav Archetype:** ${dna.navArchetype}
- **Footer Archetype:** ${dna.footerArchetype}

## Key Component Archetypes
${dna.keyArchetypes.map((a) => `- ${a}`).join("\n")}

## Hallmark Handoff Options
1. **Build with DNA:** Apply this extracted macrostructure & color anchor to your new brief.
2. **Lock into \`design.md\`:** Save portable design specification file for handoff across tools.
3. **Stop at Diagnosis:** Use these findings for manual inspiration.
`;

  return {
    target: sourceName,
    mode: isUrl ? "url" : "image",
    dna,
    diagnosis,
    createdAt: new Date().toISOString(),
  };
}
