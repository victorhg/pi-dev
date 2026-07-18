# @victorhg/pi-obsidian

Obsidian vault tools for the Pi coding agent — read, search, create, and manage notes via the [Obsidian CLI](https://obsidian.md/cli).

Designed to run with pi launched from inside an Obsidian vault directory. The CLI resolves the vault from the current working directory automatically — no vault targeting needed.

## Requirements

- **Obsidian 1.12+** with CLI enabled: **Settings → General → Command line interface**
- **Obsidian desktop app must be running** — the CLI communicates via IPC
- The `obsidian` binary must be in your PATH (the installer handles this on first enable)
- **pi must be launched from inside the vault directory**

## Installation

```bash
pi install npm:@victorhg/pi-obsidian
```

Or from this monorepo:

```bash
pnpm install
pnpm --filter @victorhg/pi-obsidian build
```

## Features

- **Single `obsidian` tool** — runs any Obsidian CLI command; the LLM calls it with a `run` string
- **System-prompt guidelines** — injected on every agent turn so the LLM knows how to use the tool correctly
- **Convenience commands** — quick access to daily notes, search, tasks, and reading notes without prompting the LLM

## Commands

| Command | Description |
|---|---|
| `/obsidian:status` | Verify CLI is reachable and show current vault info |
| `/obsidian:note <name>` | Read a note by name and load it into the agent context |
| `/obsidian:search <query>` | Full-text vault search; pick a result to summarise |
| `/obsidian:daily` | Read today's daily note and summarise it |
| `/obsidian:tasks [daily]` | List open tasks from the vault (or today's daily note) |

## Tool Usage

The `obsidian` tool accepts any Obsidian CLI command string:

```
obsidian run="read file=Meeting Notes"
obsidian run="search query=roadmap format=json"
obsidian run="create path=Projects/Idea.md content=# My Idea"
obsidian run="daily:append content=- [ ] Review PR"
obsidian run="property:set file=Note name=status value=active"
obsidian run="tasks todo"
obsidian run="backlinks file=ProjectPlan format=json"
```

### Syntax rules

- Quote values with spaces: `file="My Note"`, `content="hello world"`
- Boolean flags have no value: `permanent`, `overwrite`, `recursive`, `verbose`
- JSON output: add `format=json`

## Full CLI Reference

All standard Obsidian CLI commands are supported. Key categories:

| Category | Example commands |
|---|---|
| Files | `read`, `create`, `append`, `prepend`, `move`, `rename`, `delete`, `files`, `folders` |
| Search | `search`, `search:context` |
| Daily notes | `daily`, `daily:read`, `daily:append`, `daily:prepend`, `daily:path` |
| Tasks | `tasks`, `task` (toggle/set status) |
| Properties | `property:set`, `property:read`, `property:remove`, `properties` |
| Tags | `tags`, `tag` |
| Links | `backlinks`, `links`, `orphans`, `unresolved` |
| Templates | `templates`, `template:read`, `create … template=<name>` |
| History | `history`, `diff` |
| Vault | `vault`, `vaults` |
| Plugins | `plugins`, `plugin:enable`, `plugin:disable`, `plugin:reload` |
| Sync | `sync:status`, `sync:history`, `sync:restore` |
| Developer | `eval`, `dev:screenshot`, `dev:console` |

See the [Obsidian CLI documentation](https://obsidian.md/help/cli) for the full reference.

## Peer Dependencies

- `@earendil-works/pi-coding-agent >= 0.1.0`
