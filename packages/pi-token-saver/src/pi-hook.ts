import { Buffer } from 'node:buffer';
import type { ExtensionAPI, ToolCallEvent, ToolResultEvent, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { FilterEngine, stripAnsi, truncateLinesAt } from './filter-engine';
import { SavingsTracker } from './savings-tracker';

// Minimal inline types for event content (not re-exported by pi-coding-agent)
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data?: string };
type ContentItem = TextContent | ImageContent;

export default async function activate(pi: ExtensionAPI) {
  const engine = new FilterEngine();
  const tracker = new SavingsTracker();
  let passthroughEnabled = false;

  // Buffer for matching call -> result via toolCallId
  const pendingBashCommands = new Map<string, string>();

  // Setup rules
  engine.register('git status', [stripAnsi, truncateLinesAt(50)]);
  engine.register('git log', [stripAnsi, truncateLinesAt(80)]);
  engine.register('ls', [stripAnsi, truncateLinesAt(50)]);
  engine.register('find', [stripAnsi, truncateLinesAt(100)]);
  engine.register('npm install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('yarn install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('pnpm install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('bun install', [stripAnsi, truncateLinesAt(30)]);

  // Optionally register with pi-footer if it is installed — no hard dependency
  try {
    const { footerRegistry } = await import('@victorhg/pi-footer/registry');
    footerRegistry.register('token-saver', () => {
      const savingsKB = (tracker.getSessionSavings() / 1024).toFixed(1);
      return `💰${savingsKB}KB`;
    });
  } catch (err) {
    // Silently ignore if @victorhg/pi-footer is not installed
  }

  pi.registerCommand('token-saver:savings', {
    description: 'Show total tokens saved this session',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const totalBytes = tracker.getSessionSavings();
      const totalKB = (totalBytes / 1024).toFixed(2);
      const commandCount = tracker.getHistory().length;
      const message = commandCount === 0
        ? 'No matched commands recorded yet — run a filtered command (e.g. git status, ls) first.'
        : `💰 Session savings: ${totalKB} KB (${totalBytes.toLocaleString()} bytes) across ${commandCount} command${commandCount === 1 ? '' : 's'}.`;
      if (ctx.hasUI) ctx.ui.notify(message, 'info');
      else console.log(message);
    }
  });

  pi.registerCommand('token-saver:history', {
    description: 'Show per-command token savings breakdown for this session',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const history = tracker.getHistory();
      if (history.length === 0) {
        const msg = 'No matched commands recorded yet — run a filtered command (e.g. git status, ls) first.';
        if (ctx.hasUI) ctx.ui.notify(msg, 'info');
        else console.log(msg);
        return;
      }
      const lines: string[] = ['Token savings breakdown:'];
      for (const record of history) {
        const kb = (record.bytesSaved / 1024).toFixed(2);
        const time = new Date(record.timestamp).toLocaleTimeString();
        const outcome = record.bytesSaved > 0 ? `saved ${kb} KB` : 'matched (no reduction)';
        lines.push(`  [${time}] ${record.command} — ${outcome}`);
      }
      const totalKB = (tracker.getSessionSavings() / 1024).toFixed(2);
      lines.push(`Total: ${totalKB} KB`);
      const msg = lines.join('\n');
      if (ctx.hasUI) ctx.ui.notify(msg, 'info');
      else console.log(msg);
    }
  });

  pi.registerCommand('token-saver:passthrough', {
    description: 'Bypass filtering for next command',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      passthroughEnabled = true;
      if (ctx.hasUI) ctx.ui.notify("Passthrough mode enabled for the next command.", 'info');
    }
  });

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

  // Listen for tool_call to capture the command text (pre-execution)
  pi.on('tool_call', (event: ToolCallEvent): void => {
    if (passthroughEnabled) return;
    if (isToolCallEventType('bash', event)) {
      const rawCommand = (event.input as { command?: unknown }).command;
      if (typeof rawCommand !== 'string') {
        return;
      }

      const command = rawCommand.trim();
      if (!command) {
        return;
      }

      console.log(`[TokenSaver] Tool call captured: ${command}`);
      pendingBashCommands.set(event.toolCallId, command);
    }
  });

  // Listen for tool_result to capture the output and record savings (post-execution)
  pi.on('tool_result', (async (event: ToolResultEvent, _ctx: ExtensionContext): Promise<void | { content?: ContentItem[] }> => {
    if (passthroughEnabled) {
      passthroughEnabled = false;
      return;
    }
    if (!isBashToolResult(event)) return;

    const toolCallId = event.toolCallId;
    const command = pendingBashCommands.get(toolCallId);
    pendingBashCommands.delete(toolCallId);

    if (!command) {
      return;
    }

    try {
      const textItems = event.content.filter((c): c is TextContent => c.type === 'text');
      const output = textItems.map(t => t.text).join('\n');
      const result = engine.applyWithMetadata(command, output);
      const originalBytes = Buffer.byteLength(output, 'utf8');
      const filteredBytes = Buffer.byteLength(result.output, 'utf8');

      tracker.record(command, originalBytes, filteredBytes, result.matched);

      if (!result.matched || result.output === output) {
        return;
      }

      const filteredContent = buildFilteredContent(event.content, result.output);
      return { content: filteredContent };
    } catch (error) {
      console.error(`[TokenSaver] Failed to process tool result for command: ${command}`, error);
    }
  }) as any);
}
