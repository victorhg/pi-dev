/**
 * Type definitions for @victorhg/pi-hallmark extension and skill.
 */

export interface SlopGateViolation {
  gateId: number;
  category:
    | "color-and-theme"
    | "typography"
    | "layout-and-space"
    | "microinteractions"
    | "content-and-copy"
    | "component-craft";
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  file?: string;
  line?: number;
  snippet?: string;
}

export interface HallmarkCritiqueScores {
  philosophy: number;   // 1-5
  hierarchy: number;    // 1-5
  execution: number;    // 1-5
  specificity: number;  // 1-5
  restraint: number;    // 1-5
  variety: number;      // 1-5
}

export interface HallmarkAuditResult {
  target: string;
  scores: HallmarkCritiqueScores;
  overallScore: number; // 0-100
  violations: SlopGateViolation[];
  passedGatesCount: number;
  totalGatesEvaluated: number;
  createdAt: string;
  slug: string;
}

export interface HallmarkTheme {
  id: string;
  name: string;
  genre: "editorial" | "modern-minimal" | "playful" | "atmospheric";
  paperBand: "dark" | "mid" | "light";
  displayStyle:
    | "high-contrast-serif"
    | "roman-serif"
    | "classical-serif"
    | "geometric-sans"
    | "grotesk-sans"
    | "rounded-sans"
    | "mono"
    | "display-condensed"
    | "display-heavy"
    | "risograph-bold";
  accentHue: "warm" | "cool" | "neutral" | "chromatic-other";
  fonts: {
    display: string;
    body: string;
    mono?: string;
  };
  tokens: {
    paper: string;
    ink: string;
    accent: string;
    muted: string;
    border: string;
  };
  description: string;
}

export interface HallmarkMacrostructure {
  id: string;
  number: string; // e.g. "01", "02"
  name: string;
  category: "grid" | "document" | "poster" | "workflow" | "studio" | "index" | "playground";
  description: string;
  recommendedGenres: string[];
  heroArchetype: string;
  sectionsRhythm: string[];
}

export interface DesignDNA {
  macrostructure: string;
  genre: string;
  paperTone: string;
  displayFont: string;
  bodyFont: string;
  accentColor: string;
  navArchetype: string;
  footerArchetype: string;
  keyArchetypes: string[];
  extractedFrom: string;
}

export interface HallmarkStudyResult {
  target: string;
  mode: "url" | "image";
  dna: DesignDNA;
  diagnosis: string;
  createdAt: string;
}

export interface HallmarkRedesignResult {
  target: string;
  currentFingerprint: string;
  proposedMacrostructure: HallmarkMacrostructure;
  proposedTheme: HallmarkTheme;
  proposedNav: string;
  proposedFooter: string;
  preservedElements: string[];
  redesignPlan: string[];
  createdAt: string;
}

export interface HallmarkGenerateResult {
  brief: string;
  isComponentScope: boolean;
  macrostructure: HallmarkMacrostructure | null;
  theme: HallmarkTheme;
  navArchetype?: string;
  footerArchetype?: string;
  enrichment: string;
  critiqueStamp: string;
  tokensCss: string;
  structureSummary: string;
  createdAt: string;
}
