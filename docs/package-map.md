# Package Map

This document tracks installable packages versus support packages in the monorepo.

## Installable Packages (pi-packages)

All packages below can be installed individually via `pi install @victorhg/<name>`.

| Package | Description | Footer integration |
|---|---|---|
| `@victorhg/pi-themes` | Curated themes and styling assets. | — |
| `@victorhg/pi-footer` | Rich status bar for the Pi coding agent. | **provides** the registry |
| `@victorhg/pi-token-saver` | Intelligent bash output filtering to reduce token consumption. | optional — shows `💰xKB` savings metric |
| `@victorhg/pi-auto-compact` | Context window manager with threshold alerts and auto-compaction. | optional — shows `📦N` / `⚠️📦` indicator |
| `@victorhg/pi-no-bash` | Capability reduction — intercepts and blocks bash tool calls. | — |
| `@victorhg/pi-last-session` | Session context persistence — save, restore, and inspect previous sessions. | — |

### Footer integration dependency

`pi-auto-compact` and `pi-token-saver` both declare `@victorhg/pi-footer` as an
`optionalDependency`. Footer registration is attempted at startup and silently
skipped if `pi-footer` is not installed. To enable the status bar indicators,
install `pi-footer` alongside either package.

## Root bundle

The root `package.json` `dependencies` define the **default distribution
bundle** — the packages activated when someone runs `my-pi` out of the box.
All other packages are available individually but require an explicit install.

| Package | In bundle | Reason |
|---|---|---|
| `@victorhg/pi-themes` | ✅ | Visual baseline — always useful |
| `@victorhg/pi-footer` | ✅ | Required for full status bar integration with auto-compact and token-saver |
| `@victorhg/pi-token-saver` | ✅ | Reduces token cost on every session — on-by-default value |
| `@victorhg/pi-auto-compact` | ✅ | Prevents silent context overflow — on-by-default safety net |
| `@victorhg/pi-no-bash` | ❌ | Opt-in only — breaks workflows that depend on bash |
| `@victorhg/pi-last-session` | ❌ | Opt-in only — requires deliberate session management workflow |

## Support Packages

- (none yet)
