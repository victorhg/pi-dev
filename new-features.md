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

## Recommended Build Order

1. **`pi-cost-guard`** — straightforward event listener + commands, low API risk
2. **`pi-tool-logger`** — uses untapped tool-call events, moderate complexity
3. **`pi-auto-compact`** — requires `ctx.compact()` exploration, highest complexity

---

## Smaller Improvements

- `token-saver:reset` command to clear session savings and start fresh (useful for long sessions)
- Configurable line limits per-command in `pi-token-saver` via `pi-config.json`
- `pi-footer` config option to toggle the `💰` savings metric independently of other stats sections
