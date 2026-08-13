# Release Plan — `@victorhg/pi-code-quality`

> **Status:** Plan (not executed) · **Date:** 2026-08-12
> **Goal:** Publish `@victorhg/pi-code-quality` to a package registry so users can `pi install @victorhg/pi-code-quality`, then validate installability.

---

## 1. Current state (verified)

| Fact | Evidence |
|---|---|
| Package is complete & tested | 92 unit tests green; real self-scan ran end-to-end (96/100) |
| Local install + load works | `pi install <local-path>` → exit 0; `pi -e <pkg> --help` → exit 0, no errors |
| `activate()` registers tool + commands | `code_quality_scan` + `/code-quality:scan|status|report` |
| **Nothing is published to npm** | `npm view @victorhg/pi-sec-quality` → E404 (all `@victorhg/*` are unpublished) |
| **No npm credentials** | `npm whoami` → `ENEEDAUTH` |
| **No versioning tooling** | no `.changeset/`, no changeset dependency, no git tags |
| `@earendil-works/pi-coding-agent` peer dep resolves | on npm at `0.84.1` |
| Optional dep uses `workspace:*` | `@victorhg/pi-footer: "workspace:*"` (and 6 other packages do too) |
| pnpm available | `11.11.0` (needed for workspace protocol rewriting) |

**Bottom line:** the package itself is release-ready. The blockers are entirely **infrastructure** — registry access, credentials, and a versioning/publish workflow that don't exist yet for this repo.

---

## 2. Decisions needed before publishing

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | **Registry target** | public npm `@victorhg` scope · GitHub Packages · private registry (Verdaccio/Artifactory) | public npm unless the package is intended to stay private |
| D2 | **Versioning tooling** | Adopt Changesets · manual semver bumps | Changesets **if** this becomes a multi-package release cadence; manual is fine for a one-off first publish |
| D3 | **Publish method** | `pnpm publish` (rewrites `workspace:*`) · manual version pinning | **`pnpm publish`** — it converts `workspace:*` → concrete version in the tarball |
| D4 | **Rollout order** | publish `pi-footer` first vs. `pi-code-quality` alone | **`pi-footer` first** — it is the optional dep of 7 packages, so the footer badge works out of the box |

---

## 3. Phase A — One-time repo prerequisites

- [ ] **A1. Create the `@victorhg` scope / org** on the chosen registry and grant publish access to the publishing account.
- [ ] **A2. Authenticate:** `npm login` (or `npm adduser`), confirm with `npm whoami`.
- [ ] **A3. Add a root `.npmrc`** pinning `registry` and (for scoped private registries) `@victorhg:registry`. Leave public npm default if D1 = public.
- [ ] **A4. Fix the machine-specific `devDependency`** in `packages/pi-code-quality/package.json`:
  - Current: `"@earendil-works/pi-coding-agent": "file:../../../../../../opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent"`
  - Change to: `"@earendil-works/pi-coding-agent": "^0.84.1"` (it is published on npm), then `pnpm install`.
  - Reason: `file:` paths break fresh clones and CI. Applies to all packages, but do it here at minimum.
- [ ] **A5. (If D2 = Changesets)** `pnpm add -Dw @changesets/cli && pnpm changeset init`, configure `.changeset/config.json` with `baseBranch` and `access: "public"`. Otherwise skip.
- [ ] **A6. Verify `pnpm publish` dry-run** rewrites `workspace:*` correctly (see Phase B).

---

## 4. Phase B — Publish `pi-code-quality`

> First publish stays at `0.1.0` (never published → nothing to bump).

```bash
cd packages/pi-code-quality

# 1. Build from clean state
pnpm run build:self

# 2. Verify the tarball contents (should show: dist/*.js, README.md, package.json — no src/tests)
pnpm pack --dry-run

# 3. Dry-run publish — confirm workspace:* is rewritten to a concrete version
pnpm publish --dry-run --no-git-checks --access public

# 4. Real publish
pnpm publish --no-git-checks --access public

# 5. Confirm it is live
npm view @victorhg/pi-code-quality version       # expect 0.1.0
npm view @victorhg/pi-code-quality dependencies   # expect @victorhg/pi-footer @ 0.1.0 (not "workspace:*")
```

**Critical check in step 3/5:** the published `dependencies`/`optionalDependencies` must contain a concrete `@victorhg/pi-footer` version, **not** `workspace:*`. If it does not rewrite, pin manually before publishing: `"@victorhg/pi-footer": ">=0.1.0"`.

**Also publish `@victorhg/pi-footer` first** (D4), so the optional dependency resolves for users:

```bash
cd packages/pi-footer && pnpm run build:self && pnpm publish --no-git-checks --access public
```

---

## 5. Phase C — Post-publish validation (`pi-package-sandbox-test`)

Run against the **published npm version**, in a disposable sandbox, with vanilla pi only:

```bash
# 1. Ephemeral load
pnpx @earendil-works/pi-coding-agent -e npm:@victorhg/pi-code-quality@0.1.0 --help

# 2. Real install
pnpx @earendil-works/pi-coding-agent install npm:@victorhg/pi-code-quality@0.1.0

# 3. Install alongside pi-footer (footer integration)
pnpx @earendil-works/pi-coding-agent install npm:@victorhg/pi-footer@0.1.0

# 4. List + load together
pnpx @earendil-works/pi-coding-agent list
pnpx @earendil-works/pi-coding-agent -e npm:@victorhg/pi-code-quality@0.1.0 --help
```

**Acceptance criteria:**
- [ ] `install` exits 0; `list` shows the package.
- [ ] `-e … --help` exits 0 with **no** `Cannot find module`, `ERR_MODULE_NOT_FOUND`, `SyntaxError`, `TypeError`, or `ReferenceError`.
- [ ] Passes when installed together with `pi-footer` (footer badge `📐` renders).
- [ ] Manual smoke: `/code-quality:scan` on a real project returns a scorecard (tools permitting).

---

## 6. Phase D — Repo-wide rollout (after `pi-code-quality` succeeds)

Recommended order, since `pi-footer` is the shared dependency:

1. `@victorhg/pi-footer` (provides the footer registry)
2. `@victorhg/pi-code-quality`
3. `@victorhg/pi-sec-quality`, `@victorhg/pi-web-quality`, `@victorhg/pi-hallmark`
4. Remaining packages

After publishing, update `docs/package-map.md` and root `README.md` to reflect published (vs. workspace-only) status, and tag releases in git (`v0.1.0`).

---

## 7. Risks & notes

| Risk | Mitigation |
|---|---|
| `workspace:*` leaks into the published tarball | Verify with `pnpm publish --dry-run`; pin manually if needed |
| Peer dep warns on install | All `@earendil-works/pi-coding-agent` imports are `import type` (erased at build), so it is contract-only; optionally add `peerDependenciesMeta: { "@earendil-works/pi-coding-agent": { "optional": true } }` |
| `file:` devDependency breaks CI | A4 (pin to npm version) |
| Optional tools missing on user machines | Already handled — metrics report `unavailable` gracefully |
| First publish under wrong scope/registry | A1/A3 — confirm scope + `.npmrc` before any publish |
| No git tag/changelog trail | A5 (Changesets) or manual `git tag v0.1.0` |

---

## Checklist summary

- [ ] D1–D4 decided
- [ ] A1 scope created · A2 auth · A3 `.npmrc` · A4 devDep pinned · A5 changesets (optional) · A6 dry-run verified
- [ ] B: `pi-footer` published, then `pi-code-quality` published; `npm view` confirms
- [ ] C: sandbox install + load + footer-integration all pass
- [ ] D: remaining packages published, docs updated, tags cut
