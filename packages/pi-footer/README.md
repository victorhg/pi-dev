# @victorhg/pi-footer

A rich, information-dense footer status bar for the Pi coding agent — displaying everything you need at a glance.

## What it does

`pi-footer` replaces the default Pi footer with a highly packed status line showing:

| Displayed Element | Description |
|---|---|
| **Directory** | Current working directory (shortened) |
| **Model** | Active AI model identifier |
| **Thinking indicator** | `◐` + thinking level (e.g. `low`, `high`) when active |
| **Git branch** | Current branch name + status indicators |
| **Git status** | Staged (`●`), unstaged (`~`), untracked (`U`), ahead (`↑`), behind (`↓`) counts |
| **Worktree** | Worktree branch name (when using Git worktrees) |
| **Token stats** | Input (`↑`), output (`↓`), cache read (`R`), cache write (`W`), and cost (`$`) |
| **Context window** | Tokens used / total, with a color-coded progress bar (`━`) — green → yellow → red |

### Layout

- **Wide terminals** (≥ 150 cols): single line
  ```
   ~/project · main ~1↑2 · gpt-4o · ◐low · worktree/feature · ↑23k ↓8k R1k W512 $1.23 · ━━━━━72%
  ```
- **Narrow terminals** (< 150 cols): splits into two lines
  ```
  Line 1:  ~/project · main ~1↑2 · gpt-4o · ◐low · worktree/feature
  Line 2:  ↑23k ↓8k R1k W512 $1.23 · ━━━━━72%
  ```

The split threshold is configurable.

## How to use

Import and call `registerFooter` when your extension loads:

```typescript
import registerFooter from "@victorhg/pi-footer";

export default function (pi: ExtensionAPI) {
  registerFooter(pi);
}
```

### Optional configuration

Pass a config object with `splitThreshold` to control when the footer splits:

```typescript
import registerFooter from "@victorhg/pi-footer";

export default function (pi: ExtensionAPI) {
  registerFooter(pi, { splitThreshold: 120 }); // Split at 120 chars instead of 150
}
```

| Option | Default | Description |
|---|---|---|
| `splitThreshold` | `150` | Terminal width (cols) below which the footer splits into two lines |

## Features in detail

### Git integration

- Detects the current Git branch via `git status`.
- Shows counts of staged, unstaged, untracked, ahead, and behind commits.
- Colors status indicators: staged = success (green), unstaged = warning (yellow), untracked = dim, ahead = info (blue), behind = warning (yellow).

### Token and cost tracking

- Aggregates input, output, cache read, and cache write tokens from all assistant messages in the session.
- Shows cumulative API cost when the model provides cost data.
- Uses an incremental cache (500 ms) so stats don't slow down rendering.

### Context window progress bar

- Shows how much of the model's context window has been consumed.
- Color-coded: under 80% = normal, 80–95% = warning, over 95% = error (red).
- Expands to fill remaining terminal space after all other sections.

### Thinking level display

- When extended thinking (e.g. OpenAI's `o1`, `o3`) is active, shows the current thinking level (`minimal`, `low`, `medium`, `high`, `xhigh`).
- Color-coded per the configured theme tokens (`thinkingMinimal`, `thinkingLow`, etc.).

### Worktree support

- Detects Git worktrees and displays the branch name for the current worktree.
- Uses `git worktree list --porcelain` with a 2-second cache.

## Installation

Add the package as a dependency and enable the extension:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-footer/src/index.ts"
    ]
  }
}
```

Peer dependencies: `@earendil-works/pi-coding-agent >= 0.1.0` and `@earendil-works/pi-tui >= 0.1.0`.

## Customization

The footer respects Pi's theme system — all tokens (e.g., `success`, `warning`, `error`, `syntaxFunction`) are styled via the active theme. Override theme colors to change the appearance of specific elements.

## See also

- **[pi-archimedes](https://github.com/danielcherubini/pi-archimedes)** — A collection of extensions by Daniel Cherubini for the Pi coding agent, providing visual polish and additional functionality including live TUI streaming, subagent dispatch, and cost tracking.
  `pi-footer` was developed as part of the pi-archimedes project.
