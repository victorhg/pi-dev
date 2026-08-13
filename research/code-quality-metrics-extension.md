# Code Quality Metrics Extension — Research & Plan

> **Status:** Research complete · **Date:** 2026-08-12
> **Goal:** Research and plan a Pi coding-agent extension that runs code-quality metrics to assess how well and maintainably code is written — complexity, cyclomatic complexity, code duplication, spaghetti index, security errors, exposed secrets, and anti-code-slop patterns.

---

## Overview

The requested extension sits at the intersection of **static code metrics** (complexity, duplication, spaghetti factor), **security analysis** (SAST + secret scanning), and a newer category — **"AI code-slop" detection** (identifying tell-tale artifacts of low-quality AI-generated code). Each concern has mature, mostly CLI-driven tooling, and the Pi extension SDK provides a clean surface for orchestrating these tools and rendering a consolidated "maintainability scorecard."

Two important scoping facts shape the plan:

1. **The repo already ships `@victorhg/pi-sec-quality`** — a regex-based security scanner (secrets, XSS, API-security, misconfiguration) with `/sec-quality:*` commands, a `sec_quality_audit` tool, and footer integration [^16]. A new "code quality" extension should **complement, not duplicate** it: own the *complexity / duplication / spaghetti / slop* space, and delegate or deepen *security / secrets* via real external tools rather than regex.
2. **All the heavy lifting is available as external CLIs** — the extension's job is orchestration, result normalization, and UI, not reimplementing analyzers.

---

## Key Concepts

| Metric | Definition | How it's computed |
|---|---|---|
| **Cyclomatic complexity (McCabe)** | Number of linearly independent paths through a program's control-flow graph. `M = E − N + 2P` (edges − nodes + 2×components); ≈ branches + 1. Measures testability/path count, *not* readability [^1]. | Control-flow graph analysis; `lizard`, `radon cc`, Sonar |
| **Cognitive complexity** | Sonar's metric for how *hard to understand* code is. Adds incremental cost for nesting, breaks in linear flow, logical operators (vs. cyclomatic's pure path count) [^2]. | SonarQube/SonarLint; approximated by `radon`'s McCabe variants |
| **Strict cyclomatic complexity (SCC / CC2)** | Cyclomatic variant that counts each condition inside a compound `if` separately — approximates MC/DC test-case count [^3]. | `radon` (CC2), some lizard options |
| **Halstead metrics** | Vocabulary, length, volume, difficulty, effort derived from counts of operators/operands [^4]. | `radon hal` |
| **Maintainability Index (MI)** | 0–100 scale combining Halstead volume, cyclomatic complexity, and LOC; higher = more maintainable. Used in Visual Studio and `radon` [^4]. | `radon mi` |
| **Code duplication / clones** | Identical or near-identical blocks across a codebase. Detected via token-sequence/structural comparison (CPD, `jscpd`, `lizard` copy-paste) [^5][^6]. | `jscpd`, `lizard -C`, Sonar CPD |
| **Spaghetti Factor (SF / KSF)** | Koopman's composite: **SF = SCC + (Globals × 5) + (SLOC / 20)**. Balances control complexity, data complexity (global state), and module size into one number. Thresholds: 5–10 sweet spot; 15 soft cap; 20 review; 30 refactor design; 50 untestable; 75 unmaintainable [^3]. | Compute from SCC + globals + SLOC outputs |
| **Security errors (SAST)** | Static detection of vulnerability classes (injection, XSS, path traversal, unsafe deserialization, etc.) via pattern- or semantic-analysis [^9][^10][^11]. | `semgrep`, `bandit`, CodeQL |
| **Exposed secrets** | Hardcoded credentials/keys/tokens in source or git history. Detected via regex + entropy, optionally *validated* against live providers [^8]. | `gitleaks`, `trufflehog`, Semgrep Secrets |
| **Anti code-slop patterns** | Heuristics for low-quality AI-generated code: narrative comments over self-explanatory code, swallowed exceptions, hidden fallbacks, `as any` casts, hallucinated imports, duplicated helpers, empty functions, dead code, TODO stubs, oversized functions [^13]. | `aislop` (50+ deterministic rules, 10 languages, 0–100 score) |

**Relationship graph:** *cyclomatic → SCC → Spaghetti Factor* (SF is a superset). *MI* aggregates cyclomatic + Halstead + LOC. *Duplication* and *slop* are largely orthogonal but overlap on "duplicated helpers" and "oversized functions." *Security errors* and *secrets* are a separate axis — high complexity or duplication is not itself a vulnerability, but poor structure correlates with latent defects.

---

## Findings

### SQ1 — What are these metrics, and how is each measured?

The seven requested concerns decompose into **three distinct families**, not one:

- **Structural complexity** — cyclomatic/cognitive complexity, duplication, and the spaghetti factor. These are *proxies for human difficulty*: cyclomatic measures test paths, cognitive measures comprehension, and SF deliberately blends control flow + global data + size because "the stuff that will really make your brain hurt is code that has all of these problems" [^3].
- **Security** — SAST errors and exposed secrets. These are *correctness/safety* concerns detected by rule- or semantics-based scanners, with secrets increasingly *validated* (does the token actually work?) to cut false positives [^7][^8].
- **"Code slop"** — a 2024–2025 term for recognizable low-quality AI-generated output. Unlike the first two families, this has **no established academic metric**; it is currently defined by heuristic rule sets (narrative comments, swallowed exceptions, hidden fallbacks, hallucinated imports, etc.) [^13]. Empirical research on developer perceptions is thin [^15].

**Key caveat:** a formal theory of "spaghetti code" does not exist — it remains intuitive — but the Koopman SF formula is the closest thing to an operational, single-number definition [^3][^14]. Metrics are indicators, not verdicts: "if you score poorly on this metric, most likely your code is in need of improvement," but a good score is no guarantee [^3].

### SQ2 — Tools for complexity & duplication

Three production-grade options emerged, each with a different strength:

| Tool | Scope | Metrics | Notes | Credibility |
|---|---|---|---|---|
| **Radon** | Python only | McCabe CC, SCC (CC2), raw metrics, Halstead, Maintainability Index | `radon cc/hal/raw/mi`, JSON output; the reference implementation for MI/SCC [^4] | High |
| **Lizard** | 20+ languages (C/C++, Java, JS, Python, Ruby, Swift, C#, Obj-C…) | Cyclomatic complexity + **copy-paste detection**; no headers/imports needed [^5] | Best single-tool breadth for complexity *and* duplication; extensible | High |
| **jscpd** | 223+ languages | Duplication/clone detection only | v5 is a Rust rewrite, up to ~37× faster than v4; `--reporters json` [^6] | High |

Recommendation: **lizard** as the complexity workhorse (breadth), **jscpd** for serious duplication, **radon** where exact MI/SCC numbers on Python are required. All emit JSON, which is essential for a Pi extension to parse.

### SQ3 — Tools for security errors & exposed secrets

**SAST (security errors):**

- **Semgrep** — lightweight pattern-based SAST running directly on source; fast, easy to extend with custom rules; open-source engine with optional proprietary rules. Recommended default for an agent extension because it needs no build step [^9][^10].
- **CodeQL** — semantic engine that builds a queryable database for deep data-flow analysis; scores higher on some benchmarks (OWASP F1 74.4% vs 69.4%) but requires a buildable environment, is not open source, and needs a license for non-open-source code [^10].
- **Bandit** — the standard Python security linter (PyCQA); CWE-focused rules including a hardcoded-credentials rule under development [^11].

**Exposed secrets:**

- **Gitleaks** — git-history + working-tree scanning via regex + entropy; fast, designed for pre-commit/CI gating [^8].
- **TruffleHog** — scans history *and* verifies found secrets against live providers (much lower false-positive rate); started as Shannon-entropy detection [^8].
- **Semgrep Secrets** — semantic secret validation and entropy analysis within the Semgrep ecosystem [^7].

Key insight: **running a single secret scanner is almost always insufficient** — tools differ in history coverage, entropy model, and validation [^8]. A robust extension should run at least one history scanner (gitleaks/trufflehog) *and* a working-tree check.

### SQ4 — Anti code-slop detection

"Code slop" describes AI-generated code that passes tests and linters yet "rots anyway" [^13]. The leading practical tooling is **`aislop`** (scanaislop): a deterministic, sub-second, LLM-free scanner with **50+ rules across 10 language targets** (TypeScript, JavaScript, Expo/React Native, Python, Go, Rust, Ruby, PHP, C#, C/C++), scoring every change **0–100**. Notably it also bundles *formatting, linting, complexity, and security checks* — i.e., it overlaps several other requested metrics [^13].

Detected slop patterns include: narrative comments above self-explanatory code, swallowed exceptions, hidden fallbacks, `as any` casts, hallucinated imports, duplicated helpers, empty functions with real-looking bodies, dead code, TODO stubs, and oversized functions [^13]. It ships JSON + SARIF output, inline `aislop-ignore-*` suppression directives, and CI gating (`failBelow`) — all directly usable by an agent extension [^13].

There is also a broader "AI slop code review checklist" community literature [^12], but **no rigorous academic standard**; treat slop rules as tunable heuristics [^15].

### SQ5 — Pi integration architecture

The Pi SDK supports this cleanly. Confirmed capabilities (from local docs, `extensions.md`) [^16]:

- **`pi.registerTool()`** — an LLM-callable tool with TypeBox schema; `execute()` can run shell commands via **`pi.exec(command, args, { signal, timeout })`** and stream progress via `onUpdate()`.
- **`pi.registerCommand()`** — slash commands like `/code-quality:scan` (commands can also be invoked by the agent).
- **`pi.exec()`** — shell execution returning `{ stdout, stderr, code, killed }`; the sanctioned way to run external CLIs.
- **Custom rendering** — `renderCall`/`renderResult` with `@earendil-works/pi-tui` components for a compact scorecard; `renderShell: "self"` for full control.
- **Persistent cards** — `pi.appendEntry()` + `pi.registerEntryRenderer()` for a non-LLM-context scoreboard.
- **Truncation utilities** — `truncateHead`/`truncateTail`/`DEFAULT_MAX_BYTES` (50KB) to keep tool output safe for LLM context.
- **Dependencies** — npm packages work via a `package.json` next to the extension (directory/package style); distributed pi packages must declare runtime deps in `dependencies`.

**Proposed architecture** (following the repo's existing `pi-sec-quality` shape [^16][^17]):

```
packages/pi-code-quality/
├── package.json          # @victorhg/pi-code-quality, pi.extensions = ["./dist/index.js"]
├── README.md
└── src/
    ├── index.ts          # default activate(pi): commands + tool + footer hook
    ├── runners.ts        # per-tool detection + pi.exec wrappers (lizard, jscpd, semgrep, gitleaks, aislop)
    ├── normalize.ts      # unify JSON outputs → MetricReport
    ├── score.ts          # aggregate → 0–100 maintainability score + per-metric scores
    └── render.ts         # markdown report + TUI renderResult
```

**Metric → tool mapping:**

| Requested metric | Tool | Strategy |
|---|---|---|
| Cyclomatic / cognitive complexity | `lizard` (multi-lang) / `radon` (Python) | parse JSON; flag functions > threshold |
| Code duplication | `jscpd --reporters json` (fallback: `lizard -C`) | duplication % per file |
| Spaghetti index | compute **SF = SCC + globals×5 + SLOC/20** from lizard/radon output [^3] | per-module; globals need language-specific extraction |
| Security errors | `semgrep --json` (fallback: `bandit` for Python) | severity-classified findings |
| Exposed secrets | `gitleaks detect --report-format json` (+ optional `trufflehog`) | live + git history |
| Anti code-slop | `aislop scan --json` | 0–100 slop score + rule findings |

**Design principles:**

1. **Detect-then-run, degrade gracefully.** These CLIs are not installed on this machine (verified: only `python3 3.13`, `node 26` present). The extension should probe availability, offer ad-hoc `npx aislop` / `pipx run` fallbacks, and report "tool missing" rather than failing.
2. **JSON everywhere.** Every chosen tool emits JSON/SARIF; never regex-parse human output.
3. **Compose, don't duplicate.** Delegate *security/secrets* depth to external tools and coexist with `pi-sec-quality`; own complexity/duplication/spaghetti/slop which no existing package covers [^17].
4. **One scorecard, per-metric drill-down.** Aggregated 0–100 "maintainability" score on top, per-metric scores and worst files below; gate with thresholds mirroring SF scoring [^3].
5. **Truncate + persist.** Keep LLM-facing content ≤ 50KB; write the full report to `quality/<slug>-report.md` (mirroring `pi-sec-quality`'s `security/` convention) [^16][^17].

---

## References

[^1]: Wikipedia — *Cyclomatic complexity* — https://en.wikipedia.org/wiki/Cyclomatic_complexity — **High** — accessed 2026-08-12
[^2]: Sonar — *Cognitive Complexity: Because testability != understandability* — https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability — **High** — accessed 2026-08-12
[^3]: P. Koopman — *The Spaghetti Factor (SF) Software Complexity Metric* — https://betterembsw.blogspot.com/2017/08/the-spaghetti-factor-software.html — **High** — accessed 2026-08-12
[^4]: PyPI — *radon* — https://pypi.org/project/radon/ — **High** — accessed 2026-08-12
[^5]: GitHub — *terryyin/lizard (cyclomatic complexity analyzer)* — https://github.com/terryyin/lizard — **High** — accessed 2026-08-12
[^6]: jscpd — *Copy/Paste Detector* — https://jscpd.dev/ — **High** — accessed 2026-08-12
[^7]: Semgrep — *Semgrep Secrets — conceptual overview* — https://semgrep.dev/docs/semgrep-secrets/conceptual-overview — **High** — accessed 2026-08-12
[^8]: Secrails — *TruffleHog vs Gitleaks vs GitHub secret scanning guide* — https://secrails.com/blog/trufflehog-vs-gitleaks-github-secret-scanning-guide — **Medium** — accessed 2026-08-12
[^9]: Semgrep — *Semgrep vs CodeQL comparison* — https://semgrep.dev/docs/faq/comparisons/codeql — **High** (vendor, note bias) — accessed 2026-08-12
[^10]: Sourcegraph — *Code complexity* — https://sourcegraph.com/blog/code-complexity — **High** — accessed 2026-08-12
[^11]: GitHub — *PyCQA/bandit PR #1167 (hardcoded credentials / CWE-798)* — https://github.com/PyCQA/bandit/pull/1167 — **High** — accessed 2026-08-12
[^12]: Potapov — *AI slop code review checklist* — https://potapov.dev/blog/ai-slop-detection/ — **Medium** — accessed 2026-08-12
[^13]: GitHub — *scanaislop/aislop* — https://github.com/scanaislop/aislop — **Medium-High** (young project, active) — accessed 2026-08-12
[^14]: N. Drozd — *A formal theory of spaghetti code* — https://nickdrozd.github.io/2022/03/12/formal-theory-of-spaghetti-code.html — **Medium** — accessed 2026-08-12
[^15]: arXiv — *AI slop: qualitative analysis (preprint)* — https://arxiv.org/html/2603.27249v1 — **Low** (unverified preprint) — accessed 2026-08-12
[^16]: Pi coding agent docs — *extensions.md* (ExtensionAPI, `pi.registerTool`, `pi.exec`, custom rendering, truncation) — local `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` — **High** — accessed 2026-08-12
[^17]: `@victorhg/pi-sec-quality` — existing regex-based security extension — local `packages/pi-sec-quality/` — **High** — accessed 2026-08-12

---

## Directions

**Open questions to resolve before implementation:**

1. **Language scope.** The repo is TypeScript/Svelte + Python. `lizard`/`jscpd`/`aislop` cover both; `radon`/`bandit` are Python-only. Decide whether the first release targets all languages or TS-first.
2. **Spaghetti Factor globals extraction.** SF requires counting read/write globals, which is well-defined in C but ambiguous in JS/Python (module-level bindings vs. true globals). Need a per-language convention or to approximate with "module-level mutable state."
3. **Tool provisioning.** Ship as thin orchestration (detect + ad-hoc `npx`/`pipx run`) vs. declare install dependencies. Affects the `@victorhg/pi-*` package install experience (pi packages install with `--omit=dev`).
4. **Relationship to `pi-sec-quality`.** Merge security/secrets into one package, or keep `pi-code-quality` orthogonal and let `pi-sec-quality` remain the security owner? Recommended: keep separate; add a shared footer slot convention via `@victorhg/pi-footer`.

**Recommended next steps:**

1. Draft the `MetricReport` schema (per-metric score, findings list, thresholds) as the contract between runners and renderers.
2. Prototype a single runner (`aislop` or `lizard`) end-to-end through `pi.exec` → normalize → `renderResult` scorecard.
3. Validate the package against the repo's `pi-extension-development` and `pi-package-sandbox-test` skills before publishing.
4. Add thresholds + CI gate (`failBelow`) once the score aggregation stabilizes.

**Validation note (for this research task):** changed file is `research/code-quality-metrics-extension.md` (new, docs-only). No package/TS/Svelte files touched, so no build/LSP checks apply. References [^9] (vendor comparison) and [^15] (unverified preprint) carry the highest risk of bias/inaccuracy and were weighted accordingly.
