# @victorhg/pi-code-quality

Code quality metrics for the Pi coding agent. Runs external analyzers to score **complexity, code duplication, spaghetti index, security errors, exposed secrets, and anti-code-slop patterns**, then aggregates them into a single maintainability scorecard (0–100).

## Features

- **Cyclomatic complexity** via `lizard` (20+ languages), flagged per function.
- **Code duplication** via `jscpd` (223+ languages), reported as a percentage.
- **Spaghetti Factor (Koopman SF)** computed from complexity + size (`SF = SCC + Globals×5 + SLOC/20`), per file.
- **Security errors** via `semgrep` (multi-language SAST).
- **Exposed secrets** via `gitleaks` (working tree scan, redacted output).
- **Anti-code-slop** via `aislop` (50+ deterministic rules, 10 languages, 0–100 score).
- **Multi-language routing** — detects project languages and skips tools that cannot score them.
- **Aggregate scorecard** with configurable metric weights and a pass/fail gate.
- **Footer badge** (`📐 87%`) via `@victorhg/pi-footer` (optional).

## Installation

```bash
pi install @victorhg/pi-code-quality
```

### Tool requirements

`pi-code-quality` orchestrates external CLIs and degrades gracefully when one is missing (the metric is reported `unavailable`). Install the tools you want to use:

| Metric | Tool | Install |
|---|---|---|
| Complexity + Spaghetti | `lizard` | `pipx install lizard` |
| Duplication | `jscpd` | `npm i -g jscpd` |
| Security | `semgrep` | `pipx install semgrep` |
| Secrets | `gitleaks` | `brew install gitleaks` |
| Slop | `aislop` | `npm i -g aislop` |

Missing tools are detected at runtime; `npx`/`pipx run` fallbacks are attempted where available.

## Commands

| Command | Description |
|---|---|
| `/code-quality:scan [path]` | Run a scan on a file, directory, or project (default: workspace root). |
| `/code-quality:status` | Show the last scorecard. |
| `/code-quality:report` | Save a Markdown report to `quality/<slug>-report.md`. |

## Agent Tool

`code_quality_scan` — the agent can run it autonomously (e.g. "assess this code's maintainability") and receive the scorecard plus the top findings.

## Metric → tool mapping

| Metric | Tool | Key output |
|---|---|---|
| `complexity` | `lizard --csv -V` | per-function cyclomatic complexity |
| `duplication` | `jscpd --reporters json` | duplication percentage + clones |
| `spaghetti` | computed from lizard | per-file Spaghetti Factor |
| `security` | `semgrep scan --json` | severity-classified findings |
| `secrets` | `gitleaks detect --report-format json` | leaked secrets |
| `slop` | `aislop scan --json` | 0–100 slop score + rules |

## Scoring

Each metric is scored 0–100 and combined with configurable weights (defaults below). Metrics that could not run are reported `unavailable` and excluded from the aggregate.

| Metric | Default weight |
|---|---|
| Complexity | 25 |
| Duplication | 20 |
| Spaghetti Factor | 20 |
| Security | 15 |
| Secrets | 10 |
| Code Slop | 10 |

### Configuration

Weights, the gate threshold, and the complexity threshold are tunable via `ScanConfig` (currently passed programmatically; a config-file loader is a follow-up):

```ts
{
  weights: { complexity: 25, duplication: 20, spaghetti: 20, security: 15, secrets: 10, slop: 10 },
  failBelow: 70,          // overall score below this fails the gate
  complexityThreshold: 15 // cyclomatic complexity flag threshold
}
```

### Spaghetti Factor bands

| SF value | Band | Verdict |
|---|---|---|
| ≤ 10 | sweet-spot | Great |
| ≤ 15 | ok | Fine |
| ≤ 20 | review | Look closely |
| ≤ 30 | refactor | Refactor the design |
| ≤ 50 | untestable | Throw away and redesign |
| ≤ 75 | unmaintainable | Start over |
| > 75 | nightmare | Re-architect the subsystem |

> **v1 approximation:** the `Globals` term is set to 0 because "global variable" is language-ambiguous (well-defined in C, murky in JS/Python). SF is computed per function as `CCN + (nloc / 20)`, and the worst function gates the project score.

## Boundaries with other packages

- **`@victorhg/pi-sec-quality`** — owns lightweight regex-based security/secrets auditing. `pi-code-quality` deepens that via real SAST/secret tools rather than duplicating regex rules.
- **`@victorhg/pi-hallmark`** — owns *visual/design* anti-slop (gradients, typography, UI structure). `pi-code-quality` owns *code-structure* slop (narrative comments, swallowed exceptions, `as any`, dead code) via `aislop`.
