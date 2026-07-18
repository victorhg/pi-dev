/**
 * @victorhg/pi-obsidian
 *
 * Obsidian vault tools for the Pi coding agent.
 * Designed to run inside an Obsidian vault directory — the CLI auto-detects
 * the vault from cwd, so no vault targeting is required.
 *
 * Requirements:
 *   - Obsidian 1.12+ with CLI enabled (Settings → General → Command line interface)
 *   - The `obsidian` binary registered in PATH
 *   - Obsidian desktop app must be running
 *   - pi must be launched from inside the vault directory
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ObsidianSessionState {
  lastCommand: string | null;
  ctx: ExtensionContext | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeCleanSession(): ObsidianSessionState {
  return { lastCommand: null, ctx: undefined };
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
 * Run an Obsidian CLI command from the current working directory.
 * The CLI resolves the vault from cwd automatically.
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
 * Returns null on success, or an error message string.
 */
export async function checkObsidianAvailable(): Promise<string | null> {
  try {
    await runObsidianCLI(["version"], 5_000);
    return null;
  } catch (err) {
    return String(err);
  }
}

// ── Session state ─────────────────────────────────────────────────────────────

let session: ObsidianSessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

// ── System prompt guidelines ──────────────────────────────────────────────────

const OBSIDIAN_GUIDELINES = `
## Obsidian Vault Tool

You have access to the \`obsidian\` tool which runs Obsidian CLI commands against the vault in the current directory.

### Tool Usage
Use \`obsidian\` with a \`run\` parameter containing the full CLI command string.
All parameters use \`key=value\` syntax; quote values with spaces: \`content="hello world"\`.

### Common Commands
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
- Use \`file=<name>\` for wikilink-style resolution; \`path=<relative/path.md>\` for exact paths.
- Never use \`delete permanent\` without explicit user confirmation.
`.trim();

// ── Extension activation ──────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {

  pi.on("session_start", (_event, ctx) => {
    resetSession(ctx);
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // ── Inject guidelines into system prompt ──────────────────────────────────
  pi.on("before_agent_start", (event, _ctx) => {
    return { systemPrompt: event.systemPrompt + "\n\n" + OBSIDIAN_GUIDELINES };
  });

  // ── Tool: obsidian ─────────────────────────────────────────────────────────
  pi.registerTool({
    name: "obsidian",
    label: "Obsidian",
    description:
      "Run any Obsidian CLI command against the vault in the current directory. " +
      "Pass the full command string as `run`, e.g. `read file=MyNote` or `search query=roadmap format=json`.",
    promptSnippet: "Run Obsidian CLI commands (read, write, search, tasks, properties, daily notes, and more)",
    parameters: Type.Object({
      run: Type.String({
        description:
          'Full Obsidian CLI command string, e.g. "read file=MyNote" or "search query=roadmap limit=10 format=json"',
      }),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      const cliArgs = parseRunString(params.run.trim());
      session.lastCommand = cliArgs.join(" ");

      onUpdate?.({
        details: {},
        content: [{ type: "text", text: `Running: obsidian ${session.lastCommand}` }],
      });

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

  // ── Command: /obsidian:status ──────────────────────────────────────────────
  pi.registerCommand("obsidian:status", {
    description: "Verify the Obsidian CLI is reachable and show current vault info",
    handler: async (_args, ctx) => {
      const err = await checkObsidianAvailable();
      if (err) {
        ctx.ui.notify(
          `⚠️  Obsidian CLI not reachable.\n\nMake sure:\n• Obsidian is running\n• CLI enabled in Settings → General\n• 'obsidian' binary is in PATH\n\nError: ${err}`,
          "error"
        );
        return;
      }

      let vaultInfo = "(unknown)";
      try {
        vaultInfo = await runObsidianCLI(["vault"]);
      } catch { /* non-fatal */ }

      ctx.ui.notify(
        [
          "✅ Obsidian CLI is reachable",
          "",
          vaultInfo,
          session.lastCommand ? `Last command: obsidian ${session.lastCommand}` : "",
        ].filter(Boolean).join("\n"),
        "info"
      );
    },
  });

  // ── Command: /obsidian:note ────────────────────────────────────────────────
  pi.registerCommand("obsidian:note", {
    description: "Read a note by name and load it into context",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /obsidian:note <note name>", "warning");
        return;
      }

      ctx.ui.notify(`Reading "${name}"…`, "info");
      let output: string;
      try {
        output = await runObsidianCLI(parseRunString(`read file="${name}"`));
      } catch (err) {
        ctx.ui.notify(`Could not read note: ${err}`, "error");
        return;
      }

      pi.sendUserMessage(`Here is the content of the Obsidian note "${name}":\n\n${output}`);
    },
  });

  // ── Command: /obsidian:search ──────────────────────────────────────────────
  pi.registerCommand("obsidian:search", {
    description: "Search the vault — pick a result to load it into context",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /obsidian:search <query>", "warning");
        return;
      }

      ctx.ui.notify(`Searching for "${query}"…`, "info");
      let output: string;
      try {
        output = await runObsidianCLI(parseRunString(`search query="${query}" format=json`));
      } catch (err) {
        ctx.ui.notify(`Search failed: ${err}`, "error");
        return;
      }

      let files: string[];
      try {
        files = JSON.parse(output) as string[];
      } catch {
        files = output.split("\n").filter(Boolean);
      }

      if (files.length === 0) {
        ctx.ui.notify(`No results for "${query}"`, "info");
        return;
      }

      const chosen = await ctx.ui.select(`Results for "${query}"`, files);
      if (chosen) {
        pi.sendUserMessage(`Read the Obsidian note at path "${chosen}" and summarise it.`);
      }
    },
  });

  // ── Command: /obsidian:daily ───────────────────────────────────────────────
  pi.registerCommand("obsidian:daily", {
    description: "Read today's daily note and summarise it",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Reading daily note…", "info");
      let output: string;
      try {
        output = await runObsidianCLI(["daily:read"]);
      } catch (err) {
        ctx.ui.notify(`Failed to read daily note: ${err}`, "error");
        return;
      }
      pi.sendUserMessage(
        `Here is today's Obsidian daily note:\n\n${output}\n\nSummarise the key points and highlight any open tasks.`
      );
    },
  });

  // ── Command: /obsidian:tasks ───────────────────────────────────────────────
  pi.registerCommand("obsidian:tasks", {
    description: "List open tasks from the vault. Pass `daily` to scope to today's note",
    handler: async (args, _ctx) => {
      const daily = args.trim() === "daily";
      const cmdStr = daily ? "tasks daily todo" : "tasks todo";
      const label = daily ? "today's daily note" : "the vault";

      let output: string;
      try {
        output = await runObsidianCLI(parseRunString(cmdStr));
      } catch (err) {
        session.ctx?.ui.notify(`Failed to fetch tasks: ${err}`, "error");
        return;
      }

      if (!output) {
        session.ctx?.ui.notify(`No open tasks found in ${label}.`, "info");
        return;
      }

      pi.sendUserMessage(
        `Open tasks from ${label}:\n\n${output}\n\nGroup them by topic and suggest which to prioritise today.`
      );
    },
  });
}
