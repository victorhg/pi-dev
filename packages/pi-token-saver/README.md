# pi-token-saver

Intelligent bash output filtering to reduce token consumption.

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
- **Tee Recovery System**: Automatically saves raw command output on failures (non-zero exits) to `~/.pi/agent/token-saver/tee/` and appends a hint line with the file path, so the agent can read full logs if needed.
- **Safety Guards**: Automatically bypasses filtering for command chains (`&&`, `;`), output redirection (`>`), piping (`|`), binary payloads, or very short outputs.
- **Persistent Analytics**: Tracks running token/byte savings across sessions inside a lightweight local JSON store (`~/.pi/agent/token-saver/savings.json`).
- **Footer Integration**: Displays a `💰xKB` cumulative metric in the status bar (integrating with `@victorhg/pi-footer` if present).
- **Passthrough Mode**: Bypass filtering for the next command whenever full original output is required.

## Commands

| Command | Description |
|---|---|
| `token-saver:savings` | Show cumulative persistent KB saved and number of filtered runs. |
| `token-saver:history` | Show a breakdown of the last 30 filtered commands with saved sizes. |
| `token-saver:clear` | Purge persistent history and reset savings tracking. |
| `token-saver:passthrough` | Bypass filtering for the next bash command (useful for debugging). |

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
| `npm` / `pnpm` / `yarn` / `bun` install | Single success summary line preserving warnings/errors and vulnerabilities. | ~90% |
