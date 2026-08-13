---
name: code-quality
# prettier-ignore
description: Configure and run the @victorhg/pi-code-quality extension via code-quality.json (metric weights, failBelow gate, complexity threshold, file/directory excludes) and the /code-quality:scan commands. Use when the user asks to configure code quality scanning or run a quality assessment.
---

# Code Quality Extension — Configuration

The `@victorhg/pi-code-quality` extension scans a codebase for complexity, duplication, spaghetti index, security errors, exposed secrets, and AI code-slop, then reports a 0–100 maintainability score.

## Configuration file

Config lives in `code-quality.json` at the project root. All keys are optional:

```json
{
  "weights": {
    "complexity": 25,
    "duplication": 20,
    "spaghetti": 20,
    "security": 15,
    "secrets": 10,
    "slop": 10
  },
  "failBelow": 70,
  "complexityThreshold": 15,
  "exclude": ["**/legacy/**", "**/generated/**"]
}
```

## Options

| Key | Type | Meaning |
|---|---|---|
| `weights` | object | Per-metric weights for the aggregate score; should sum to 100. Keys: `complexity`, `duplication`, `spaghetti`, `security`, `secrets`, `slop`. |
| `failBelow` | number | Overall score below this fails the gate. |
| `complexityThreshold` | number | Cyclomatic complexity that flags a function as a finding. |
| `exclude` | string[] | Extra gitignore-style globs to skip (additive to built-in defaults). |

## Applying a configuration change

1. Read `code-quality.json` (create it if missing).
2. Merge the requested change, preserving existing keys.
3. Re-run `/code-quality:scan` to apply.

## Common requests → config

| Request | Config change |
|---|---|
| "Set the complexity threshold to 20" | `"complexityThreshold": 20` |
| "Exclude the vendor directory" | `"exclude": ["**/vendor/**"]` |
| "Exclude test files and snapshots" | `"exclude": ["**/*.test.*", "**/*.snap"]` |
| "Weigh security higher" | adjust `weights` (e.g. `"security": 25`, lower others so the total stays 100) |
| "Only fail below 50" | `"failBelow": 50` |

## Running a scan

- `/code-quality:scan [path]` — run a scan; shows a scorecard and findings with severity, file:line, and a fix hint.
- `/code-quality:doctor` — check which analyzer tools are installed.
- `/code-quality:status` — show the last scorecard.
- `/code-quality:report` — save a Markdown report to `quality/<slug>-report.md`.

## Notes

- Missing analyzer tools are reported `unavailable` (not an error). Install: `lizard` (pip), `jscpd` (npm), `semgrep` (pip), `gitleaks` (brew), `aislop` (npm).
- `exclude` is additive to built-in defaults (node_modules, dist, test files, fixtures, etc.).
- gitleaks uses a `.gitleaksignore` file, not the `exclude` list.
