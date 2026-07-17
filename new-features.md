# New Features & Ideas

A repository of planned extensions and improvements for the pi-dev project.

---

## Planned Extensions

### `pi-cost-guard` — Session budget enforcement

Track running cost from session entries and warn or pause when a configurable threshold is hit.

**Motivation:** The `pi-footer` shows the `$` total, but there is no active gate. Long agentic runs can silently overspend.

**API hooks:**
- `session_start` — begin monitoring
- `tool_result` — re-evaluate cost after each assistant message
- `footerRegistry` — show `⚠️ $x/$y` when over 80% of budget

**Commands:**
- `cost-guard:status` — show current spend vs. budget
- `cost-guard:set-budget` — configure the session cap

---

### `pi-tool-logger` — Audit log of agent actions

Intercept `BashToolCallEvent`, `EditToolCallEvent`, and `ReadToolCallEvent` to build a structured log of every file touched and every command run during a session.

**Motivation:** After a complex session, audit exactly what the agent did without scrolling through the full transcript.

**API hooks:**
- `pi.on('tool_call', ...)` — pre-execution interception (currently unused in this repo)
- `pi.on('tool_result', ...)` — post-execution recording

**Commands:**
- `tool-logger:summary` — grouped count of reads, writes, and bash calls
- `tool-logger:log` — full chronological action list

---

### `pi-auto-compact` — Context window manager

Watch `ctx.getContextUsage()` after each tool result and fire a warning at a configurable threshold (e.g. 75%) and/or auto-trigger compaction at a hard limit (e.g. 90%).

**Motivation:** `pi-footer` shows context %, but nothing acts on it. Prevents silent context overflow that degrades model quality.

**API hooks:**
- `session_start` — capture `ctx` for ongoing checks
- `tool_result` — trigger re-evaluation of context usage
- `ctx.compact()` / `ctx.newSession()` — perform compaction
- `footerRegistry` — show `📦 auto` when compaction has fired this session

**Commands:**
- `auto-compact:status` — show current thresholds and usage
- `auto-compact:set-threshold` — configure warn and compact levels

---

### `pi-no-bash` — Capability reduction

The best bash tool is no bash at all. A more secure way to run agents in production is to reduce the capabilities of code being run without consent.

**Motivation:** Prevent arbitrary command execution in sensitive production environments by creating a restricted execution model.

**API hooks:**
- `tool_middleware` — intercept or disable `bash` tool calls based on context or user settings

**Commands:**
- `no-bash:toggle` — enable/disable bash capabilities for the current session

---

### `pi-black-white-list` — Execution policy enforcement

Create a list of permitted and prohibited commands that the pi instance can execute. This is a way to reduce the freedom and risk of pi in production.

**Motivation:** Provide granular control over which shell commands are acceptable for the agent to use, mitigating the risk of unauthorized system operations.

**API hooks:**
- `tool_middleware` — validate `bash` command arguments against the allow-list/deny-list

**Commands:**
- `policy:allow <command>` — add command to permitted list
- `policy:deny <command>` — add command to prohibited list
- `policy:status` — view current security policy configuration

---

### `pi-plan-mode` — Implementation plan review and management

Flip the agent into a read-only planning phase: it explores the codebase, drafts a numbered step-by-step execution plan, and waits for explicit approval before writing any file. Inspired by Claude Code's Plan Mode and GitHub Copilot's Plan Agent.

**Motivation:** Prevents the agent from confidently executing the wrong solution. Forces a deliberate Explore → Plan → Review → Execute loop, making large refactors auditable before a single file is touched.

**Flow:**
1. User issues a task prefixed with `/plan` or activates plan mode via command.
2. Agent enters **read-only** state — only `read`, `bash` (non-mutating), and `web_search` are permitted.
3. Agent produces a Markdown plan: numbered steps, affected files, and open questions.
4. User reviews inline, edits individual steps, then approves or rejects.
5. On approval the agent re-enters normal mode and executes step-by-step, checking off each item.

**API hooks:**
- `tool_middleware` — block mutating tools (`edit`, `write`, destructive `bash`) while in plan state
- `session_start` / `tool_result` — track plan state across turns
- `footerRegistry` — show `📋 PLAN` badge when plan mode is active

**Commands:**
- `plan:start` — enter plan mode for the current task
- `plan:show` — display the active plan
- `plan:edit <step>` — replace or annotate a specific numbered step
- `plan:approve` — exit read-only state and begin execution
- `plan:abort` — discard plan and reset to normal mode

---

### `pi-research` — Subject research and reference document generator

Given a topic or question, the agent runs a structured research loop — searching the web, reading sources, extracting citations — and produces a self-contained Markdown document with an overview, key findings, references, and recommended next directions. Inspired by multi-agent research systems like CogGen (Planner / Writer / Reviewer) and ARIA.

**Motivation:** Long questions about libraries, architectures, or unfamiliar domains require many manual search rounds. `pi-research` automates that into a single command with a citable, shareable output artifact.

**Flow:**
1. User runs `research:start <topic>`.
2. Agent (Planner phase) decomposes the topic into 3–5 focused sub-questions.
3. Agent (Researcher phase) runs `web_search` + `fetch_content` per sub-question, scoring source credibility.
4. Agent (Writer phase) synthesises findings into a structured document:
   - **Overview** — concise description of the subject
   - **Key Concepts** — definitions and relationships
   - **Findings** — answers to each sub-question with inline citations
   - **References** — numbered list with URL, title, and access date
   - **Directions** — open questions and recommended next steps
5. Document is saved to `research/<slug>.md` and surfaced in the TUI.

**API hooks:**
- `web_search` / `fetch_content` — primary data-gathering tools
- `write` — persist the final document
- `footerRegistry` — show `🔬 researching…` progress badge during the loop

**Commands:**
- `research:start <topic>` — kick off a new research run
- `research:status` — show current phase and sources collected so far
- `research:open` — display the latest research document in the TUI
- `research:list` — list all saved research documents

---

## Recommended Build Order


1. **`pi-cost-guard`** — straightforward event listener + commands, low API risk
2. **`pi-tool-logger`** — uses untapped tool-call events, moderate complexity
3. **`pi-auto-compact`** — requires `ctx.compact()` exploration, highest complexity

---

## Smaller Improvements

- `token-saver:reset` command to clear session savings and start fresh (useful for long sessions)
- Configurable line limits per-command in `pi-token-saver` via `pi-config.json`
- `pi-footer` config option to toggle the `💰` savings metric independently of other stats sections
