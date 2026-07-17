# @victorhg/pi-research

Subject research and reference document generator for the Pi coding agent. Runs structured research loops producing citable, shareable Markdown documents.

## Features

- 🔬 **Structured Research Loop** — Planner → Researcher → Writer phases decompose topics into sub-questions, gather sources, and synthesize findings.
- 📄 **Self-Contained Documents** — Produces Markdown with overview, key concepts, findings with inline citations, references, and recommended next directions.
- 📊 **Source Credibility Scoring** — Automatically scores sources by domain (high/medium/low) and relevance.
- 🎨 **Status Bar Integration** — Registers with `@victorhg/pi-footer` to display `🔬 planning…` / `🔬 searching…` / `🔬 writing…` badges during the research loop.
- 📚 **Document Management** — Commands to list, open, and track all saved research documents.

## Commands

- `/research:start <topic>` — Kick off a new research run: decompose topic into sub-questions, run web searches, and produce a structured document.
- `/research:status` — Show current research phase, topic, sub-questions, and sources collected.
- `/research:open [topic|slug]` — Display the latest (or specified) research document in the TUI.
- `/research:list` — List all saved research documents with metadata.

## Installation

Add the package as an extension in your `.pi-config.json` or global config:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-research/src/index.ts"
    ]
  }
}
```

## Output Format

Research documents are saved to `research/<slug>.md` with this structure:

```markdown
# <Topic>

> **Generated:** <ISO date>
> **Phase:** complete

## Overview
<Brief description>

## Key Concepts
<Definitions and relationships>

## Findings
### 1. <Sub-question>
<Answer with inline citations>

...

## References
1. <Title> — [<URL>](<URL>) (accessed <date>) [high|medium|low]

## Directions
<Open questions and recommended next steps>
```

## Peer Dependencies

- `@earendil-works/pi-coding-agent >= 0.1.0`
- Optional status bar integration: `@victorhg/pi-footer`
