---
name: pi-release-workflow
# prettier-ignore
description: Use when preparing or validating Pi monorepo releases, including Changesets, pnpm lockfile updates, package previews, release-age policy, and installability checks.
compatibility:
  Requires this Pi coding-agent monorepo release workflow.
---

# Pi Release Workflow

Use this when preparing, validating, or debugging package releases
from this repo.

## Workflow

1. Check current package changes and Changesets before editing
   versions.
2. Respect pnpm `minimumReleaseAge`; do not blindly bypass it for
   fresh registry packages.
3. For catalog/version updates, edit `pnpm-workspace.yaml` or package
   manifests intentionally, then run `pnpm install` to refresh the
   lockfile.
4. Regenerate release artifacts when required, especially
   startup/package preview assets.
5. Validate locally, then test published-package installability with
   the sandbox skill when applicable.

## Commands and checks

- `pnpm changeset status` for pending release intent.
- `pnpm install --frozen-lockfile` to verify committed lockfile state.
- `pnpm run preview:generate` when preview image output should change.
- `pnpm run check` before release PRs or publishing.
- Use `pi-package-sandbox-test` for normal-user install/load
  validation of published Pi packages.

## Pitfalls from recent sessions

- `pnpm update -r --latest --catalog` is not the safe catalog workflow
  here.
- Local workspace packages do not need `minimumReleaseAgeExclude`;
  that applies to registry packages.
- If a validator is missing, report it and use `pnpx` only when
  appropriate.
