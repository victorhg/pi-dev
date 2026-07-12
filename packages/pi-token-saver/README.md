# pi-token-saver

Intelligent bash output filtering to reduce token consumption.

## Installation

```bash
pi install ../../Development/pi-dev/packages/pi-token-saver
```

## Configuration

To activate the extension, add it to your Pi configuration file:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-token-saver/src/pi-hook.ts"
    ]
  }
}
```

## Features

- **Smart filtering**: Intercepts bash command output and applies targeted filters.
- **Savings tracking**: Records bytes/tokens saved.
- **Discovery mode**: Identifies commands that could benefit from new filter rules.
- **Passthrough mode**: Bypass filtering for debugging.

## Usage

Once installed and configured, the extension automatically intercepts bash commands executed via the agent. No manual commands are required to trigger it—it works silently in the background to reduce token usage during your workflow.
