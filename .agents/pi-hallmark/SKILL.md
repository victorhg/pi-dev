# pi-hallmark

description: A skill to enforce anti-AI-slop design principles and perform design audits on generated code.

Use when:
- Designing new web frontends to avoid common AI design tropes (e.g., generic hero sections, excessive rounded corners, monochromatic palettes).
- Auditing existing code for "AI-slop" markers.
- Applying distinct macrostructures to new components.

## Design Constraints (The "Slop-Test Gates")
- No generic purple/blue gradients.
- Avoid standard 3-card grid layouts.
- Reject overly-rounded UI components (border-radius > 4px).
- Mandate distinct typography stacks beyond Inter/Roboto.
- Require specific, non-pastel color palettes.

## Commands
- `hallmark audit <file-path>`: Flags code markers that look like generic AI outputs.
- `hallmark generate <project-brief>`: Generates a landing page using a unique macrostructure and theme.
