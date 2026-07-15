# @victorhg/pi-auto-compact

Context window manager for the Pi coding agent. Auto-monitors context usage and triggers warnings or auto-compaction before context window overflows degrade the agent's performance.

## Features

- 📈 **Continuous Context Monitoring**: Checks context window usage after every tool execution and assistant turn.
- ⚠️ **Configurable Warnings**: Notifies you when context usage exceeds a safety threshold (default: `75%`).
- 📦 **Automated Compactions**: Triggers an automated `/compact` with customized summarization focus once context usage exceeds the trigger threshold (default: `90%`).
- 🎨 **Status Bar Integration**: Registers with `@victorhg/pi-footer` to display compaction metrics (e.g. `📦1` showing 1 compaction has fired, or `⚠️📦` when warning threshold is breached).
- ⚙️ **Dynamic Controls**: Simple commands to set thresholds and configure custom compaction instructions on the fly.

## Commands

- `/auto-compact:status` — Show thresholds, current context usage metrics, and compaction history counts.
- `/auto-compact:set <warn|compact> <percentage>` — Change thresholds dynamically in real-time (e.g., `/auto-compact:set warn 80` or `/auto-compact:set compact 95`).
- `/auto-compact:instructions <custom instructions...>` — Set custom instructions to guide the compaction model when summarizing older turns (e.g., `/auto-compact:instructions Focus on key code decisions and remove verbose stacktraces`).

## Installation

Add the package as an extension in your `.pi-config.json` or global config:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-auto-compact/src/index.ts"
    ]
  }
}
```

## Peer Dependencies

- `@earendil-works/pi-coding-agent >= 0.1.0`
- Optional status bar integration: `@victorhg/pi-footer`
