# my-pi

A curated distribution of the Pi coding agent, including custom skills, packages, and workflow automation.

## Why this distribution?

Pi is a powerful coding assistant, but managing agent behavior, themes, and extensions across projects can become complex. This distribution provides:

- **Standardized Skills**: A set of `.agents/` definitions to ensure consistent behavior across all your development tasks.
- **Curated Assets**: Ready-to-use packages like `@victorhg/pi-themes` to style your terminal experience.
- **Workflow Governance**: Documented processes to ensure maintainability, validation, and release quality.
- **Extensibility**: A structured monorepo environment designed for building and testing your own Pi extensions.

## Building the Project

The project is structured as a monorepo. You can build all packages from the root directory:

```bash
pnpm install
pnpm build
```

Individual packages are located in the `packages/` directory and can be built independently if needed:

```bash
cd packages/<package-name>
pnpm build
```

## Installation

This repository provides several packages that can be installed into your Pi environment.

### Development Installation

To use these packages during development, you can install them using their workspace paths or by building and referencing them directly:

```bash
# Build all packages first
pnpm build

# Install a specific package to your current project
npm install ./packages/<package-name>
```

### Official Package Installation

For production or standard usage, use the `pi install` command:

## Available Packages

This monorepo contains several curated packages for the Pi environment:

- **[@victorhg/pi-last-session](./packages/last-session/README.md)**: Manage session context across Pi coding sessions — compact, save, restore, and inspect previous work.
- **[@victorhg/pi-footer](./packages/pi-footer/README.md)**: A rich, information-dense footer status bar for the Pi coding agent. Required by `pi-auto-compact` and `pi-token-saver` for status bar integration.
- **[@victorhg/pi-no-bash](./packages/pi-no-bash/README.md)**: Capability reduction for Pi agents by intercepting and restricting bash tool calls.
- **[@victorhg/pi-themes](./packages/pi-themes/README.md)**: Curated themes and styling assets for the Pi environment.
- **[@victorhg/pi-token-saver](./packages/pi-token-saver/README.md)**: Intelligent bash output filtering to reduce token consumption. Optionally integrates with `pi-footer` for live savings metrics.
- **[@victorhg/pi-auto-compact](./packages/pi-auto-compact/README.md)**: Context window manager with threshold alerts, auto-compaction triggers, and footer status integration. Optionally integrates with `pi-footer` for live usage metrics.

> **Root bundle:** The root `package.json` declares the default distribution bundle — the packages installed when using `my-pi` out of the box. All packages are available individually via `pi install`.

### pi-auto-compact

Monitors context window usage after every tool call and assistant turn. Sends a warning notification when usage crosses a configurable threshold (default **75 %**) and automatically triggers `/compact` with custom summarization instructions once usage reaches the compaction threshold (default **90 %**).

| Command | Description |
|---|---|
| `/auto-compact:status` | Show current usage, thresholds, and compaction count. |
| `/auto-compact:set <warn\|compact> <0-100>` | Adjust either threshold at runtime. |
| `/auto-compact:instructions <text>` | Override the summarization prompt used during compaction. |

When `@victorhg/pi-footer` is active, a live `📦N` indicator (or `⚠️📦` on warning) is injected into the status bar.

## Backlog

For features not yet implemented, please refer to the `new-features.md` backlog file.

## Skills

Skills are categorized into two types:

- **Development (`.agents/`)**: Specialized procedures for project maintenance and agent workflow management.

| Skill | Description |
|---|---|
| `pi-extension-development` | Used when building or modifying Pi extensions and packages. |
| `pi-package-sandbox-test` | Used to validate published package installability. |
| `pi-primitive-check` | Used to evaluate customisation work against built-in Pi primitives before implementation. |
| `pi-release-workflow` | Used when preparing or validating monorepo releases. |
| `pi-validation-flow` | Used to validate repository changes before finalizing implementation. |
| `system-info` | Used to provide contextual information about the environment. |

- **Library (`skills/`)**: A shared library of re-usable agent skills.

| Skill | Description |
|---|---|
| `code-quality` | Used when requesting code analysis, style reviews, linting recommendations, or refactoring suggestions. |
| `critic-project` | Used when analyzing a project for architecture quality, unmitigated risks, and product coherence. |
| `handoff` | Used to compact the current conversation into a handoff document for the next agent session. |
| `summarize` | Used to produce a concise summary of the current session or a given topic. |


## Inspiration

This project draws inspiration from [my-pi by spences10](https://github.com/spences10/my-pi/tree/main), which provides a foundation for curated Pi distributions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
