# pi-token-saver

Intelligent bash output filtering, workspace file compression, and model cost auditing to reduce token consumption and API costs.

## Optional: Footer integration

Install `@victorhg/pi-footer` alongside this package to display a live `💰xKB`
cumulative savings metric in the Pi status bar. Without it, the extension
works normally but the metric is not visible.

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-footer/src/index.ts",
      "@victorhg/pi-token-saver/dist/pi-hook.js"
    ]
  }
}
```

## Installation

```bash
pnpm add ./packages/pi-token-saver
```

## Configuration

To activate the extension, add it to your Pi configuration file:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-token-saver/dist/pi-hook.js"
    ]
  }
}
```

## Features

- **Semantic Compaction**: Parses raw outputs for Git commands, directory listings, search utilities, and installers to generate compact, highly semantic summaries instead of simple line truncation.
- **Secret Redaction**: Automatically masks sensitive keys (OpenAI, GitHub, AWS, Bearer tokens, API keys) before output reaches the LLM context.
- **Tier-2 Test Runner Filter**: Aggregates pass/fail counts for test runners (`pytest`, `cargo test`, `vitest`, `jest`, etc.) and isolates failure traces.
- **Tier-2 Build & Compiler Filter**: Strips compiler boilerplate, retaining only errors and warnings with file/line references.
- **Tee Recovery System**: Automatically saves raw command output on failures (non-zero exits) to `~/.pi/agent/token-saver/tee/` and appends a hint line with the file path, so the agent can read full logs if needed.
- **Safety Guards**: Automatically bypasses filtering for command chains (`&&`, `;`), output redirection (`>`), piping (`|`), binary payloads, or very short outputs.
- **Persistent Analytics**: Tracks running token/byte savings across sessions inside a lightweight local JSON store (`~/.pi/agent/token-saver/savings.json`).
- **Footer Integration**: Displays a `💰xKB` cumulative metric in the status bar (integrating with `@victorhg/pi-footer` if present).
- **Passthrough Mode**: Bypass filtering for the next command whenever full original output is required.
- **Workspace File Compression**: Scans workspace `.md` files (AGENTS.md, MEMORY.md, SOUL.md, etc.) and shows token savings from AI-efficient notation — these files are sent with *every* prompt so compressing them reduces costs on every API call.
- **Model Audit**: Detects the current AI model, estimates monthly costs, and suggests cheaper alternatives with specific dollar savings.

## Commands

| Command | Description |
|---|---|
| `token-saver:savings` | Show cumulative persistent KB saved and number of filtered runs. |
| `token-saver:history` | Show a breakdown of the last 30 filtered commands with saved sizes. |
| `token-saver:clear` | Purge persistent history and reset savings tracking. |
| `token-saver:passthrough` | Bypass filtering for the next bash command (useful for debugging). |
| `token-saver:compress` | Scan workspace `.md` files and show token savings from AI-efficient notation compression. |
| `token-saver:audit` | Audit current AI model, estimate monthly costs, and suggest cheaper alternatives. |

## Usage

Once installed, the extension automatically intercepts bash command output. No manual steps are needed — filtered commands accumulate savings silently in the background.

To view savings at any time, use the commands above. If `@victorhg/pi-footer` is also installed, the running total appears in the footer automatically.

### Filtered commands (built-in rules)

| Command pattern | Compaction strategy | Typical reduction |
|---|---|---|
| `git status` | Emoji-annotated file status grouping (staged, modified, untracked, conflicts) with inline file limits. | ~85% |
| `git diff` | Reduced hunk contexts, binary file skipping, file changes overview, and change statistics. | ~80% |
| `git log` | Compact commit oneline view showing hash and truncated subject, limited to 20 lines. | ~90% |
| `ls` / `find` / `fd` / `tree` | High-noise directory filtering (`node_modules`, etc.), directory file counts, and extension overview. | ~80% |
| `rg` / `grep` | File-grouped matching with match caps and file summary. | ~80% |
| `pytest` / `cargo test` / `jest` / etc. | Aggregates pass/fail counts, isolates failure traces and errors. | ~90% |
| `cargo build` / `go build` / `tsc` / etc. | Strips boilerplate, retains error/warning lines with file references. | ~90% |
| `npm` / `pnpm` / `yarn` / `bun` install | Single success summary line preserving warnings/errors and vulnerabilities. | ~90% |

### Workspace compression patterns

The `token-saver:compress` command scans workspace `.md` files for verbose patterns and converts them to AI-efficient notation:

- `When X, I should Y` → `X → Y`
- `If X, then Y` → `X ? Y`
- `in order to` → `to`
- `as well as` → `&`
- `due to the fact that` → `because`
- `a wide variety of` → `various`
- Collapses redundant filler phrases and bullet prefixes
- File-type specific patterns for AGENTS.md, MEMORY.md, and USER.md

### Model audit

The `token-saver:audit` command detects the active model, estimates monthly cost based on typical coding-agent usage (15K input + 2K output tokens/turn, 50 turns/day), and suggests downgrade paths (e.g., Opus → Sonnet, GPT-4o → GPT-4o Mini) with dollar estimates.
