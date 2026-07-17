# @victorhg/pi-no-bash

Removes the `bash` tool from the Pi agent entirely. When this extension is
active the agent **cannot execute any shell command**, regardless of what it
is asked to do.

## Security model

The bash tool is the widest attack surface in a Pi agent deployment. A
compromised prompt, a confused agent, or a malicious instruction can all
lead to arbitrary command execution if bash is available.

`pi-no-bash` eliminates that surface at the extension layer: every `bash`
tool call is intercepted and blocked before execution. The agent receives a
blocked status and cannot retry or bypass it.

**This is a hard, unconditional block. There is no toggle.**

The only way to give the agent back a specific capability is to implement it
as an explicit, auditable Pi extension. This is intentional — the security
posture requires that every action the agent can perform in production is
explicitly declared, reviewed, and shipped as code, not available by default
through a general-purpose shell.

## When to use

Install this package in any Pi deployment where:

- The agent runs in a production or shared environment.
- You need to guarantee that no shell command can be executed implicitly.
- You want to enforce a principle of least privilege: the agent can only do
  what an extension explicitly allows.

Do **not** install this in a development environment where you rely on `bash`
for file operations, builds, or exploration.

## How it works

The extension registers a `tool_call` listener. When the event `toolName`
is `bash`, it returns `{ block: true, reason: "pi-no-bash active" }` and
emits a warning to the console. No shell process is spawned.

```
agent issues bash call
       │
       ▼
tool_call event fires
       │
       ▼
pi-no-bash intercepts ──► { block: true, reason: "pi-no-bash active" }
       │
       ▼
agent receives blocked status — execution stops
```

## Installation

```bash
pi install @victorhg/pi-no-bash
```

Or add it to your Pi configuration:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-no-bash/dist/index.js"
    ]
  }
}
```

## Extending capabilities safely

With `pi-no-bash` active, the agent can only act through extensions you
explicitly provide. To expose a specific capability, implement a Pi extension
that handles a named command or reacts to a specific event.

Example: an extension that allows reading a single approved directory:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("read-logs", {
    description: "Read the last 100 lines of the application log",
    handler: async (_args, ctx) => {
      const { execSync } = await import("child_process");
      const output = execSync("tail -n 100 /var/log/app.log").toString();
      ctx.ui.notify(output, "info");
    },
  });
}
```

Each extension becomes an explicit, reviewable capability grant — the
opposite of an open shell.

## What is NOT blocked

Only the `bash` tool is intercepted. Other Pi tools (`read`, `edit`,
`write`, `web_search`) are not affected. If you need to restrict those,
implement additional `tool_call` listeners in a separate extension.
