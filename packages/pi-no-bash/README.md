# pi-no-bash

Capability reduction for Pi agents by intercepting and restricting `bash` tool calls.

## Motivation

Prevent arbitrary command execution in sensitive production environments by creating a restricted execution model for Pi instances.

## API Hooks

- `tool_middleware`: Intercepts `bash` tool calls and returns a blocked status based on the configured policy.

## Commands

- `no-bash:toggle`: Enable/disable bash capabilities for the current session.
