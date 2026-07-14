import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ExtensionAPI, ToolCallEvent, ToolResultEvent, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { FilterEngine } from './filter-engine';
import { SavingsTracker } from './savings-tracker';

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data?: string };
type ContentItem = TextContent | ImageContent;

// ── Safety Guard Helpers ──────────────────────────────────────────
function shouldFilter(command: string): boolean {
  // Ignore pipeline, redirects, or chained commands
  const shellOperators = ['|', '&&', '||', ';', '>', '<', '`', '$('];
  return !shellOperators.some(op => command.includes(op));
}

function isBinary(text: string): boolean {
  // Heuristic check for binary content (null bytes or high frequency of control codes)
  return /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 1000));
}

// ── Tee Recovery System ───────────────────────────────────────────
function saveTee(command: string, rawText: string): string {
  const homeDir = os.homedir();
  const teeDir = path.join(homeDir, '.pi', 'agent', 'token-saver', 'tee');
  
  if (!fs.existsSync(teeDir)) {
    fs.mkdirSync(teeDir, { recursive: true });
  }

  // File rotation (keep max 50 files)
  try {
    const files = fs.readdirSync(teeDir)
      .filter(f => f.endsWith('.txt'))
      .map(f => ({ name: f, path: path.join(teeDir, f), stat: fs.statSync(path.join(teeDir, f)) }))
      .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

    while (files.length >= 50) {
      const oldest = files.shift();
      if (oldest) fs.unlinkSync(oldest.path);
    }
  } catch (err) {
    // Non-fatal
  }

  const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
  const slug = command.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 30).toLowerCase();
  const filename = `${dateStr}_${slug}.txt`;
  const filePath = path.join(teeDir, filename);

  fs.writeFileSync(filePath, rawText, 'utf-8');
  return filePath;
}

export default async function activate(pi: ExtensionAPI) {
  const engine = new FilterEngine();
  const tracker = new SavingsTracker();
  let passthroughEnabled = false;

  // Map for tracking pending command texts via toolCallId
  const pendingBashCommands = new Map<string, string>();

  // Setup live status footer integration
  const updateStatusFooter = (ctx?: any) => {
    const totalBytes = tracker.getSessionSavings();
    const savingsKB = (totalBytes / 1024).toFixed(1);
    const label = `💰${savingsKB}KB`;

    // Try setting status in the pi status bar
    if (ctx && typeof ctx.ui?.setStatus === 'function') {
      ctx.ui.setStatus('token-saver', label);
    }
  };

  // Optionally register with @victorhg/pi-footer registry
  try {
    const { footerRegistry } = await import('@victorhg/pi-footer/registry');
    footerRegistry.register('token-saver', () => {
      const savingsKB = (tracker.getSessionSavings() / 1024).toFixed(1);
      return `💰${savingsKB}KB`;
    });
  } catch (err) {
    // Silently ignore if @victorhg/pi-footer is not installed
  }

  // ── Commands ────────────────────────────────────────────────────
  pi.registerCommand('token-saver:savings', {
    description: 'Show total tokens saved this session',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const totalBytes = tracker.getSessionSavings();
      const totalKB = (totalBytes / 1024).toFixed(2);
      const commandCount = tracker.getHistory().length;
      const message = commandCount === 0
        ? '💰 No matched commands recorded yet. Run commands like git status, git diff, ls, npm install to save tokens!'
        : `💰 Token Saver Analytics:\n  - Persistent savings: ${totalKB} KB (${totalBytes.toLocaleString()} bytes)\n  - Filtered runs: ${commandCount} command${commandCount === 1 ? '' : 's'}`;
      
      if (ctx.hasUI) ctx.ui.notify(message, 'info');
      else console.log(message);
    }
  });

  pi.registerCommand('token-saver:history', {
    description: 'Show per-command token savings breakdown',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const history = tracker.getHistory();
      if (history.length === 0) {
        const msg = 'No matched commands recorded yet.';
        if (ctx.hasUI) ctx.ui.notify(msg, 'info');
        else console.log(msg);
        return;
      }
      const lines: string[] = ['Token Savings Breakdown:'];
      for (const record of history.slice(-30)) { // show last 30 runs
        const kb = (record.bytesSaved / 1024).toFixed(2);
        const time = new Date(record.timestamp).toLocaleTimeString();
        const outcome = record.bytesSaved > 0 ? `saved ${kb} KB` : 'matched (no reduction)';
        lines.push(`  [${time}] ${record.command} — ${outcome}`);
      }
      const totalKB = (tracker.getSessionSavings() / 1024).toFixed(2);
      lines.push(`Total Savings: ${totalKB} KB`);
      const msg = lines.join('\n');
      if (ctx.hasUI) ctx.ui.notify(msg, 'info');
      else console.log(msg);
    }
  });

  pi.registerCommand('token-saver:clear', {
    description: 'Clear persistent savings history',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      tracker.clearHistory();
      const msg = '💰 Token Saver history cleared!';
      if (ctx.hasUI) ctx.ui.notify(msg, 'info');
      else console.log(msg);
      updateStatusFooter();
    }
  });

  pi.registerCommand('token-saver:passthrough', {
    description: 'Bypass filtering for the next command',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      passthroughEnabled = true;
      if (ctx.hasUI) ctx.ui.notify("Passthrough mode enabled for the next command.", 'info');
    }
  });

  // ── Hook Pipeline ────────────────────────────────────────────────

  // Build filtered text content items from the original content
  function buildFilteredContent(originalContent: ContentItem[], filteredOutput: string): ContentItem[] {
    const originalTextItems = originalContent.filter((c): c is TextContent => c.type === 'text');
    if (originalTextItems.length === 0) return originalContent;

    const filteredTextItems: ContentItem[] = filteredOutput.split('\n').map(line => ({
      type: 'text' as const,
      text: line,
    }));

    const nonTextItems = originalContent.filter((c): c is ImageContent => c.type !== 'text');
    return [...filteredTextItems, ...nonTextItems];
  }

  // 1. tool_call hook (capture pre-execution command)
  pi.on('tool_call', (event: ToolCallEvent, ctx?: any): void => {
    if (passthroughEnabled) return;
    if (isToolCallEventType('bash', event)) {
      const rawCommand = (event.input as { command?: unknown }).command;
      if (typeof rawCommand !== 'string') return;

      const command = rawCommand.trim();
      if (!command) return;

      pendingBashCommands.set(event.toolCallId, command);
    }
  });

  // 2. tool_result hook (intercept output, apply filters, record metrics, tee error recovery)
  pi.on('tool_result', (async (event: ToolResultEvent, ctx: ExtensionContext): Promise<void | { content?: ContentItem[] }> => {
    if (passthroughEnabled) {
      passthroughEnabled = false;
      return;
    }
    if (!isBashToolResult(event)) return;

    const toolCallId = event.toolCallId;
    const command = pendingBashCommands.get(toolCallId);
    pendingBashCommands.delete(toolCallId);

    if (!command) return;

    // Safety checks
    if (!shouldFilter(command)) return;

    try {
      const textItems = event.content.filter((c): c is TextContent => c.type === 'text');
      const output = textItems.map(t => t.text).join('\n');

      if (output.length < 50) return; // skip very short outputs
      if (isBinary(output)) return;

      const result = engine.applyWithMetadata(command, output);
      const originalBytes = Buffer.byteLength(output, 'utf8');
      const filteredBytes = Buffer.byteLength(result.output, 'utf8');

      tracker.record(command, originalBytes, filteredBytes, result.matched);
      updateStatusFooter(ctx);

      if (!result.matched || result.output === output) {
        return;
      }

      let finalText = result.output;
      // Tee Recovery: If execution was an error, preserve raw output and append recovery tip
      if (event.isError) {
        try {
          const teePath = saveTee(command, output);
          finalText += `\n[full output: ${teePath}]`;
        } catch (err) {
          // Non-fatal
        }
      }

      const filteredContent = buildFilteredContent(event.content, finalText);
      return { content: filteredContent };
    } catch (error) {
      console.error(`[TokenSaver] Failed to process tool result for command: ${command}`, error);
    }
  }) as any);
}
