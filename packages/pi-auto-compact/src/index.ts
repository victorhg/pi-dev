import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ── Package Settings & State ─────────────────────────────────────────────────
let warnThreshold = 75;      // Warning notification threshold (%)
let compactThreshold = 90;   // Auto-compaction trigger threshold (%)
let customInstructions = "Focus on summarizing file operations, tasks completed, and critical code details, discarding verbose command outputs";

let isCompacting = false;
let warned = false;
let lastPercent = 0;
let currentCtx: ExtensionContext | undefined;

/** Count compaction entries in the current session. */
function getCompactionCount(ctx: ExtensionContext): number {
  try {
    const entries = ctx.sessionManager.getEntries();
    return entries.filter(e => e?.type === "compaction").length;
  } catch {
    return 0;
  }
}

/** Check context usage and trigger warning or compaction. */
function checkContextUsage(ctx: ExtensionContext) {
  if (isCompacting) return;

  const usage = (ctx as any).getContextUsage?.();
  if (!usage) return;

  const percentValue = usage.percent; // e.g. 78.5 (number between 0 and 100)
  if (typeof percentValue !== "number") return;

  lastPercent = percentValue;

  // 1. Auto-compaction trigger
  if (percentValue >= compactThreshold) {
    isCompacting = true;

    const notifyMsg = `⚠️ Context window usage is at ${percentValue.toFixed(1)}% (Threshold: ${compactThreshold}%). Triggering auto-compaction...`;
    if (ctx.hasUI) {
      ctx.ui.notify(notifyMsg, "warning");
    } else {
      console.warn(`[AutoCompact] ${notifyMsg}`);
    }

    if (typeof ctx.compact === "function") {
      ctx.compact({
        customInstructions,
        onComplete: () => {
          isCompacting = false;
          warned = false;
          const msg = "📦 Auto-compaction completed successfully!";
          if (ctx.hasUI) {
            ctx.ui.notify(msg, "info");
          } else {
            console.log(`[AutoCompact] ${msg}`);
          }
        },
        onError: (err: Error) => {
          isCompacting = false;
          const errMsg = `❌ Auto-compaction failed: ${err.message}`;
          if (ctx.hasUI) {
            ctx.ui.notify(errMsg, "error");
          } else {
            console.error(`[AutoCompact] ${errMsg}`);
          }
        }
      });
    } else {
      isCompacting = false;
      console.error("[AutoCompact] ctx.compact is not a function");
    }
  }
  // 2. Warning trigger
  else if (percentValue >= warnThreshold && !warned) {
    warned = true;
    const warnMsg = `⚠️ Warning: Context window usage is at ${percentValue.toFixed(1)}% (Threshold: ${warnThreshold}%). Auto-compaction will trigger at ${compactThreshold}%.`;
    if (ctx.hasUI) {
      ctx.ui.notify(warnMsg, "warning");
    } else {
      console.warn(`[AutoCompact] ${warnMsg}`);
    }
  }
  // 3. Reset warned state if context usage drops back below warning threshold
  else if (percentValue < warnThreshold && warned) {
    warned = false;
  }
}

// ── Extension Activation ─────────────────────────────────────────────────────
export default async function activate(pi: ExtensionAPI) {
  
  // Try registering with the @victorhg/pi-footer status bar registry
  try {
    const { footerRegistry } = await import('@victorhg/pi-footer/registry');
    footerRegistry.register('auto-compact', () => {
      if (!currentCtx) return undefined;
      
      const count = getCompactionCount(currentCtx);
      if (count > 0) {
        return `📦${count}`;
      }
      if (lastPercent >= warnThreshold) {
        return `⚠️📦`;
      }
      return undefined;
    });
  } catch (err) {
    // Silently ignore if @victorhg/pi-footer is not installed
  }

  // ── Session Event Hooks ────────────────────────────────────────────────────
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    currentCtx = ctx;
    warned = false;
    isCompacting = false;
    
    // Perform initial context usage check
    setTimeout(() => {
      if (currentCtx) checkContextUsage(currentCtx);
    }, 1000);
  });

  pi.on("session_shutdown", () => {
    currentCtx = undefined;
  });

  // Re-evaluate context size after a tool executes
  pi.on("tool_result", (_event, ctx: ExtensionContext) => {
    checkContextUsage(ctx);
  });

  // Re-evaluate context size after turn completes (to catch assistant responses)
  pi.on("turn_end", (_event, ctx: ExtensionContext) => {
    checkContextUsage(ctx);
  });

  // ── Command Registrations ──────────────────────────────────────────────────
  pi.registerCommand("auto-compact:status", {
    description: "Show auto-compact threshold levels, current usage, and compaction count",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const usage = (ctx as any).getContextUsage?.();
      const currentPercent = usage ? `${usage.percent.toFixed(1)}%` : 'Unknown%';
      const currentTokens = usage ? `${usage.total.toLocaleString()} / ${usage.limit.toLocaleString()}` : 'Unknown';
      const count = currentCtx ? getCompactionCount(currentCtx) : 0;

      const lines = [
        `📦 Auto-Compact Analytics:`,
        `  - Context Usage: ${currentPercent} (${currentTokens} tokens)`,
        `  - Warning Threshold: ${warnThreshold}%`,
        `  - Compaction Threshold: ${compactThreshold}%`,
        `  - Auto-Compactions Performed: ${count}`,
        `  - Status: ${isCompacting ? 'Compacting...' : 'Monitoring'}`,
        `  - Custom Instructions: "${customInstructions}"`
      ];

      const statusMessage = lines.join('\n');
      if (ctx.hasUI) {
        ctx.ui.notify(statusMessage, "info");
      } else {
        console.log(statusMessage);
      }
    }
  });

  pi.registerCommand("auto-compact:set", {
    description: "Configure thresholds (e.g. 'warn 75' or 'compact 85')",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const parts = args.trim().split(/\s+/);
      if (parts.length !== 2) {
        const errorMsg = '❌ Usage: /auto-compact:set <warn|compact> <percentage (1-100)>';
        if (ctx.hasUI) ctx.ui.notify(errorMsg, 'error');
        else console.error(errorMsg);
        return;
      }

      const [type, valStr] = parts;
      const val = parseFloat(valStr);

      if (isNaN(val) || val <= 0 || val > 100) {
        const errorMsg = '❌ Percentage must be a number between 1 and 100';
        if (ctx.hasUI) ctx.ui.notify(errorMsg, 'error');
        else console.error(errorMsg);
        return;
      }

      if (type === 'warn') {
        if (val >= compactThreshold) {
          const errorMsg = `❌ Warning threshold must be less than compaction threshold (${compactThreshold}%)`;
          if (ctx.hasUI) ctx.ui.notify(errorMsg, 'error');
          else console.error(errorMsg);
          return;
        }
        warnThreshold = val;
        const msg = `⚙️ Auto-Compact warning threshold set to ${warnThreshold}%`;
        if (ctx.hasUI) ctx.ui.notify(msg, 'info');
        else console.log(msg);
      } else if (type === 'compact') {
        if (val <= warnThreshold) {
          const errorMsg = `❌ Compaction threshold must be greater than warning threshold (${warnThreshold}%)`;
          if (ctx.hasUI) ctx.ui.notify(errorMsg, 'error');
          else console.error(errorMsg);
          return;
        }
        compactThreshold = val;
        const msg = `⚙️ Auto-Compact auto-compaction threshold set to ${compactThreshold}%`;
        if (ctx.hasUI) ctx.ui.notify(msg, 'info');
        else console.log(msg);
      } else {
        const errorMsg = '❌ Invalid type. Must be "warn" or "compact"';
        if (ctx.hasUI) ctx.ui.notify(errorMsg, 'error');
        else console.error(errorMsg);
      }
    }
  });

  pi.registerCommand("auto-compact:instructions", {
    description: "Update the custom compaction instructions",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const instructions = args.trim();
      if (!instructions) {
        const msg = `⚙️ Current Compaction Instructions: "${customInstructions}"`;
        if (ctx.hasUI) ctx.ui.notify(msg, 'info');
        else console.log(msg);
        return;
      }

      customInstructions = instructions;
      const msg = `⚙️ Auto-Compact instructions updated to: "${customInstructions}"`;
      if (ctx.hasUI) ctx.ui.notify(msg, 'info');
      else console.log(msg);
    }
  });
}
