
# AGENTS.md

# Mandatory Instructions for Agents

- Always commit changes using git with a summary of the latest changes immediately after completing a task or a significant set of changes.
- Be direct and succint in your explanations.
- Avoid duplicating explanations

Guidance for coding agents working in this repository.

## Orientation

This repo is `my-pi`: a curated Pi coding-agent distribution plus
reusable `@victorhg/pi-*` packages.

Start with:

- `README.md` for distribution-level usage and package list.
- `docs/package-map.md` for installable vs support packages.
- `docs/agent-workflows.md` for repository-specific skill routing.
- `docs/dependency-overrides.md` before changing pnpm overrides.
- Package-local `README.md` files before changing package behavior or
  user-facing docs.

## Repository-specific skills

Project skills live directly under `.agents/<skill>/SKILL.md`. Load
the matching skill before doing the work:

| Task                                             | Skill                      |
| ------------------------------------------------ | -------------------------- |
| Build or modify Pi extensions/packages           | `pi-extension-development` |
| Compare proposed customisation with Pi built-ins | `pi-primitive-check`       |
| Prepare or validate releases                     | `pi-release-workflow`      |
| Test published package installability            | `pi-package-sandbox-test`  |
| Validate repository edits                        | `pi-validation-flow`       |

Keep skill metadata activation-friendly:

- single-line `description`
- `# prettier-ignore` above long descriptions
- trigger language starts with `Use when...`
- validate with
  `pnpx check-skills validate .agents --recursive --json`

## Source of truth order

1. Package-local `README.md` files for user-facing package behavior.
2. `.agents/*/SKILL.md` files for agent operating procedure.
3. Root `README.md` for distribution positioning and commands.
4. Source/tests for implementation details when docs are incomplete.


## Validation

Before reporting implementation completion:

1. Inspect `git diff --name-only`.
2. Run the narrowest package check/test for touched packages.
3. Run LSP diagnostics for changed TypeScript/Svelte source files.
4. Run root checks when shared files, package manifests, lockfiles,
   registry wiring, or tooling changed.
5. For skill edits, run
   `pnpx check-skills validate .agents --recursive --json`.
6. When adding a feature, Update README.md wit the information 


Report changed files, validation run, and unresolved risks only.
