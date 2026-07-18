/**
 * @victorhg/pi-obsidian
 *
 * Obsidian vault tools for the Pi coding agent.
 * Registers a single `obsidian` tool that runs any Obsidian CLI command,
 * plus `/obsidian:*` commands for common vault interactions.
 *
 * Requirements:
 *   - Obsidian 1.12+ with CLI enabled (Settings → General → Command line interface)
 *   - The `obsidian` binary registered in PATH
 *   - Obsidian desktop app must be running
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ObsidianSessionState {
  vault: string | null;
  lastCommand: string | null;
  ctx: ExtensionContext | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeCleanSession(): ObsidianSessionState {
  return { vault: null, lastCommand: null, ctx: undefined };
}

/**
 * Parse a `run` string like:
 *   `search query="meeting notes" limit=10`
 * into an argv array:
 *   `["search", "query=meeting notes", "limit=10"]`
 *
 * Handles:
 *   - key="value with spaces"
 *   - key='value with spaces'
 *   - bare flags (no value)
 *   - key=value (no spaces)
 */
export function parseRunString(run: string): string[] {
  const args: string[] = [];
  const RE = /([^\s=]+=[^\s"'][^\s]*)|([^\s=]+="[^"]*")|([^\s=]+='[^']*')|([^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(run)) !== null) {
    let token = m[0];
    // Strip surrounding quotes from value part: key="foo bar" → key=foo bar
    token = token.replace(/^([^\s=]+=)"([^"]*)"$/, "$1$2");
    token = token.replace(/^([^\s=]+=)'([^']*)'$/, "$1$2");
    args.push(token);
  }
  return args;
}

/**
 * Run an Obsidian CLI command.
 * Returns stdout on success, throws with stderr on non-zero exit.
 */
export async function runObsidianCLI(
  args: string[],
  timeoutMs = 15_000
): Promise<string> {
  const { stdout } = await execFileAsync("obsidian", args, {
    timeout: timeoutMs,
    env: { ...process.env },
  });
  return stdout.trim();
}

/**
 * Check whether the `obsidian` binary is available and reachable.
 * Returns null on success, or an error string.
 */
export async function checkObsidianAvailable(): Promise<string | null> {
  try {
    await runObsidianCLI(["version"], 5_000);
    return null;
  } catch (err) {
    return String(err);
  }
}

// ── Session state (module-level, re-hydrated on session_start) ────────────────

let session: ObsidianSessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

const SESSION_STATE_TYPE = "pi-obsidian-state";

function persistState(): void {
  // Only save vault preference (ctx is non-serialisable)
  // appendEntry is called from outside the activate closure via the `pi` reference
}

// ── Prompt injected into the agent system prompt ─────────────────────────────

const OBSIDIAN_GUIDELINES = `
## Obsidian Vault Tool

You have access to the \`obsidian\` tool which runs Obsidian CLI commands against the user's vault.

### Tool Usage
- Use \`obsidian\` with a \`run\` parameter containing the full CLI command string.
- Optionally pass \`vault\` to target a specific vault by name.
- All CLI parameters use \`key=value\` syntax; quote values with spaces: \`content="hello world"\`.

### Common Patterns
- **Read a note:** \`run="read file=<name>"\`
- **Search vault:** \`run="search query=<text> format=json"\`
- **Create a note:** \`run="create path=<folder/name> content=<text>"\`
- **Append to note:** \`run="append file=<name> content=<text>"\`
- **List files:** \`run="files folder=<path>"\`
- **Daily note:** \`run="daily:read"\` or \`run="daily:append content=<text>"\`
- **Set property:** \`run="property:set file=<name> name=<prop> value=<val>"\`
- **List tasks:** \`run="tasks todo"\`
- **Get backlinks:** \`run="backlinks file=<name> format=json"\`

### Guidelines
- Prefer \`format=json\` when you need to process structured output.
- Use \`file=<name>\` for wikilink-style resolution; \`path=<vault/relative/path.md>\` for exact paths.
- When the vault is ambiguous, ask the user which vault to target.
- Never use \`delete permanent\` without explicit user confirmation.
`.trim();

// ── Extension activation ──────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {

  // ── Re-hydrate state on session start ─────────────────────────────────────
  pi.on("session_start", (_event, ctx) => {
    resetSession(ctx);
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === SESSION_STATE_TYPE) {
        const saved = entry.data as { vault?: string | null } | undefined;
        if (saved?.vault != null) session.vault = saved.vault;
      }
    }
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // ── Inject guidelines into system prompt ──────────────────────────────────
  pi.on("before_agent_start", (_event, _ctx) => {
    return {
      systemPrompt: _event.systemPrompt + "\n\n" + OBSIDIAN_GUIDELINES,
    };
  });

  // ── Tool: obsidian ─────────────────────────────────────────────────────────
  pi.registerTool({
    name: "obsidian",
    label: "Obsidian",
    description:
      "Run any Obsidian CLI command against the vault. " +
      "Pass the full command string as `run`, e.g. `read file=MyNote` or `search query=roadmap format=json`. " +
      "Optionally pass `vault` to target a specific vault by name.",
    promptSnippet: "Run Obsidian CLI commands (read, write, search, tasks, properties, daily notes, and more)",
    parameters: Type.Object({
      run: Type.String({
        description:
          'Full Obsidian CLI command string, e.g. "read file=MyNote" or "search query=roadmap limit=10 format=json"',
      }),
      vault: Type.Optional(
        Type.String({
          description: "Target vault name. Defaults to the active vault.",
        })
      ),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      const run = params.run.trim();
      const vault = params.vault ?? session.vault ?? undefined;

      // Build argv
      const cliArgs: string[] = [];
      if (vault) cliArgs.push(`vault=${vault}`);
      cliArgs.push(...parseRunString(run));

      session.lastCommand = cliArgs.join(" ");
      onUpdate?.({ details: {}, content: [{ type: "text", text: `Running: obsidian ${session.lastCommand}` }] });

      let output: string;
      try {
        output = await runObsidianCLI(cliArgs);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Obsidian CLI error:\n${msg}` }],
          details: { command: session.lastCommand, error: msg },
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: output || "(no output)" }],
        details: { command: session.lastCommand, output },
      };
    },
  });

  // ── Command: /obsidian:vault ───────────────────────────────────────────────
  pi.registerCommand("obsidian:vault", {
    description: "Set or show the default Obsidian vault for this session",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        if (session.vault) {
          ctx.ui.notify(`Current vault: "${session.vault}"`, "info");
        } else {
          ctx.ui.notify("No vault set — using Obsidian's active vault.", "info");
        }
        return;
      }
      session.vault = name;
      pi.appendEntry(SESSION_STATE_TYPE, { vault: name });
      ctx.ui.notify(`Vault set to "${name}"`, "info");
    },
  });

  // ── Command: /obsidian:search ──────────────────────────────────────────────
  pi.registerCommand("obsidian:search", {
    description: "Search the vault and show results",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /obsidian:search <query>", "warning");
        return;
      }

      ctx.ui.notify(`Searching vault for "${query}"…`, "info");
      const cliArgs = buildArgs(`search query="${query}" format=json`);
      let output: string;
      try {
        output = await runObsidianCLI(cliArgs);
      } catch (err) {
        ctx.ui.notify(`Search failed: ${err}`, "error");
        return;
      }

      let files: string[];
      try {
        files = JSON.parse(output) as string[];
      } catch {
        // Plain-text fallback
        files = output.split("\n").filter(Boolean);
      }

      if (files.length === 0) {
        ctx.ui.notify(`No results for "${query}"`, "info");
        return;
      }

      const chosen = await ctx.ui.select(
        `Search results for "${query}"`,
        files
      );
      if (chosen) {
        pi.sendUserMessage(`Read the note at path "${chosen}" from the Obsidian vault and summarise it.`);
      }
    },
  });

  // ── Command: /obsidian:daily ───────────────────────────────────────────────
  pi.registerCommand("obsidian:daily", {
    description: "Read today's daily note",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Reading daily note…", "info");
      const cliArgs = buildArgs("daily:read");
      let output: string;
      try {
        output = await runObsidianCLI(cliArgs);
      } catch (err) {
        ctx.ui.notify(`Failed to read daily note: ${err}`, "error");
        return;
      }
      pi.sendUserMessage(
        `Here is today's Obsidian daily note:\n\n${output}\n\nPlease summarise the key points and any open tasks.`
      );
    },
  });

  // ── Command: /obsidian:status ──────────────────────────────────────────────
  pi.registerCommand("obsidian:status", {
    description: "Show vault info and verify the Obsidian CLI is reachable",
    handler: async (_args, ctx) => {
      const err = await checkObsidianAvailable();
      if (err) {
        ctx.ui.notify(
          `⚠️  Obsidian CLI not reachable.\n\nMake sure:\n• Obsidian is running\n• CLI enabled in Settings → General\n• 'obsidian' binary is in PATH\n\nError: ${err}`,
          "error"
        );
        return;
      }

      const cliArgs = buildArgs("vault");
      let vaultInfo = "(unknown)";
      try {
        vaultInfo = await runObsidianCLI(cliArgs);
      } catch { /* non-fatal */ }

      const lines = [
        "✅ Obsidian CLI is reachable",
        "",
        vaultInfo,
        "",
        session.vault
          ? `Session vault: "${session.vault}"`
          : "Session vault: (using active vault)",
        session.lastCommand
          ? `Last command: obsidian ${session.lastCommand}`
          : "Last command: (none)",
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ── Command: /obsidian:note ────────────────────────────────────────────────
  pi.registerCommand("obsidian:note", {
    description: "Read a note by name and load it into context",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /obsidian:note <note name or path>", "warning");
        return;
      }

      ctx.ui.notify(`Reading "${name}"…`, "info");
      // Try file= first (wikilink resolution), fall back to path=
      const cliArgs = buildArgs(`read file="${name}"`);
      let output: string;
      try {
        output = await runObsidianCLI(cliArgs);
      } catch (err) {
        ctx.ui.notify(`Could not read note: ${err}`, "error");
        return;
      }

      pi.sendUserMessage(
        `Here is the content of the Obsidian note "${name}":\n\n${output}`
      );
    },
  });

  // ── Command: /obsidian:tasks ───────────────────────────────────────────────
  pi.registerCommand("obsidian:tasks", {
    description: "List open tasks across the vault (or from today's daily note)",
    handler: async (args, ctx) => {
      const scope = args.trim(); // "" | "daily"
      const cmdStr = scope === "daily" ? "tasks daily todo" : "tasks todo";
      const label = scope === "daily" ? "today's daily note" : "the vault";

      ctx.ui.notify(`Fetching open tasks from ${label}…`, "info");
      const cliArgs = buildArgs(cmdStr);
      let output: string;
      try {
        output = await runObsidianCLI(cliArgs);
      } catch (err) {
        ctx.ui.notify(`Failed to fetch tasks: ${err}`, "error");
        return;
      }

      if (!output) {
        ctx.ui.notify(`No open tasks found in ${label}.`, "info");
        return;
      }

      pi.sendUserMessage(
        `Open tasks from ${label}:\n\n${output}\n\nGroup them by topic and suggest which to prioritise today.`
      );
    },
  });

  // ── Helpers (closure) ─────────────────────────────────────────────────────

  function buildArgs(run: string): string[] {
    const args: string[] = [];
    if (session.vault) args.push(`vault=${session.vault}`);
    args.push(...parseRunString(run));
    return args;
  }
}
