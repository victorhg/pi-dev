/**
 * Macrostructures catalog for Hallmark.
 * Encapsulates the 21 distinct macrostructures to guarantee structural variety.
 */

import type { HallmarkMacrostructure } from "./types.js";

export const HALLMARK_MACROSTRUCTURES: HallmarkMacrostructure[] = [
  {
    id: "bento-grid",
    number: "01",
    name: "Bento Grid",
    category: "grid",
    description: "Asymmetric grid layout organizing multi-dimensional feature sets.",
    recommendedGenres: ["modern-minimal", "playful"],
    heroArchetype: "H1 Marquee or H8 Split Browser",
    sectionsRhythm: ["Hero", "Bento Grid (F1)", "Tabular Spec Sheet (F3)", "CTA (C2)", "Footer (Ft3)"],
  },
  {
    id: "long-document",
    number: "02",
    name: "Long Document",
    category: "document",
    description: "Single column editorial layout reading like an essay or whitepaper.",
    recommendedGenres: ["editorial", "atmospheric"],
    heroArchetype: "H5 Letter Hero or H3 Quote Led",
    sectionsRhythm: ["Masthead (N6)", "Title & Deck", "Body Column with Marginalia (T1)", "Inline Rule (Ft2)"],
  },
  {
    id: "marquee-hero",
    number: "03",
    name: "Marquee Hero",
    category: "poster",
    description: "Giant headline filling the fold with high-impact typography.",
    recommendedGenres: ["playful", "editorial"],
    heroArchetype: "H1 Marquee",
    sectionsRhythm: ["Full-width Marquee Title", "Split Diptych (H2)", "Feature Stack (F2)", "Marquee Scroll Footer (Ft8)"],
  },
  {
    id: "stat-led",
    number: "04",
    name: "Stat Led",
    category: "workflow",
    description: "Metric-first layout highlighting concrete real-world numbers.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "H4 Stat Led",
    sectionsRhythm: ["Hero Stat Stack", "Numbered Stat Strip (T4)", "Product Cards (F6)", "Footer (Ft1)"],
  },
  {
    id: "workbench",
    number: "05",
    name: "Workbench",
    category: "workflow",
    description: "Interactive workspace view showcasing live UI preview or terminal command.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "H8 Mockup Split Browser or N8 Terminal",
    sectionsRhythm: ["Terminal Nav (N8)", "Interactive Workbench", "Annotated Screenshot (F5)", "Footer (Ft4)"],
  },
  {
    id: "conversational-faq",
    number: "06",
    name: "Conversational FAQ",
    category: "document",
    description: "Q&A structured layout designed around dialogue and inquiry.",
    recommendedGenres: ["editorial", "playful"],
    heroArchetype: "H3 Quote Led",
    sectionsRhythm: ["Hero Title", "Question / Answer Stack", "Inline Form CTA (C2)", "Footer"],
  },
  {
    id: "manifesto",
    number: "07",
    name: "Manifesto",
    category: "poster",
    description: "Bold declarative layout articulating vision, principles, and stance.",
    recommendedGenres: ["editorial", "atmospheric"],
    heroArchetype: "H1 Marquee or H3 Quote Led",
    sectionsRhythm: ["Full-width Stance Title", "Principles Stack", "Statement Close (Ft5)"],
  },
  {
    id: "photographic",
    number: "08",
    name: "Photographic",
    category: "studio",
    description: "Atmospheric full-bleed image background and photographic fold.",
    recommendedGenres: ["atmospheric"],
    heroArchetype: "H6 Photographic Fold",
    sectionsRhythm: ["Photo Hero Fold", "Left Margin Numbered (S1)", "Minimal Footer (Ft2)"],
  },
  {
    id: "quote-led",
    number: "09",
    name: "Quote Led",
    category: "poster",
    description: "Prominent testimonial or quote driving editorial authority.",
    recommendedGenres: ["editorial"],
    heroArchetype: "H3 Quote Led",
    sectionsRhythm: ["Large Quote Hero", "Pull Quote Marginalia (T1)", "Single Huge Quote (T3)", "Footer"],
  },
  {
    id: "specimen",
    number: "10",
    name: "Specimen",
    category: "studio",
    description: "Typography specimen showcase highlighting typefaces and scales.",
    recommendedGenres: ["editorial"],
    heroArchetype: "H1 Marquee",
    sectionsRhythm: ["Alphabet & Scale Display", "Type Pairs Specimen", "Footer"],
  },
  {
    id: "catalogue",
    number: "11",
    name: "Catalogue",
    category: "index",
    description: "Dense grid of items, products, or archive entries.",
    recommendedGenres: ["modern-minimal", "atmospheric"],
    heroArchetype: "H6 Photographic Fold",
    sectionsRhythm: ["Category Index Header", "Product Card Grid (F6)", "Index List Footer (Ft3)"],
  },
  {
    id: "letter",
    number: "12",
    name: "Letter",
    category: "document",
    description: "Personal note from founder or maker written in direct letter format.",
    recommendedGenres: ["editorial", "playful"],
    heroArchetype: "H5 Letter Hero",
    sectionsRhythm: ["Salutation & Letter Body", "Signature & Close (Ft6)"],
  },
  {
    id: "index-first",
    number: "13",
    name: "Index First",
    category: "index",
    description: "Directory-style list with dense categories and instant lookup.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "N13 Inline CMDK Pill",
    sectionsRhythm: ["CMDK Pill Nav", "Directory Table Index", "Footer"],
  },
  {
    id: "narrative-workflow",
    number: "14",
    name: "Narrative Workflow",
    category: "workflow",
    description: "Step-by-step sequential storytelling layout.",
    recommendedGenres: ["modern-minimal", "editorial"],
    heroArchetype: "H2 Split Diptych",
    sectionsRhythm: ["Hero Overview", "Step Sequence (F4)", "Sticky Scroll Stack (F2)", "CTA", "Footer"],
  },
  {
    id: "split-studio",
    number: "15",
    name: "Split Studio",
    category: "studio",
    description: "Two-column split view contrasting philosophy and work showcase.",
    recommendedGenres: ["atmospheric", "editorial"],
    heroArchetype: "H2 Split Diptych",
    sectionsRhythm: ["50/50 Split Diptych", "Project Showcase", "Footer"],
  },
  {
    id: "feature-stack",
    number: "16",
    name: "Feature Stack",
    category: "grid",
    description: "Vertical stacking of full-width feature cards with sticky progression.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "H8 Split Browser",
    sectionsRhythm: ["Sticky Scroll Stack (F2)", "Annotated Screenshot (F5)", "Footer"],
  },
  {
    id: "type-specimen",
    number: "17",
    name: "Type Specimen",
    category: "studio",
    description: "Design studio type specimen displaying weights, glyphs, and pairings.",
    recommendedGenres: ["editorial"],
    heroArchetype: "H1 Marquee",
    sectionsRhythm: ["Type Scale Showcase", "Tabular Spec Sheet (F3)", "Footer"],
  },
  {
    id: "portfolio-grid",
    number: "18",
    name: "Portfolio Grid",
    category: "index",
    description: "Masonry or tight grid presenting creative portfolio works.",
    recommendedGenres: ["atmospheric", "playful"],
    heroArchetype: "H6 Photographic Fold",
    sectionsRhythm: ["Header & Intro", "Product/Project Card Grid (F6)", "Footer"],
  },
  {
    id: "map-diagram",
    number: "19",
    name: "Map Diagram",
    category: "playground",
    description: "Diagrammatic layout depicting architecture, map, or network flow.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "H8 Mockup Split Browser",
    sectionsRhythm: ["Interactive Diagram Container", "Annotated Notes", "Footer"],
  },
  {
    id: "ecosystem-index",
    number: "20",
    name: "Ecosystem Index",
    category: "index",
    description: "Multi-category hub linking plugins, modules, or integrations.",
    recommendedGenres: ["modern-minimal"],
    heroArchetype: "N13 Inline CMDK Pill",
    sectionsRhythm: ["Filter Bar", "Index-style Category List (Ft3)", "Footer"],
  },
  {
    id: "component-playground",
    number: "21",
    name: "Component Playground",
    category: "playground",
    description: "Interactive showcase with 8-state live components and controls.",
    recommendedGenres: ["modern-minimal", "playful"],
    heroArchetype: "H8 Mockup Split Browser",
    sectionsRhythm: ["Component Controls Header", "8-State Interactive Wrapper", "Tokens CSS Viewer"],
  },
];

/** Select macrostructure by ID or name */
export function getMacrostructureById(idOrName: string): HallmarkMacrostructure | undefined {
  const norm = idOrName.toLowerCase().trim();
  return HALLMARK_MACROSTRUCTURES.find(
    (m) =>
      m.id.toLowerCase() === norm ||
      m.number === norm ||
      m.name.toLowerCase() === norm
  );
}

/** Get next macrostructure rotated from last selection */
export function getRotatedMacrostructure(lastId?: string): HallmarkMacrostructure {
  if (!lastId) return HALLMARK_MACROSTRUCTURES[0];
  const lastIdx = HALLMARK_MACROSTRUCTURES.findIndex(
    (m) => m.id.toLowerCase() === lastId.toLowerCase()
  );
  if (lastIdx === -1) return HALLMARK_MACROSTRUCTURES[0];
  return HALLMARK_MACROSTRUCTURES[(lastIdx + 1) % HALLMARK_MACROSTRUCTURES.length];
}
