# @victorhg/pi-web-quality

Automated web quality assurance (Accessibility / a11y, Performance, SEO, and Semantic HTML) for the Pi coding agent.

## Features

- **Automated Web Audits**: Scans workspace files (`.tsx`, `.jsx`, `.html`, `.vue`, `.svelte`, package.json) for accessibility issues, SEO gaps, performance risks, and semantic violations.
- **Custom Tools**: Exposes `web_quality:audit` so the agent can autonomously audit generated code.
- **Slash Commands**:
  - `/web-quality:audit [path]` — Run a web quality audit on a file, directory, or project.
  - `/web-quality:status` — View health scores and violation counts.
  - `/web-quality:report` — Generate and save a detailed Markdown audit report to `web-quality/<slug>-audit.md`.
- **Status Bar Integration**: Displays a live quality badge (`🌐 95%` or `⚠️ a11y:78`) in the status bar when paired with `@victorhg/pi-footer`.

## Installation

```bash
pi install @victorhg/pi-web-quality
```

## Commands

| Command | Description |
|---|---|
| `/web-quality:audit [path]` | Scan files and calculate accessibility, SEO, and performance scores. |
| `/web-quality:status` | Show summary of last audit scores and critical violations. |
| `/web-quality:report` | Save a comprehensive Markdown audit report. |
