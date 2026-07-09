---
name: pi-package-sandbox-test
description: Use when verifying that published my-pi packages install and load for normal users, including Pi package compatibility checks, release validation, sandbox tests, and package installability audits.
compatibility:
  Requires Node.js, pnpx, network access, and vanilla Pi via @earendil-works/pi-coding-agent.
---

# Pi Package Sandbox Test

Verify published my-pi packages work for normal Pi users, independent of this local monorepo.

## Procedure

1. From the repository root, enumerate packages/*/package.json.
2. Select only packages with a pi manifest; helper/internal packages without pi are not user-installable Pi packages.
3. For each selected package, compare local package.json version with npm view <pkg> version.
4. In a disposable sandbox, use vanilla Pi only:
   `pnpx @earendil-works/pi-coding-agent`
5. For each published npm version, verify both commands succeed:
   `pnpx @earendil-works/pi-coding-agent install npm:<package>@<npm-version>`
   `pnpx @earendil-works/pi-coding-agent -e npm:<package>@<npm-version> --help`
6. In the same clean sandbox config, install all selected packages together, then run:
   `pnpx @earendil-works/pi-coding-agent list`
   `pnpx @earendil-works/pi-coding-agent --help`

## Report Format

Report a compact table with:

- package name
- local version
- npm version
- install result
- ephemeral load result
- notes

Call out local/npm version drift separately. Version drift is not a failure when it is explained by release timing, changesets, or minimumReleaseAge; the user-facing check should use the published npm version that normal Pi users can install.

## Failure Patterns

Treat these as failures unless explained by the sandbox environment:

- npm package cannot be resolved
- pi install npm:<package>@<version> exits non-zero
- pi -e npm:<package>@<version> --help exits non-zero
- startup output includes Cannot find module, ERR_MODULE_NOT_FOUND, SyntaxError, TypeError, or ReferenceError
- packages pass alone but fail when installed together
