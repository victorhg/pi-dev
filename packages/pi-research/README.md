# @victorhg/pi-research

Subject research and reference document generator for the Pi coding agent. Runs structured research loops producing citable, shareable Markdown documents.

## Features

- 🔬 **Structured Research Loop** — Planner → Researcher → Writer phases decompose topics into sub-questions, gather sources, and synthesize findings.
- 📄 **Self-Contained Documents** — Produces Markdown with overview, key concepts, findings with inline citations, references, and recommended next directions.
- 📊 **Source Credibility Scoring** — Automatically scores sources by domain (high/medium/low) and relevance.
- 🎨 **Status Bar Integration** — Registers with `@victorhg/pi-footer` to display `🔬 planning…` / `🔬 searching…` / `🔬 writing…` badges during the research loop.
- 📚 **Document Management** — Commands to list, open, and track all saved research documents.

## Commands

| Command | Description |
|---|---|
| `/research` | Open a multi-line editor dialog, describe your research topic, then launch the full research loop. |
| `/research:start <topic>` | Inline variant — topic passed directly as argument, no dialog. |
| `/research:status` | Show current phase, sub-questions, and sources collected. |
| `/research:list` | List all saved research documents with dates. |

### Typical flow

1. Type `/research` — an editor dialog opens.
2. Describe your topic (one line or several sentences).
3. Submit — the agent decomposes the topic into sub-questions, runs `web_search` + `fetch_content` for each, and synthesizes a Markdown document.
4. The output is saved to `research/<slug>.md`.

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
