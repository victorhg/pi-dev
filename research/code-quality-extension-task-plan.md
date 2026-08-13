# Task Plan — `@victorhg/pi-code-quality` Extension

> **Companion to:** `research/code-quality-metrics-extension.md` (definitions, tooling research, references)
> **Date:** 2026-08-12

This plan turns the research into a shippable Pi package: an extension that runs code-quality metrics (complexity, cyclomatic complexity, duplication, spaghetti index, security errors, exposed secrets, anti-code-slop) and reports a single maintainability scorecard.

---

## 1. Scope & Boundaries

**Owns (no existing package covers these):**

| Metric | Tool | Output |
|---|---|---|
| Cyclomatic / cognitive complexity | `lizard` (multi-lang), `radon` (Python) | per-function CC, worst files |
| Code duplication | `jscpd` (fallback `lizard -C`) | duplication %, clone blocks |
| Spaghetti index (SF) | computed: `SF = SCC + (Globals×5) + (SLOC/20)` | per-module score |
| Structural "code slop" | `aislop scan --json` | 0–100 slop score + rules |
| Security errors (deep) | `semgrep --json` (fallback `bandit` for Python) | severity-classified findings |
| Exposed secrets (deep) | `gitleaks detect --report-format json` (+ optional `trufflehog`) | live + git-history findings |

**Delegates / does not duplicate:**

- **`@victorhg/pi-sec-quality`** — owns the lightweight regex-based security/secrets audit. `pi-code-quality` deepens via real SAST/secret tools but must not re-implement regex scanning. If both are installed, `pi-code-quality` should prefer the external-tool results and note that `pi-sec-quality` provides the fast path.
- **`@victorhg/pi-hallmark`** — owns *visual/design* anti-slop (57 slop gates on UI structure, gradients, typography). `pi-code-quality` owns *code-structure* slop (narrative comments, swallowed exceptions, `as any`, dead code) via `aislop`. Boundaries are documented in both READMEs.

**Non-goals for v1:** language-specific Spaghetti globals extraction for JS/Python (approximate via module-level mutable state first); CodeQL integration (needs buildable env + license); a web dashboard.

---

## 2. Architecture & File Layout

Follows the `pi-extension-development` checklist (`references/checklist.md`) and mirrors `pi-sec-quality`:

```
packages/pi-code-quality/
├── package.json          # @victorhg/pi-code-quality; type: module; exports dist/index.js
│                         # scripts: build:self, check:self, test:self
│                         # peerDeps: @earendil-works/pi-coding-agent
│                         # optionalDeps: @victorhg/pi-footer (workspace:*)
│                         # pi.extensions: ["./dist/index.js"]
├── tsconfig.json         # copy pi-sec-quality config
├── README.md
├── CHANGELOG.md
├── vitest.config.ts      # or rely on default; matches existing packages
└── src/
    ├── index.ts          # default activate(pi): commands + tool + footer hook (SMALL)
    ├── schema.ts         # MetricReport, MetricScore, Finding types (public, exported)
    ├── runners.ts        # detectTool() + runTool(pi, tool, args) → raw JSON via pi.exec
    ├── normalize.ts      # pure: parseLizard/parseJscpd/parseAislop/parseSemgrep/parseGitleaks
    ├── score.ts          # pure: computeSpaghettiFactor, scoreComplexity, ..., aggregateScores
    ├── report.ts         # pure: renderMarkdownReport, reportPath, slugify
    ├── state.ts          # makeCleanSession, resetSession
    └── index.test.ts     # vitest, beside source
test/
    └── fixtures/         # canned tool JSON outputs (lizard, jscpd, aislop, semgrep, gitleaks)
```

**Design principles (from research):**
1. `pi.exec()` for all external tools — never reimplement analyzers.
2. JSON everywhere — every chosen tool emits JSON/SARIF; never regex human output.
3. Pure helpers exported for tests; `activate()` stays a thin wiring layer.
4. Truncate LLM-facing output (50KB/2000 lines via `truncateHead`/`truncateTail`); persist full report to disk.
5. Degrade gracefully — if a tool is missing, report "tool missing" for that metric, don't fail the whole scan.

---

## 3. Phased Task Breakdown

### Phase 0 — Scaffold (foundation)
- [ ] Create `packages/pi-code-quality/` with `package.json`, `tsconfig.json`, `CHANGELOG.md`, empty `src/` (copy structure from `pi-sec-quality`).
- [ ] Define `schema.ts` types: `MetricReport`, `MetricScore`, `Finding`, `Severity`, `ScanConfig` (weights, thresholds, `failBelow`).
- [ ] `pnpm install` to link workspace; confirm `build:self`/`check:self`/`test:self` pass with a stub.

### Phase 1 — Runners + Normalizers
- [ ] `runners.ts`: `detectTool(name)` (checks `PATH`, plus `npx`/`pipx` fallback hints) and `runTool()` wrapper over `pi.exec` with timeout + cancellation via `signal`.
- [ ] `normalize.ts`: one pure parser per tool, each taking raw JSON → `Finding[]`:
  - `parseLizardJson` → cyclomatic complexity per function (flag CC > threshold)
  - `parseJscpdJson` → duplication % + clone locations
  - `parseAislopJson` → slop rules + 0–100 score
  - `parseSemgrepJson` → severity-classified security findings
  - `parseGitleaksJson` → secret findings (live + history)
- [ ] Fixture files under `test/fixtures/` for each tool's real JSON shape.

### Phase 2 — Scoring & Aggregation
- [ ] `score.ts` pure functions:
  - `computeSpaghettiFactor(scc, globals, sloc)` → SF number + band (sweet-spot / review / refactor / untestable / unmaintainable).
  - `scoreComplexity`, `scoreDuplication`, `scoreSpaghetti`, `scoreSecurity`, `scoreSecrets`, `scoreSlop` → each 0–100.
  - `aggregateScores(metricScores, weights)` → weighted overall 0–100 (default weights: complexity 25, duplication 20, spaghetti 20, security 15, secrets 10, slop 10 — configurable).
- [ ] Threshold gating: `evaluateGate(report, failBelow)` → pass/fail + exit intent for CI mode.

### Phase 3 — Tools, Commands, UI, Footer
- [ ] `index.ts` `activate(pi)`:
  - Tool `code_quality_scan` (TypeBox params: `target`, optional `tools[]`, `depth`) — LLM-callable.
  - Commands: `/code-quality:scan [path]`, `/code-quality:status`, `/code-quality:report`.
  - `renderResult` scorecard via `@earendil-works/pi-tui` (compact per-metric table; expand for worst files).
  - `renderCall` header.
- [ ] Footer hook: register `code-quality` badge (`📐 87%`) with `@victorhg/pi-footer/registry`, silently skipped if absent (mirror `pi-sec-quality`).
- [ ] Truncation + full report written to `quality/<slug>-report.md`.

### Phase 4 — Docs & Wiring
- [ ] `README.md`: features, install, command/tool tables, metric→tool mapping, config (`weights`, `failBelow`), boundary notes vs `pi-sec-quality`/`pi-hallmark`.
- [ ] Update `docs/package-map.md`: add row to **Installable Packages** + footer-integration note; decide **Root bundle** inclusion (recommend ❌ opt-in initially, mirroring `pi-no-bash`/`pi-last-session`, until sandbox-validated).
- [ ] `CHANGELOG.md` initial entry.

### Phase 5 — Release
- [ ] Follow `pi-release-workflow` skill (version, changeset, publish `@victorhg/pi-code-quality`).
- [ ] Run `pi-package-sandbox-test` skill against the published version.

---

## 4. Automated Tests (Vitest, `src/index.test.ts`)

Mirror `pi-sec-quality`'s convention: **pure helpers are the test surface**; `activate()` wiring is exercised via integration tests with a mocked `pi.exec`.

**Unit tests (pure, no I/O):**

| Function | Cases |
|---|---|
| `computeSpaghettiFactor` | exact formula (e.g. SCC 9, 1 global, 100 SLOC → 19); band boundaries (5, 15, 20, 30, 50, 75); zero/edge inputs |
| `scoreComplexity` | all functions under threshold → 100; one over threshold → <100; empty input → neutral |
| `scoreDuplication` | 0% → 100; 50% → 50; clamps at 0 |
| `scoreSpaghetti` | SF ≤10 → 100; SF ≥50 → 0; linear midpoint |
| `aggregateScores` | uniform weights → mean; zero-weight metric excluded; custom weights respected; result in [0,100] |
| `evaluateGate` | score ≥ `failBelow` passes; below fails; missing score neutral |
| `parseLizardJson` / `parseJscpdJson` / `parseAislopJson` / `parseSemgrepJson` / `parseGitleaksJson` | fixture JSON → expected `Finding[]`; malformed/empty JSON → empty or graceful error |
| `slugify` / `reportPath` | URL-safe slugs; blank → fallback; path format |
| `renderMarkdownReport` | contains score header, per-metric sections, worst-file list, findings |
| `makeCleanSession` / `resetSession` | clean state; reset clears last scan |

**Integration tests (mocked `pi.exec`):**

| Test | Setup | Assert |
|---|---|---|
| Full scan happy path | mock `pi.exec` returns fixture JSON per tool | `MetricReport` populated; overall score computed; all six metrics present |
| Missing tool | mock `detectTool` → not found | that metric marked `unavailable`, others still computed |
| Tool errors | mock `pi.exec` returns non-zero `code` | metric marked `error`, scan does not throw |
| Gate failure | `failBelow: 80`, report score 60 | `evaluateGate` → fail |
| Truncation | oversized tool output | LLM content ≤ 50KB; full report written to temp file |

**Golden-path smoke test (skippable):** a real run against a small checked-in fixture repo (`test/fixtures/sample-repo/`) when tools are installed, skipped with a clear message when `detectTool` fails. This is the "validate it is working" proof.

---

## 5. Documentation Checklist

- [ ] `packages/pi-code-quality/README.md` — features, install, commands, tools, metric→tool table, config, boundaries.
- [ ] `docs/package-map.md` — Installable Packages row + Root bundle decision + footer note.
- [ ] `packages/pi-code-quality/CHANGELOG.md` — initial version entry.
- [ ] Root `README.md` — add `@victorhg/pi-code-quality` to the distribution package list (per `AGENTS.md` rule: "When adding a feature, update README.md").

---

## 6. Validation ("is it working?") — per `pi-validation-flow`

**Pre-implementation baseline:** record `git diff --name-only` before starting.

**After each phase / before reporting completion:**

1. **Narrowest package checks:**
   ```bash
   pnpm --filter @victorhg/pi-code-quality run check:self   # tsc --noEmit
   pnpm --filter @victorhg/pi-code-quality run test:self    # vitest
   pnpm --filter @victorhg/pi-code-quality run build:self   # tsc emit
   ```
2. **LSP diagnostics** on all changed TypeScript files (`src/*.ts`).
3. **Root checks** (only when root files changed — package.json, package-map.md, README, lockfile):
   ```bash
   pnpm install        # refresh lockfile for workspace wiring
   pnpm run check      # all packages
   pnpm run test       # all packages
   ```
4. **Skill checks** (only if `.agents/*` skills changed — not expected here):
   ```bash
   pnpx check-skills validate .agents --recursive --json
   ```

**Manual smoke test (the real "does it work"):**
1. Run `/code-quality:scan` on a **known-bad fixture** (`test/fixtures/sample-repo/`) → expect low score, worst-file list, findings.
2. Run `/code-quality:scan` on a **clean fixture** → expect high score, few/no findings.
3. Run `/code-quality:report` → verify `quality/<slug>-report.md` written and well-formed.
4. Run `/code-quality:status` before any scan → expect graceful "no scan yet" notify.
5. Install alongside `@victorhg/pi-footer` → verify `📐` badge appears.

**Release validation** (`pi-package-sandbox-test` skill, after publish):
- `pnpx @earendil-works/pi-coding-agent install npm:@victorhg/pi-code-quality@<ver>` exits 0.
- `pnpx @earendil-works/pi-coding-agent -e npm:@victorhg/pi-code-quality@<ver> --help` exits 0.
- No `ERR_MODULE_NOT_FOUND` / `SyntaxError` / `TypeError` in startup output.
- Passes when installed together with the rest of the bundle.

---

## 7. Acceptance Criteria

- [ ] All six requested metrics are produced (or cleanly reported unavailable) by `/code-quality:scan`.
- [ ] One consolidated 0–100 maintainability score + per-metric scores.
- [ ] Spaghetti Factor formula is unit-tested against Koopman's reference values.
- [ ] Unit tests cover every pure helper; integration tests cover the mocked `pi.exec` path.
- [ ] Fixtures are real tool-output shapes (not invented JSON).
- [ ] README + package-map + root README updated; CHANGELOG seeded.
- [ ] Package builds, type-checks, and tests green; sandbox install test passes.
- [ ] No overlap/conflict with `pi-sec-quality` (security) or `pi-hallmark` (design slop) — boundaries documented.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tools not installed on user machines | detect-then-run; ad-hoc `npx aislop`/`pipx run` fallbacks; per-metric "unavailable" |
| JS/Python "globals" for SF are ill-defined | v1 approximates module-level mutable state; document the convention |
| `aislop`/`semgrep` JSON schema drift | fixture tests pin shapes; parsers defensive on unknown fields |
| Overlap with existing packages | explicit delegation rules (Section 1); shared footer slot, not duplicated logic |
| Output floods LLM context | truncateHead/Tail at 50KB/2000 lines; full report to disk |
