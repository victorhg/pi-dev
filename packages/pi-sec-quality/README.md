# @victorhg/pi-sec-quality

Automated web application security assurance and vulnerability scanning (OWASP Top 10, secret detection, API safety) for the Pi coding agent.

## Features

- **Secret & API Key Detection**: Scans codebase for hardcoded API keys, JWT secrets, private keys, and environment leaks.
- **Vulnerability Scans**: Checks for XSS risks (`dangerouslySetInnerHTML`), unvalidated inputs, and missing API security controls.
- **Custom Tools**: Exposes `sec_quality:audit` for autonomous security evaluations by the agent.
- **Slash Commands**:
  - `/sec-quality:audit [path]` — Run a security scan on a file, directory, or project.
  - `/sec-quality:status` — View security health scores and violation counts.
  - `/sec-quality:report` — Generate and save a detailed Markdown security audit report to `security/<slug>-audit.md`.
- **Status Bar Integration**: Displays a live security badge (`🛡️ 100%` or `🚨 2 vulns`) in the status bar when paired with `@victorhg/pi-footer`.

## Installation

```bash
pi install @victorhg/pi-sec-quality
```

## Commands

| Command | Description |
|---|---|
| `/sec-quality:audit [path]` | Scan code for secrets, XSS, and security misconfigurations. |
| `/sec-quality:status` | Show summary of last security audit scores and vulnerabilities. |
| `/sec-quality:report` | Save a comprehensive Markdown security audit report. |
