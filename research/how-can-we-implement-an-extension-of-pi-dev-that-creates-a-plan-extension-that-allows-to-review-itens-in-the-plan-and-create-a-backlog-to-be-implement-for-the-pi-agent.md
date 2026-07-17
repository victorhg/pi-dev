# Pi Plan Extension — Research & Implementation Guide

> **Generated:** 2025-07-10T00:00:00.000Z
> **Phase:** complete

---

## Overview

A **Plan Extension** for pi-dev is a TypeScript extension that flips the pi agent
into a structured _Explore → Plan → Review → Backlog → Execute_ loop. Instead of
letting the agent write files immediately after receiving a task, the extension
forces a deliberate planning phase: the agent reads the codebase, drafts a
numbered step-by-step plan, waits for the user to review and edit it inline, then
saves approved steps as an actionable backlog that pi can later execute
sequentially.

This pattern is inspired by **Claude Code Plan Mode** (read-only preflight + explicit
approval), **GitHub Copilot Plan Agent** (spec-driven plan with todo tracking), and
backlog-management tools like **Backlog.md** and **Taskplane** that treat every task
as a first-class Markdown artefact. Within the pi-dev monorepo it sits alongside
`@victorhg/pi-research` as a `packages/pi-plan` workspace package, and it reuses
the same `@victorhg/pi-footer` status-bar integration pattern.

---

## Key Concepts

| Term | Definition |
|---|---|
| **Plan Mode** | Read-only phase in which mutating tools (`write`, `edit`, destructive `bash`) are blocked; agent may only `read`, `bash` (non-mutating), and `web_search`. |
| **Plan Artefact** | A Markdown file (`plans/<slug>.md`) containing numbered steps, affected files, open questions, and a status table. |
| **Backlog Item** | A single plan step extracted to `backlog/<id>-<slug>.md` with YAML frontmatter (`id`, `title`, `status`, `priority`, `effort`, `depends_on`). |
| **Approval Gate** | A `ctx.ui.confirm()` or custom TUI review dialog that blocks execution until the user approves the full plan or individual steps. |
| **Execute Mode** | Normal mode re-entered after approval; the agent ticks off backlog items sequentially, committing after each step. |
| **Session State** | Module-level + `pi.appendEntry()` persistence so plan/backlog state survives restarts and `/reload`. |
| **Tool Allowlist** | A set of permitted tool names enforced via the `tool_call` event hook; unlisted tools return `{ block: true }`. |

---

## Findings

### 1. What is Plan Mode and how do mature AI coding agents implement it?

Claude Code Plan Mode is the canonical reference [^1][^2]. Its key mechanics are:

- **Entry**: `/plan` prefix, `Shift+Tab` cycling, or `--permission-mode plan` flag.
- **Enforcement**: the agent is hard-blocked from any file-write or mutating shell
  command while in plan state.
- **Output**: a free-form Markdown document listing steps, open questions, and
  affected files — rendered inline in the terminal.
- **Exit**: `Ctrl+G` / explicit approval transitions back to normal execution mode.

GitHub Copilot's Plan Agent [^3][^4] adds two refinements: it builds a **todo list**
alongside the plan (tracking which items are pending/done), and on approval it
**hands off** the plan to Agent mode without requiring the user to copy-paste.

Both tools validate the pattern: separating _Explore_ from _Execute_ reduces
costly mis-executions on large refactors, because the agent surfaces assumptions
and risks before touching any code.

**Implication for pi:** The pi extension API already has the exact hook needed —
`tool_call` can return `{ block: true, reason }` — making a read-only plan phase
straightforward to implement without patching pi itself.

---

### 2. How should the backlog be structured and persisted?

The open-source **backlogmd** project [^5] and **taskmd specification** [^6] converge
on the same pattern:

- One Markdown file per backlog item inside a versioned directory (`.backlogmd/` or
  `backlog/`).
- Each file has **YAML frontmatter** with machine-readable fields (`id`, `title`,
  `status`, `priority`, `effort`, `depends_on`).
- A root `backlog.md` (or `plans/<slug>.md`) acts as the _index_ — a human-readable
  kanban view of all items.

```
backlog/
├── backlog.md          ← root plan index (auto-generated)
├── 001-add-auth.md
├── 002-migrate-db.md
└── 003-update-docs.md
```

Example item frontmatter (from taskmd spec):

```yaml
---
id: "001"
title: "Add JWT authentication"
status: pending          # pending | in-progress | complete | blocked | cancelled
priority: high           # low | medium | high | critical
effort: large            # small | medium | large
depends_on: []
plan_step: 2             # cross-reference to parent plan step number
---
```

**Implication for pi:** The extension writes `.md` files via the `write` tool (or
`node:fs`) during the planning phase. The agent later reads each item via `read`
during execute mode, marks it `in-progress`, executes, then marks it `complete`.
This gives a persistent, human-readable audit trail even after context resets.

---

### 3. How does the pi extension API support plan/backlog state across sessions?

Pi provides two complementary persistence primitives [^7]:

| Primitive | Purpose | LLM visible? |
|---|---|---|
| `pi.appendEntry(customType, data)` | Store structured JSON; survives restart | ✗ |
| `pi.sendMessage({ customType, … })` | Inject message into session transcript | ✓ |

The `pi-review` extension [^8] demonstrates the canonical pattern for stateful
extensions:

1. **Module-level state** (e.g., `let planState`) holds live runtime values.
2. `session_start` re-hydrates state from `ctx.sessionManager.getBranch()` by
   scanning entries with the extension's `customType`.
3. `session_shutdown` tears down timers/watchers but state is already persisted via
   `appendEntry`.
4. `session_tree` re-applies state when the user navigates the session tree.

For plan mode, the state envelope would be:

```typescript
type PlanSessionState = {
  active: boolean;
  planFile: string | undefined;
  currentStep: number;
  approvedAt: string | undefined;
};
```

---

### 4. How do we implement the interactive plan review TUI?

The `pi-review` extension [^8] and the pi TUI documentation [^9] both demonstrate
multi-modal review interfaces built from `@earendil-works/pi-tui` primitives:

**Simple approach (< 100 lines):** Use `ctx.ui.select()` and `ctx.ui.confirm()` for
step-by-step review — no custom TUI component required:

```typescript
const approved = await ctx.ui.confirm(
  "Approve plan?",
  `${stepCount} steps, ${affectedFiles.length} files affected.\nProceed to execution?`
);
```

**Advanced approach:** Use `ctx.ui.custom()` with `SelectList`, `Input`, and
`Container` from `@earendil-works/pi-tui` to build an interactive step editor where
the user can:
- Scroll through steps
- Edit individual steps inline (`ctx.ui.editor()`)
- Re-order or delete steps before approval

The `pi-review` `showReviewSelector()` function (530+ lines) serves as the full
reference implementation for this pattern [^8].

**Widget integration:** `ctx.ui.setWidget("pi-plan", ...)` renders a persistent
status bar above the editor:

```
📋 PLAN MODE — 7 steps drafted · awaiting approval
```

---

### 5. What commands and tool-call hooks are required?

**Commands** follow the `pi-research` naming convention:

| Command | Description |
|---|---|
| `/plan` | Open editor dialog → agent explores codebase → drafts plan |
| `/plan:show` | Display current plan file in the TUI |
| `/plan:edit <step>` | Open editor for a specific numbered step |
| `/plan:approve` | Exit read-only mode, begin sequential execution |
| `/plan:abort` | Discard plan, reset to normal mode |
| `/plan:status` | Show current mode, step progress, backlog item counts |
| `/plan:backlog` | List all backlog items with status |
| `/plan:backlog:add <text>` | Add a free-form item to the backlog outside a plan |
| `/plan:next` | Execute the next pending backlog item |

**Tool-call hook** to enforce read-only plan mode:

```typescript
const READ_ONLY_TOOLS = new Set(["read", "web_search", "fetch_content"]);
// bash is allowed but only for non-mutating commands (grep, ls, find, cat, git status)
const BASH_READONLY_PATTERN = /^(ls|find|grep|cat|git (status|log|diff|show|branch)|echo|pwd)/;

pi.on("tool_call", async (event, _ctx) => {
  if (!planState.active) return; // not in plan mode, allow everything

  const { toolName, input } = event;

  if (toolName === "bash") {
    const cmd = (input as { command: string }).command?.trim() ?? "";
    if (!BASH_READONLY_PATTERN.test(cmd)) {
      return { block: true, reason: "🛑 Plan Mode: mutating bash commands are blocked. Approve the plan first." };
    }
    return; // allow read-only bash
  }

  if (!READ_ONLY_TOOLS.has(toolName)) {
    return { block: true, reason: `🛑 Plan Mode: '${toolName}' is blocked. Approve the plan first with /plan:approve.` };
  }
});
```

---

### 6. What is the recommended package structure and wiring?

Following the `pi-extension-development` skill checklist [^10] and the `pi-research`
package as reference:

```
packages/pi-plan/
├── package.json              # @victorhg/pi-plan, type: module
├── src/
│   ├── index.ts              # default export activate(pi: ExtensionAPI)
│   ├── state.ts              # PlanState, BacklogItem types + serialisation
│   ├── prompts.ts            # buildPlanPrompt(), buildExecutePrompt()
│   ├── backlog.ts            # read/write backlog/*.md helpers
│   └── index.test.ts         # unit tests for slugify, state helpers
├── README.md
└── CHANGELOG.md
```

Root wiring in `package.json`:
```json
{
  "optionalDependencies": {
    "@victorhg/pi-plan": "workspace:*"
  }
}
```

`src/extensions/builtin-registry.ts` entry:
```typescript
{
  key: "pi-plan",
  optionName: "plan",
  flag: "--plan",
  description: "Plan mode: Explore → Plan → Review → Backlog → Execute loop",
  load: () => import("@victorhg/pi-plan"),
}
```

---

## Architecture Diagram

```
User types /plan  ──────────────────────────────────────────────┐
                                                                 │
  ┌─ Extension Handler ─────────────────────────────────────────┐│
  │  1. Open ctx.ui.editor() → get task description             ││
  │  2. Set planState.active = true (read-only mode ON)         ││
  │  3. ctx.ui.setWidget("pi-plan", "📋 PLAN MODE — exploring") ││
  │  4. pi.sendUserMessage(buildPlanPrompt(task, planFile))      ││
  └─────────────────────────────────────────────────────────────┘│
                                                                 │
  ┌─ Agent Loop (Read-Only) ────────────────────────────────────┐│
  │  tool_call hook blocks: write, edit, bash (mutating)        ││
  │  Agent reads codebase, drafts plans/<slug>.md               ││
  └─────────────────────────────────────────────────────────────┘│
                                                                 │
User runs /plan:show  ──── ctx.ui.custom() TUI review ──────────┘
          │                  SelectList of steps
          │                  ctx.ui.editor() for edits
          ▼
User runs /plan:approve
  ┌─ Extension Handler ─────────────────────────────────────────┐
  │  1. planState.active = false (read-only mode OFF)           │
  │  2. Parse plans/<slug>.md → emit backlog/*.md items         │
  │  3. pi.appendEntry("pi-plan-state", planState)              │
  │  4. ctx.ui.setWidget("pi-plan", "▶ EXECUTING step 1/7")    │
  │  5. pi.sendUserMessage(buildExecutePrompt(nextStep))        │
  └─────────────────────────────────────────────────────────────┘
                                                                 │
  ┌─ Agent Loop (Normal) ───────────────────────────────────────┐│
  │  Executes step, commits, marks backlog item complete        ││
  │  tool_result hook: advance planState.currentStep            ││
  │  Repeat until all items done                                ││
  └─────────────────────────────────────────────────────────────┘│
```

---

## References

[^1]: **Claude Code Plan Mode: Complete Guide 2026** — https://explainx.ai/blog/claude-code-plan-mode-complete-guide-2026
  (credibility: high, relevance: 92)
  *Comprehensive guide to Claude Code's plan mode — entry mechanisms, enforcement, approval flow.*

[^2]: **Claude Code Plan Mode: Design Review-First Refactoring** — https://www.datacamp.com/tutorial/claude-code-plan-mode
  (credibility: high, relevance: 88)
  *DataCamp tutorial explaining Explore → Plan → Approve → Execute with concrete examples.*

[^3]: **Planning with agents in VS Code** — https://code.visualstudio.com/docs/agents/planning
  (credibility: high, relevance: 85)
  *Official VS Code docs on GitHub Copilot Plan Agent: read-only exploration, todo list integration, agent-mode handoff.*

[^4]: **GitHub Copilot Plan-Then-Execute with Git Worktrees** — https://www.codewrecks.com/post/ai/agent-plan-then-execute/
  (credibility: medium, relevance: 78)
  *Blog post on background agent execution after planning phase; worktree isolation.*

[^5]: **Backlog.md — self-contained project board** — https://github.com/MrLesk/Backlog.md
  (credibility: medium, relevance: 82)
  *Markdown-native task board; spec-driven AI development pattern; one `.md` per task.*

[^6]: **taskmd specification** — https://github.com/driangle/taskmd/blob/main/docs/taskmd_specification.md
  (credibility: medium, relevance: 80)
  *Formal specification for YAML-frontmatter Markdown task files; `id`, `status`, `priority`, `effort`, `depends_on` fields.*

[^7]: **Pi Extensions Documentation** — https://pi.dev/docs/latest/extensions
  (credibility: high, relevance: 100)
  *Official pi extension API: `appendEntry`, `sendMessage`, `tool_call` event, `ctx.ui.*` methods.*

[^8]: **pi-review extension** — https://github.com/earendil-works/pi-review/blob/main/review.ts
  (credibility: high, relevance: 95)
  *Full reference implementation of a stateful pi extension with TUI review selector, session state, and tool-gating patterns.*

[^9]: **Pi TUI Components Documentation** — https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/tui.md
  (credibility: high, relevance: 90)
  *`SelectList`, `Input`, `Container`, `ctx.ui.custom()` API details.*

[^10]: **pi-extension-development SKILL.md** — `/Users/victorhugogermano/Development/pi-dev/.agents/pi-extension-development/SKILL.md`
  (credibility: high, relevance: 100)
  *Monorepo-specific checklist for new `packages/pi-*` packages; wiring, validation, and convention rules.*

[^11]: **Taskplane — Multi-agent orchestration for pi** — https://github.com/HenryLach/taskplane/
  (credibility: high, relevance: 75)
  *Advanced reference: Planner → Worker → Reviewer pipeline, task artefacts (PROMPT.md + STATUS.md), tool allowlist constants.*

[^12]: **SoureCode/AgentBacklog** — https://github.com/SoureCode/AgentBacklog
  (credibility: medium, relevance: 70)
  *MCP plugin for Claude Code/Copilot CLI; backlog CRUD, kanban UI, git-root auto-detection.*

---

## Directions

### Open Questions

1. **Step granularity** — Should each plan step map 1:1 to a backlog item, or should
   multi-step tasks be collapsed? Taskplane uses PROMPT.md + STATUS.md per task for
   context isolation; a simpler initial approach is one `.md` per step.

2. **Bash allowlist vs blocklist** — A regex allow-only approach (`^(ls|find|grep…)`)
   is safer but brittle (agents construct complex pipelines). A blocklist approach
   (`rm`, `mv`, `git commit`, `git push`) is more permissive but easier to maintain.
   Claude Code blocks at the file-system call level; pi must do it at the bash string
   level.

3. **Backlog persistence location** — `backlog/` at project root (visible to git,
   shareable) vs `.pi/backlog/` (hidden, tool-scoped). For collaborative workflows
   the root is better; for solo use `.pi/` keeps the repo cleaner.

4. **Footer integration** — Should `pi-plan` require `@victorhg/pi-footer` as a hard
   peer dependency or use the same optional `try { footerRegistry… } catch {}` pattern
   from `pi-research`?

5. **Backlog → issue sync** — Future: export approved backlog items as GitHub issues
   or Linear tickets via `gh issue create`, making the backlog the single source of
   truth for project management.

### Recommended Next Steps

1. **Read the `pi-extension-development` skill** (`.agents/pi-extension-development/SKILL.md`)
   and the **checklist** (`references/checklist.md`) before writing a single line of code.

2. **Scaffold the package:**
   ```bash
   mkdir -p packages/pi-plan/src
   # Create package.json, src/index.ts, src/index.test.ts, README.md, CHANGELOG.md
   ```

3. **Implement Phase 1 (read-only mode + plan draft):**
   - `/plan` command → `ctx.ui.editor()` → `pi.sendUserMessage(buildPlanPrompt(…))`
   - `tool_call` hook with bash regex guard
   - `ctx.ui.setWidget()` badge

4. **Implement Phase 2 (review TUI):**
   - `/plan:show` using `ctx.ui.select()` over parsed steps (simple first iteration)
   - `/plan:edit <step>` using `ctx.ui.editor()`
   - `/plan:approve` to flip mode and emit backlog items

5. **Implement Phase 3 (backlog management):**
   - Write `backlog/<id>-<slug>.md` on approval
   - `/plan:status`, `/plan:backlog`, `/plan:next` commands
   - `pi.appendEntry()` for session persistence; hydrate on `session_start`

6. **Wire into monorepo:**
   - Root `package.json` optional dependency
   - `builtin-registry.ts` entry
   - `pnpm install` to update lockfile

7. **Validate:**
   ```bash
   pnpm --filter @victorhg/pi-plan run check:self
   pnpm --filter @victorhg/pi-plan run test:self
   pnpm run check:skills
   ```

8. **Update `new-features.md`** to mark `pi-plan-mode` as in-progress, then
   **update root `README.md`** once the package ships.
