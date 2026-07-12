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

## Recommended Build Order


1. **`pi-cost-guard`** — straightforward event listener + commands, low API risk
2. **`pi-tool-logger`** — uses untapped tool-call events, moderate complexity
3. **`pi-auto-compact`** — requires `ctx.compact()` exploration, highest complexity

---

## Smaller Improvements

- `token-saver:reset` command to clear session savings and start fresh (useful for long sessions)
- Configurable line limits per-command in `pi-token-saver` via `pi-config.json`
- `pi-footer` config option to toggle the `💰` savings metric independently of other stats sections
