---
name: critic-project
# prettier-ignore
description: Use when the user wants an honest, structured critique of the current project — covering software architecture quality, unmitigated risks, product coherence, and business process coverage.
compatibility:
  Works with any software or product project accessible in the working directory.
---

# Critic Project

Produce a direct, skeptical analysis of the current project. Do not
soften findings. Surface what is genuinely fragile or missing, then
close with sharp questions that help the user prioritise.

## Workflow

1. **Orient** — read `README.md`, `package.json` (or equivalent
   manifest), `AGENTS.md`, and any `docs/` overview files to
   understand stated purpose and scope.
2. **Map the structure** — run `find` / `ls` to list top-level
   directories, packages, and entry points. Identify layers
   (API, domain, infra, UI, tests, config).
3. **Critique: Software** — evaluate architecture quality,
   unmitigated risks, and future improvement ceiling with evidence
   from the source tree.
4. **Critique: Product** — evaluate business process coverage and
   product coherence.
5. **Synthesise** — write the report and close with decision questions.

## Software critique dimensions

Assess each dimension; skip only if clearly not applicable.

**Architecture quality** — separation of concerns (are layers
well-bounded or tangled?), dependency direction (do lower layers
import upper ones?), cohesion vs coupling across packages/modules,
config and secrets management.

**Unmitigated risks** — missing or superficial error handling;
no observability (logging, tracing, metrics); untested critical paths;
security surface (exposed credentials, unvalidated inputs, unsafe
deps); operational gaps (no health checks, graceful shutdown, or
deployment docs). Rank each finding: high / medium / low.

**Future improvement ceiling** — scalability bottlenecks (tight
coupling, lack of async, shared mutable state); extensibility (how
hard is the next feature?); tech-debt signals (stale inline markers,
deprecated deps, dead code); documentation gaps that would block a
new contributor.

## Product critique dimensions

**Business process coverage** — which workflows does the product
cover end-to-end? Which obvious workflows are absent or half-built?
Are there orphaned features with no clear user journey?

**Product coherence** — is the value proposition clear and singular?
Are existing features consistent in mental model and UX? Are there
contradictory abstractions or overlapping concepts? What is missing
for this to be a complete, shippable product?

## Report format

Write the report as a Markdown document with these sections in order:
`Project Critique: ProjectName` as the H2 title, then **Software** (H3)
containing three bold subsections — *Architecture quality*,
*Unmitigated risks*, *Future improvement ceiling* — followed by
**Product** (H3) with *Business process coverage* and *Product
coherence*, then a **Summary verdict** (H3) of 2–4 frank sentences,
and finally **Decision questions** (H3): exactly four numbered
questions — one forcing a tradeoff or surfacing a hidden assumption,
one targeting the riskiest gap, one about product direction or scope,
one about what success actually looks like.

## Tone rules

- Be direct and skeptical. Replace "you may want to consider" with
  "this is missing" or "this will break under X".
- Cite specific files, directories, or patterns as evidence.
- Do not invent problems not visible in the source; flag uncertainty
  with "no evidence of X — confirm manually".
- Bullet points over prose. Keep each section tight.
