# @victorhg/pi-last-session

Manage session context across Pi coding sessions — compact, save, restore, and inspect previous work.

## What it does

When your session grows large or you need to start fresh without losing context, `pi-last-session` saves a compact summary of the current conversation into a `.last-session` file in your project root. On the next session, you can restore that context — so the AI "remembers" what was done, which files were touched, and the overall state of your work.

Three commands are registered automatically once the extension is loaded:

## Commands

### `/save-session [custom-instructions]`

Compacts and saves the current session context to `.last-session`.

- Generates a summary of the current session using your active AI model (or falls back to a placeholder).
- Records the last file you were working on (inferred from tool calls like `read`, `edit`, `write`, `grep`, or `find`).
- Writes a JSON state file (`savedAt`, `contextSummary`, `lastKnownFile`) to `.last-session` in your project root.

```
/save-session
/save-session Focus on cleaning up the API layer
```

### `/refresh-session [custom-instructions]`

Saves the current session, starts a new session, and automatically injects the previous session's summary into the new one.

1. Compacts and saves the current session (identical to `/save-session`).
2. Creates a new session via Pi's session management.
3. Injects the saved summary as an initial "RESTORED SESSION CONTEXT" message so the new session inherits context from the old one.

Use this when you want a clean slate but still want the AI to know what was accomplished.

```
/refresh-session
/refresh-session Preserve focus on test coverage
```

### `/last-session`

Reads and displays the last saved session state without modifying anything.

Shows:
- **Saved At** — ISO timestamp of when the session was last saved.
- **Summary** — The compacted summary of the previous session's context.
- **Last Known File** — The file that was most recently being edited (if any).

```
/last-session
```

## Example workflow

```
# Mid-session: compact and save what you've accomplished
/save-session Focus on fixing the auth middleware

# Start a fresh session — context carries over automatically
/refresh-session

# Inspect what's saved without restoring
/last-session
```

## Technical details

- Session data is stored in `.last-session` relative to `process.cwd()`.
- The file is valid JSON with keys: `savedAt`, `contextSummary`, `lastKnownFile`.
- Summary generation uses Pi's active model when available, falling back to a placeholder string if no model is accessible.
- Last-known file detection scans recent tool calls for `read`, `edit`, `write`, `grep`, and `find`.

## Installation

Add the package to your project and reference it in your Pi configuration:

```json
{
  "pi": {
    "extensions": [
      "@victorhg/pi-last-session/dist/index.js"
    ]
  }
}
```

Peer dependency: `@earendil-works/pi-coding-agent`.
