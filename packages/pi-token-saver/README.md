# pi-token-saver

Intelligent bash output filtering to reduce token consumption.

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

- **Smart filtering**: Intercepts bash command output and applies targeted filters.
- **Savings tracking**: Records bytes/tokens saved per command across the session.
- **Footer integration**: Displays a `💰xKB` metric in the pi-footer status bar when `@victorhg/pi-footer` is installed (optional — no hard dependency).
- **Passthrough mode**: Bypass filtering for a single command when needed.

## Commands

| Command | Description |
|---|---|
| `token-saver:savings` | Show total KB saved and number of filtered commands this session. |
| `token-saver:history` | Show a per-command breakdown with bytes saved and timestamp. |
| `token-saver:passthrough` | Bypass filtering for the next bash command (useful for debugging). |

## Usage

Once installed, the extension automatically intercepts bash command output. No manual steps are needed — filtered commands accumulate savings silently in the background.

To view savings at any time, use the commands above. If `@victorhg/pi-footer` is also installed, the running total appears in the footer automatically.

### Filtered commands (built-in rules)

| Command pattern | Line limit |
|---|---|
| `git status` | 50 |
| `git log` | 80 |
| `ls` | 50 |
| `find` | 100 |
| `npm install` / `yarn install` / `pnpm install` / `bun install` | 30 |
