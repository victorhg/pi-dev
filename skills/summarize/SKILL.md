---
name: summarize
# prettier-ignore
description: Use when the user requests a summary, insights, or key learning points from the current session for export to another tool.
---

# Summarize Session

Use this skill to extract session insights and learning points.

## Workflow

1. Use `/summarize` to trigger the summary generation.
2. The model will analyze the conversation history.
3. Review the output for key insights and actionable items, following a format similar to `/compact`.

## Project conventions

- Ensure the summary output is structured clearly for export.
- If specific fields or formats are required by the downstream tool, mention them in the prompt.
