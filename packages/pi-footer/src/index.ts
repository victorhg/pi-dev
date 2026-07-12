/**
 * Rich footer status bar for the pi coding agent.
 *
 * Displays: dir | model | ◐thinking | branch [+status] | worktree | ↑↓R W $cost | ━━━━━ context%
 *
 * Splits into two lines when terminal width < splitThreshold (default 150):
 *   Line 1: system info (dir, branch, model, thinking, worktree)
 *   Line 2: usage stats (↑↓R W $cost + context progress bar)
 */

import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { getGitStatus, getWorktreeBranch } from "./utils/git.js";
import { getContextWindowInfo, getTokenUsageStats, type TokenUsageStats, invalidateStatsCache, type ContextWindowInfo } from "./utils/stats.js";
import { formatContextBar, formatGitStatusIndicators, formatThinkingIndicator, formatTokenCount } from "./utils/format.js";
import { footerIcons } from "./utils/icons.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute token/cost stats from session entries. */
function computeStatsFromSession(ctx: ExtensionContext): TokenUsageStats {
  const entries = ctx.sessionManager.getEntries();
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0, totalCost = 0;

  for (const sessionEntry of entries) {
    if (sessionEntry?.type === "message" && (sessionEntry as any).message?.role === "assistant") {
      const m = (sessionEntry as any).message as { usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: { total?: number } } };
      if (m.usage) {
        totalInput += m.usage.input || 0;
        totalOutput += m.usage.output || 0;
        totalCacheRead += m.usage.cacheRead || 0;
        totalCacheWrite += m.usage.cacheWrite || 0;
        totalCost += m.usage.cost?.total || 0;
      }
    }
  }

  return { totalInput, totalOutput, totalCacheRead, totalCacheWrite, totalCost };
}

// Get context usage from the context object
function getContextInfo(ctx: ExtensionContext): ContextWindowInfo {
  const contextUsage = (ctx as any).getContextUsage?.();
  if (!contextUsage) {
    const modelContextWindow = (ctx as any).model?.contextWindow ?? (ctx as any).model?.maxTokens ?? 0;
    const tokenStats = getTokenUsageStats(ctx);
    const percentValue = modelContextWindow > 0 ? ((tokenStats.totalInput + tokenStats.totalOutput) / modelContextWindow) * 100 : 0;
    return { percent: "?", percentValue, windowSize: modelContextWindow };
  }

  const modelContextWindow = (contextUsage.contextWindow as number | undefined) ?? (ctx as any).model?.contextWindow ?? (ctx as any).model?.maxTokens ?? 0;
  const tokenStats = getTokenUsageStats(ctx);

  const percentValue =
    (contextUsage.percent as number | undefined) ??
    (modelContextWindow > 0 ? ((tokenStats.totalInput + tokenStats.totalOutput) / modelContextWindow) * 100 : 0);

  return {
    percent: (contextUsage.percent != null) ? percentValue.toFixed(1) : "?",
    percentValue,
    windowSize: modelContextWindow,
  };
}

// ── Configuration ────────────────────────────────────────────────────────────

export interface PiFooterConfig {
  /** Terminal width threshold for two-line footer split (default 150) */
  splitThreshold?: number;
  /** Sections to display in the footer */
  sections?: {
    directory?: boolean;
    model?: boolean;
    thinking?: boolean;
    git?: boolean;
    stats?: boolean;
    contextBar?: boolean;
  };
}

const DEFAULT_CONFIG: Required<PiFooterConfig> = {
  splitThreshold: 150,
  sections: {
    directory: true,
    model: true,
    thinking: true,
    git: true,
    stats: true,
    contextBar: true,
  },
};

function resolveConfig(config?: PiFooterConfig): Required<PiFooterConfig> {
  return { ...DEFAULT_CONFIG, ...config };
}

// ── Extension ────────────────────────────────────────────────────────────────

export function registerFooter(pi: ExtensionAPI, config?: PiFooterConfig): void {
  const resolvedConfig = resolveConfig(config);

  // session_shutdown handler — cleanup on session end
  pi.on("session_shutdown", (_event, _ctx) => {
    // No accumulated state to clean — stats are computed inline per render
  });

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

      // Invalidate stats cache when branch changes (new message may arrive)
      unsubscribe && undefined; // kept for dispose

      return {
        dispose: unsubscribe,
        invalidate() { invalidateStatsCache(); },
        render(width: number): string[] {
          try {
            const colorize = (token: string, s: string) => theme.fg(token as any, s);
            const activeModel = (ctx as any).model?.id || "no-model";
            const currentBranch = footerData.getGitBranch();
            const currentDirectory = process.cwd().split("/").pop() || process.cwd();
            const gitStatus = getGitStatus();
            const worktreeBranch = getWorktreeBranch();
            const thinkingLevel = (pi as any).getThinkingLevel?.() || "off";

            // Compute merged stats (main session only — no subagent bus in this package)
            const mergedStats = computeStatsFromSession(ctx);

            const { totalInput, totalOutput, totalCacheRead, totalCacheWrite, totalCost } = mergedStats;
            const { percent: contextPercent, percentValue: contextPercentValue, windowSize: contextWindowSize } = getContextInfo(ctx);

            // ── Two-line split for narrow terminals ────────────────────────────

            const shouldSplit = width < resolvedConfig.splitThreshold;

            // Thinking display
            const thinkingIndicatorStr = formatThinkingIndicator(thinkingLevel, colorize);

            // Git status indicators
            const gitStatusStr = formatGitStatusIndicators(gitStatus, colorize);

            // Left section: dir | branch [+status] | model | thinking | worktree
            const leftSections = [
              resolvedConfig.sections.directory ? colorize("syntaxFunction", " " + footerIcons.directory + currentDirectory) : "",
              resolvedConfig.sections.git && currentBranch ? colorize("success", footerIcons.branch + " " + currentBranch + (gitStatusStr ? " " + gitStatusStr : "")) : "",
              resolvedConfig.sections.model ? colorize("syntaxType", footerIcons.model + " " + activeModel) : "",
              resolvedConfig.sections.thinking ? thinkingIndicatorStr : "",
              resolvedConfig.sections.git && worktreeBranch ? colorize("syntaxNumber", footerIcons.worktree + " " + worktreeBranch) : "",
            ].filter(Boolean);

            const separator = theme.fg("dim", " · ");
            const leftSectionStr = leftSections.join(separator);

            // Token stats with context percentage
            const statsParts: string[] = [];
            if (resolvedConfig.sections.stats) {
              if (totalInput) statsParts.push("↑" + formatTokenCount(totalInput));
              if (totalOutput) statsParts.push("↓" + formatTokenCount(totalOutput));
              if (totalCacheRead) statsParts.push("R" + formatTokenCount(totalCacheRead));
              if (totalCacheWrite) statsParts.push("W" + formatTokenCount(totalCacheWrite));
              if (totalCost) statsParts.push("$" + totalCost.toFixed(2));
              
              // Integrate Token Saver stats if available
              const tokenSaver = (pi as any).tokenSaver;
              if (tokenSaver) {
                const savingsKB = (tokenSaver.getSessionSavings() / 1024).toFixed(1);
                statsParts.push(theme.fg("success", "💰" + savingsKB + "KB"));
              }
            }

            if (resolvedConfig.sections.contextBar) {
              const contextUsed = contextWindowSize * (contextPercentValue / 100);
              const contextDisplay =
                contextPercent === "?"
                  ? "?"
                  : formatTokenCount(contextUsed) + "/" + formatTokenCount(contextWindowSize);
              const contextColored =
                contextPercentValue > 95
                  ? theme.fg("error", contextDisplay)
                  : contextPercentValue > 80
                    ? theme.fg("warning", contextDisplay)
                    : contextDisplay;
              statsParts.push(contextColored);
            }

            const rawStatsSectionStr = statsParts.join(" ");
            const statsSectionStr = theme.fg("dim", rawStatsSectionStr);

            if (shouldSplit) {
              // ── Two-line mode ──────────────────────────────────────────────

              // Calculate available space for the context progress bar on line 2
              const availableBarSpace = Math.max(2, width - visibleWidth(statsSectionStr) - 13);

              // Context progress bar (expands to fill remaining space)
              const contextBarStr = formatContextBar(colorize as (token: string, s: string) => string, contextPercentValue, availableBarSpace);

              // Assemble line 2: stats | bar
              const rightSections: string[] = [];
              if (statsSectionStr) rightSections.push(statsSectionStr);
              if (contextBarStr) rightSections.push(contextBarStr);
              const rightSectionStr = rightSections.join(theme.fg("dim", " · "));

              // Edge case: if both stats and bar are empty, return only line 1
              if (!rightSectionStr) {
                return [clampLine(leftSectionStr, width)];
              }

              return [
                clampLine(leftSectionStr, width),
                clampLine(rightSectionStr, width),
              ];
            }

            // ── Single-line mode ───────────────────────────────────────────────

            // Separator between left and right sections
            const sectionSeparator = theme.fg("dim", " · ");

            // Calculate available space for the context progress bar (after stats)
            const availableBarSpace = Math.max(
              2,
              width - visibleWidth(leftSectionStr) - 1 - visibleWidth(sectionSeparator) - visibleWidth(statsSectionStr) - 10,
            );

            // Context progress bar (expands to fill remaining space)
            const contextBarStr = formatContextBar(colorize as (token: string, s: string) => string, contextPercentValue, availableBarSpace);

            // Assemble: left | stats | bar
            const rightSections: string[] = [];
            if (statsSectionStr) rightSections.push(statsSectionStr);
            if (contextBarStr) rightSections.push(contextBarStr);
            const rightSectionStr = rightSections.join(theme.fg("dim", " · "));

            return [clampLine(leftSectionStr + sectionSeparator + rightSectionStr, width)];
          } catch (e) {
            console.error("[pi-footer] Render error:", e);
            return [];
          }
        },
      };
    });
  });
}

export default registerFooter;

/** Clamp line to width (wrapper around truncateToWidth). */
function clampLine(line: string, width: number): string {
  return truncateToWidth(line, width);
}
