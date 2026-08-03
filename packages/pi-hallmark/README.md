# @victorhg/pi-hallmark

Anti-AI-slop design skill and extension for the Pi coding agent. Guarantees structural and visual variety for greenfield pages, design audits, redesigns, and design extraction from screenshots or URLs.

Based on the [Hallmark specification](https://github.com/Nutlope/hallmark).

## Features

- **Anti-AI-Slop Design System**: Refuses generic LLM defaults (purple/blue gradients, symmetric 3-card grids, >4px border-radius, Inter/Roboto display stacks, re-drawn browser chrome, and invented metrics).
- **Four Verbs**:
  - `(default)`: Greenfield build picking a macrostructure, catalog/custom theme, and 57 slop-test gates.
  - `hallmark audit <target>`: Static analysis audit scoring code on 6 critique axes (Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety) with punch-list generation.
  - `hallmark redesign <target>`: Structural redesign preserving existing routes, copy, and information architecture.
  - `hallmark study <url|image>`: Extracts design DNA (macrostructure, color anchor, font pairings, archetypes) without copying pixels.
- **Reference Catalog**: Complete set of 105 reference files under `references/` covering 21 macrostructures, 20 named themes, component archetypes (H1-H9, N1-N13, F1-F6, Ft1-Ft8, S1-S5, C1-C4, T1-T4), genres, interaction states, and responsive rules.
- **Custom Tools**: Exposes `hallmark:audit`, `hallmark:generate`, `hallmark:study`, and `hallmark:redesign` to the Pi agent.
- **Slash Commands**:
  - `/hallmark:audit [target]` — Run an anti-slop audit on code files and save report.
  - `/hallmark:generate [brief]` — Select macrostructure, theme, and tokens for a brief.
  - `/hallmark:study [target]` — Extract design DNA from a URL or reference image.
  - `/hallmark:status` — Show last audit score and session theme selections.
- **Status Bar Integration**: Displays a live badge (`🎨 Hallmark` or `🎨 92%`) when paired with `@victorhg/pi-footer`.

## Installation

```bash
pi install @victorhg/pi-hallmark
```

## Reference Structure

All reference guides and rules live in `references/`:

- `references/slop-test.md`: 57 slop-test gates & pre-emit critique scoring.
- `references/macrostructures/`: 21 distinct macrostructure definitions (`01-bento-grid.md` to `21-component-playground.md`).
- `references/themes/`: Theme catalog definitions (`carnival.md`, `cobalt.md`, `lumen.md`, `hum.md`, etc.).
- `references/components/`: Hero, nav, feature, section, footer, CTA, and text component recipes.
- `references/genres/`: Editorial, modern-minimal, playful, and atmospheric genres.
- `references/anti-patterns.md`: Detailed slop triggers and forbidden code markers.

## Commands

| Command | Description |
|---|---|
| `/hallmark:audit [target]` | Score target code against 57 slop-test gates. |
| `/hallmark:generate [brief]` | Generate theme, macrostructure, and OKLCH CSS tokens for a brief. |
| `/hallmark:study [target]` | Extract design DNA from URL or reference screenshot. |
| `/hallmark:status` | Show last audit score and critique axis breakdown. |
