# @victorhg/pi-hallmark

Anti-AI-slop design skill and extension for the Pi coding agent. Guarantees structural and visual variety for greenfield pages, design audits, redesigns, and design extraction from screenshots or URLs.

Based on the [Hallmark specification](https://github.com/Nutlope/hallmark).

## Features

- **Anti-AI-Slop Design System**: Refuses generic LLM defaults (purple/blue gradients, symmetric 3-card grids, >4px border-radius, Inter/Roboto display stacks, re-drawn browser chrome, and invented metrics).
- **Four Core Verbs**:
  - `(default)`: Greenfield builds with macrostructure selection, catalog/custom OKLCH themes, and 57 slop-test gates.
  - `hallmark audit <target>`: Static analysis audit scoring code on 6 critique axes (Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety) with a punch list.
  - `hallmark redesign <target>`: Structural redesign preserving existing routes, copy, and information architecture.
  - `hallmark study <url|image>`: Extracts design DNA (macrostructure, color anchor, font pairings, archetypes) without copying pixels.
- **Reference Catalog**: 105 reference files under `references/` covering 21 macrostructures, 20 named themes, component recipes (H1–H9, N1–N13, F1–F6, Ft1–Ft8, S1–S5, C1–C4, T1–T4), genres, interaction states, and responsive rules.
- **Custom Tools**: Exposes `hallmark:audit`, `hallmark:generate`, `hallmark:study`, and `hallmark:redesign` to the Pi agent.
- **Slash Commands**: `/hallmark:audit`, `/hallmark:generate`, `/hallmark:study`, `/hallmark:status`.
- **Status Bar Integration**: Displays a live badge (`🎨 Hallmark` or `🎨 92%`) when paired with `@victorhg/pi-footer`.

## Installation

```bash
pi install @victorhg/pi-hallmark
```

## How to Use

`@victorhg/pi-hallmark` works both as a natural-language skill for Pi and as a set of slash commands and tools.

### 1. Greenfield Builds (Default Flow)

Ask Pi to design or build a new page, landing page, or web application:

```text
"Build a landing page for a developer observability platform using Hallmark principles."
"Design a portfolio site for a ceramics studio."
```

**What Hallmark does:**
1. Scans existing project tokens and typography (Pre-flight).
2. Detects brief genre (editorial, modern-minimal, atmospheric, or playful).
3. Selects a distinct **Macrostructure** (e.g. Bento Grid `01`, Stat Led `04`, Marquee Hero `03`).
4. Selects a **Theme** from the 20 catalog themes (e.g., Cobalt, Lumen, Carnival, Hum) or constructs a custom OKLCH theme for explicit creative briefs.
5. Picks unique Nav (N1–N13) and Footer (Ft1–Ft8) archetypes.
6. Emits CSS variables (`tokens.css`) and clean HTML/JSX/CSS code adhering to all 57 slop-test gates.

### 2. Auditing Existing Code (`hallmark audit`)

Score existing HTML, CSS, JSX, or TSX files against Hallmark's 57 slop-test gates and anti-patterns:

- **Via Natural Language:**
  ```text
  "Audit src/pages/index.tsx for AI slop."
  "Run Hallmark audit on the current workspace."
  ```
- **Via Slash Command:**
  ```bash
  /hallmark:audit src/components/Hero.tsx
  /hallmark:audit
  ```

**What it returns:**
- Scores (1–5) across six critique axes: **P**hilosophy, **H**ierarchy, **E**xecution, **S**pecificity, **R**estraint, **V**ariety.
- Overall Design Health Score (0–100%).
- Slop Gate Punch List highlighting exact file locations and code snippets violating design rules (e.g., purple/blue gradients, excessive border-radius >4px, bare `1fr` grids, invented metrics).
- Saves a report to `hallmark-audit-<slug>.md`.

### 3. Redesigning Existing UI (`hallmark redesign`)

Redesign the visual structure and section rhythm of an existing page while preserving its route structure, copy, and information architecture:

```text
"hallmark redesign src/pages/Landing.tsx --mood editorial"
"Redesign our pricing page to have a Bento Grid layout without changing the text."
```

**What Hallmark does:**
- Preserves existing routes, component ownership, copy, and brand assets.
- Replaces section rhythm, hero layout, and typography hierarchy.
- Re-Dresses the interface using a different structural fingerprint.

### 4. Extracting Design DNA (`hallmark study`)

Analyze a live web URL or screenshot to extract its structural and visual DNA without cloning pixels or violating copyright:

- **Via Natural Language:**
  ```text
  "hallmark study https://stripe.com"
  "Study this screenshot and extract its design DNA."
  ```
- **Via Slash Command:**
  ```bash
  /hallmark:study https://linear.app
  ```

**What it returns:**
- Extracted **DNA Fingerprint**: Macrostructure, genre, paper tone, display/body fonts, accent color anchor, nav archetype, and key component recipes.
- Diagnosis report with three follow-up choices: build a new page with the DNA, lock the DNA into a portable `design.md` file, or keep findings for reference.

### 5. Component Scope

When asking Pi for a single UI element (e.g., "Build a primary button", "Create a card component"):
- Hallmark skips full-page macrostructures, navs, and footers.
- Enforces code for **all 8 interactive states**: default, hover, focus-visible, active, disabled, loading, error, and success.

---

## Slash Commands Summary

| Command | Usage Example | Description |
|---|---|---|
| `/hallmark:audit [target]` | `/hallmark:audit src/App.tsx` | Run static anti-slop audit and save report. |
| `/hallmark:generate [brief]` | `/hallmark:generate SaaS landing page` | Select macrostructure, theme, and CSS tokens. |
| `/hallmark:study [target]` | `/hallmark:study https://example.com` | Extract design DNA from URL or reference. |
| `/hallmark:status` | `/hallmark:status` | Show last audit score and session statistics. |

---

## Agent Tools Reference

Pi agent automatically invokes these tools during chat sessions:

- `hallmark:audit`: Audits target file or sample code snippet.
- `hallmark:generate`: Generates theme, macrostructure, and OKLCH CSS variables for a brief.
- `hallmark:study`: Extracts design DNA from URLs or HTML samples.
- `hallmark:redesign`: Prepares redesign plans for existing code.

---

## Reference Catalog Index

All reference files live under `references/`:

- `references/slop-test.md`: 57 slop-test gates & pre-emit critique scoring.
- `references/macrostructures/`: 21 distinct macrostructure guides (`01-bento-grid.md` through `21-component-playground.md`).
- `references/themes/`: 20 named themes (`carnival.md`, `cobalt.md`, `lumen.md`, `hum.md`, etc.).
- `references/components/`: Component recipes for heroes (H1–H9), navs (N1–N13), features (F1–F6), footers (Ft1–Ft8), section dividers (S1–S5), CTAs (C1–C4), and typography (T1–T4).
- `references/genres/`: Editorial, modern-minimal, playful, and atmospheric guides.
- `references/anti-patterns.md`: Detailed anti-patterns and forbidden AI tells.
