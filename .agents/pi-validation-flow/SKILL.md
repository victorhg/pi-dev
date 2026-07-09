---
name: pi-validation-flow
# prettier-ignore
description: Use when validating Pi monorepo changes after editing TypeScript, Svelte, package manifests, built-in registry, tests, repo tooling, skills, or docs.
compatibility:
  Requires the Pi coding-agent monorepo validation scripts.
---

# Pi Validation Flow

Use this before saying implementation work is done.

## Workflow

1. Inspect changed files with `git diff --name-only`.
2. Run the narrowest package validation for changed packages.
3. Run LSP diagnostics for changed TypeScript/Svelte source files.
4. Run root validation when shared files, root scripts, package
   manifests, lockfile, or built-in registry changed.
5. Report failures honestly: separate new failures, pre-existing
   failures, skipped checks, and unavailable tools.

## Command selection

- Single package: `pnpm --filter @victorhg/<pkg> run check:self` and
  `test:self`.
- Root/shared changes: `pnpm run check`.
- Boundary-sensitive changes: `pnpm run check:boundaries` if available
  or included by root check.
- Svelte files: use Svelte-specific validation and LSP diagnostics.
- Skills: run `pnpx check-skills validate <skill-path> --json` after
  every skill edit.

## Reporting format

Keep the final report short:

- Changed: files/packages touched.
- Validation: commands run and results.
- Risks: only unresolved failures or skipped checks.
