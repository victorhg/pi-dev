# Research: Creating a Coding Harness Extension (`pi-coder`) for Pi

## Overview

This research document explores the design, architecture, and implementation strategy for **`pi-coder`**, a modular coding harness extension suite for the [pi](https://pi.dev) coding agent ecosystem. Inspired by state-of-the-art local agent architectures such as *little-coder* [^1], `pi-coder` introduces specialized, composable guardian extensions and sub-agent workflows (`pi-coder-tester`, `pi-coder-sec`, `pi-coder-lint`) that enforce code quality, security guardrails, deterministic file integrity, and automated test-fix loops.

---

## Key Concepts

- **Coding Harness**: A supervisory execution layer wrapping an LLM coding agent that intercepts tool calls, validates inputs/outputs against deterministic rules, manages context windows, and steers model behavior upon failure [^2].
- **Pi Extension Hook Model**: Pi's event-driven extension architecture (`tool_call`, `tool_result`, `turn_end`, `before_agent_start`) allowing extensions to inspect, modify, block, or redirect agent actions without modifying core agent code [^3].
- **Specialized Sub-Coders (`pi-coder-*`)**: Isolated child agent sessions spawned for specialized verification tasks (e.g., test running, vulnerability scanning, lint checks) whose structured reports are surfaced to the main agent without cluttering the primary conversation context [^4].
- **Deterministic Guardrails**: Programmatic rules (such as read-before-edit enforcement, whole-file rewrite prevention for existing files, and context window overflow protection) that prevent small or medium models from falling into common reasoning traps [^1].

---

## Findings

### 1. Definition & Architecture of `pi-coder`
**Sub-Question**: What is a Pi coding harness extension (`pi-coder`), and how do modular sub-agents integrate with Pi's event-driven hook system?

A coding harness for pi operates as a collection of modular TypeScript extensions loaded at runtime via pi's extension loader [^3]. Rather than monolithic agent wrappers, `pi-coder` decomposes responsibilities into specialized sub-extensions:
- **`pi-coder` (Core Harness)**: Coordinates state, plan modes, and session orchestration.
- **`pi-coder-tester`**: Manages execution of test runners (`vitest`, `pytest`, `jest`) and automated test-fix feedback loops.
- **`pi-coder-sec`**: Integrates static security scanners (e.g., Semgrep, Sonar) and blocks risky shell or file operations.
- **`pi-coder-lint`**: Enforces stylistic and lint rules (`eslint`, `biome`, `ruff`) prior to finalization.

These components hook into Pi's lifecycle events: `tool_call` to inspect and block invalid operations, `tool_result` to sanitize or trim outputs before they enter the LLM context, and `turn_end` to assess response quality and trigger corrective steers [^1].

*Credibility: High | Relevance: 100/100*

### 2. Quality Assurance & Safety Guardrails
**Sub-Question**: How do deterministic validation guards ensure security and reliability based on reference architectures like *little-coder*?

Drawing directly from proven patterns in *little-coder*, a robust harness relies on four critical deterministic guards:
1. **Read-Before-Edit Enforcement (`read-guard-edit`)**: Intercepts `edit` tool calls and checks whether the target file was successfully `read` in the current session. If the model attempts to guess file contents without reading, the call is blocked with a strict redirection message [^1].
2. **Whole-File Rewrite Prevention (`write-guard`)**: Prevents models from rewriting existing files using `write` or shell redirection (`>`, `cat >`). It forces the model to use the precise `edit` tool with `oldText` and `newText` blocks, drastically reducing patch failure rates [^1].
3. **Context Window Overflow Protection (`read-guard`)**: Inspects `tool_result` events for `read` operations. If a file's length exceeds remaining token budgets, it trims the output to the first 30 lines plus structural warnings, guiding the model to use `grep` or targeted ranges [^1].
4. **Quality Monitor & Auto-Steering (`quality-monitor`)**: Monitors `turn_end` events for empty responses, hallucinated tool names, malformed JSON arguments, or repeated tool call loops, issuing immediate corrective feedback via `pi.sendUserMessage(..., { deliverAs: "steer" })` [^1].

*Credibility: High | Relevance: 100/100*

### 3. Execution Loops & Test Feedback (`pi-coder-tester`)
**Sub-Question**: How can specialized sub-coders execute test suites, static analysis, and vulnerability scanners autonomously?

Closing the build-test-fix cycle requires deterministic execution tools combined with bounded iteration budgets [^5]. `pi-coder-tester` implements a sub-agent spawn pattern (`runSubCoder`) where test failures are captured in isolated child sessions or via sandboxed shell execution [^1]:
- When a test suite fails, the raw stderr/stdout and failing test names are parsed into structured diagnostics.
- The harness injects these diagnostics back into the model's active turn context.
- Bounded retry limits (`MAX_CONSECUTIVE_CORRECTIONS = 2` or configurable test iterations) prevent infinite token-burning loops when a bug resists automated patching.

*Credibility: Medium | Relevance: 95/100*

### 4. Trade-offs & Alternatives
**Sub-Question**: What are the architectural trade-offs of building modular extension harnesses versus monolithic agent loops or external orchestration frameworks?

| Approach | Pros | Cons |
|---|---|---|
| **Modular Pi Extensions (`pi-coder`)** | Lightweight, native integration with Pi's TUI, session tree, and caching; fully composable; zero external binary overhead. | Bound to Pi's extension lifecycle and API event semantics. |
| **Monolithic Agent Wrapper** | Complete control over every token and prompt turn from scratch. | Re-inventing the wheel (TUI, multi-provider API, compaction, session history). |
| **External CLI Harness (e.g., Aider, Claude Code)** | Highly polished standalone tools. | Heavy dependencies, hard to customize inner agent loops or integrate custom Pi extensions. |

*Credibility: High | Relevance: 90/100*

---

## References

1. [itayinbarr/little-coder: A coding agent tuned for small local models, built on top of pi](https://github.com/itayinbarr/little-coder), GitHub Repository, accessed July 2026. Credibility: **High**.
2. [Deterministic Guardrails for AI Agents - Agent Patterns](https://agentpatterns.ai/verification/deterministic-guardrails/), Architectural Guide, accessed July 2026. Credibility: **High**.
3. [Pi Coding Agent Documentation & Extension API](https://pi.dev), Official Documentation, accessed July 2026. Credibility: **High**.
4. [Sub-agent Spawning & Isolation Patterns in Pi Extensions](https://github.com/itayinbarr/little-coder/blob/main/.pi/extensions/subagent/spawn.ts), Source Code Reference, accessed July 2026. Credibility: **High**.
5. [How Agents Close the Build-Test-Fix Loop - Augment Code](https://www.augmentcode.com/guides/how-agents-close-build-test-fix-loop), Technical Guide, accessed July 2026. Credibility: **Medium**.

---

## Directions

1. **Scaffold `packages/pi-coder`**: Create a new monorepo package following existing `@victorhg/pi-*` conventions, registering extension entry points for core harness, tester, security, and linter modules.
2. **Port Guard Mechanisms**: Integrate proven guards from *little-coder* (`write-guard`, `read-guard-edit`, `quality-monitor`) into the `pi-coder` package as opt-in or default safety layers.
3. **Implement `pi-coder-tester`**: Build automated test runner integration with structured error parsing and bounded test-fix iteration loops.
4. **Validate via Benchmarks**: Test `pi-coder` against polyglot coding benchmarks to measure pass-rate improvements and token efficiency.

---

## Critic of the Research

While this research provides a solid architectural blueprint by leveraging proven patterns from *little-coder* and Pi's extension ecosystem, several critical risks and blind spots warrant explicit critique:

1. **Model Capacity Dependency**: Harness guards assume models are capable of understanding correction steering messages. Very small models (<10B parameters) often struggle to interpret complex multi-step error correction instructions (e.g., complex diff recipes or `oldText` matching requirements), leading to persistent correction loops despite guard interception.
2. **Over-Intervention & Latency**: Intercepting every `tool_call`, `tool_result`, and `turn_end` event introduces extension overhead and potential latency. Excessive harness interventions ("steering" too aggressively) can disrupt the model's own chain-of-thought and cause cognitive thrashing.
3. **Sandbox Security Boundaries**: Running security scanners (`pi-coder-sec`) and test runners (`pi-coder-tester`) via `bash` tool execution assumes the repository environment is trusted or properly containerized. Without robust OS-level sandboxing (e.g., Docker containers or restricted system permissions), a malicious or hallucinated model command execution could still compromise host environments.
4. **State Synchronization Complexity**: Managing session-scoped state (`readFiles`, `previousToolCalls`, consecutive failure counts) across multiple discrete extensions (`pi-coder`, `pi-coder-tester`, `pi-coder-sec`) can lead to race conditions or stale state if session reset hooks (`session_start`) are not rigorously synchronized.
