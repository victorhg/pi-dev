# Changelog

## 0.1.0

- Initial release
- Code quality metrics: cyclomatic complexity (`lizard`), code duplication (`jscpd`), spaghetti index (Koopman SF), security errors (`semgrep`), exposed secrets (`gitleaks`), anti-code-slop (`aislop`)
- Multi-language project detection with per-tool routing and graceful `unavailable` fallback
- Configurable weights, pass/fail gate, complexity threshold, and directory/file excludes via `code-quality.json`
- Live scan progress (spinner + elapsed time) and a persistent transcript report card with severity, location, and remediation per finding
- Commands: `/code-quality:scan`, `/code-quality:status`, `/code-quality:report`, `/code-quality:doctor`
- Custom tool: `code_quality_scan` for agent-driven metric evaluation
- Markdown report generation to `quality/<slug>-report.md`
- Footer integration via `@victorhg/pi-footer` (optional)
