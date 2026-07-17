---
name: code-quality
description: Use when requesting code analysis, style reviews, linting recommendations, or refactoring suggestions to improve maintainability, performance, and readability.
---

# Code Quality Skill

## Workflow

1. Identify the target file(s) or diff to review.
2. Evaluate the code across the five review axes below.
3. Categorize each finding as Critical, Suggestion, or Style.
4. Produce a summary followed by specific code snippets showing the
   suggested improvement for each finding.

## Review Axes

Evaluate the code across these five axes:

1. **Correctness**: Does it handle edge cases? Are types accurate?
2. **Readability & Simplicity**: Is the code intuitive? Are variable
   names descriptive? Does it follow "clean code" principles?
3. **Architecture**: Is there unnecessary complexity? Could this be
   modularized?
4. **Security**: Are there obvious vulnerabilities (e.g. missing input
   sanitization)?
5. **Performance**: Are there inefficient loops, unnecessary
   allocations, or blocking operations in critical paths?

## Trigger

Trigger on "code review", "lint", "improve quality", "refactor", or
"static analysis".

## Output format

- Provide a summary of findings.
- Offer specific code snippets with improvements, e.g.:

  ```diff
  - const x = data.map(d => d.value).filter(v => v)
  + const x = data.map((d) => d.value).filter(Boolean);
  ```

- Categorize feedback as "Critical", "Suggestion", or "Style".
