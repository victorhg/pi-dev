/**
 * @victorhg/pi-code-quality
 *
 * Code quality metrics extension for the Pi coding agent: complexity,
 * duplication, spaghetti index, security errors, exposed secrets, and
 * anti-code-slop scoring.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Box, Text } from "@earendil-works/pi-tui";
import { runScan, checkToolAvailability, loadConfig, type ScanProgress } from "./scan.js";
import {
  renderScorecardText,
  renderFindingsSummary,
  renderFindingsList,
  renderMarkdownReport,
  reportPath,
  buildReportCard,
  METRIC_LABELS,
  scoreEmoji,
  type ReportCard,
} from "./report.js";
import type { MetricReport } from "./schema.js";

export * from "./schema.js";
export * from "./languages.js";
export * from "./normalize.js";
export * from "./score.js";
export * from "./runners.js";
export * from "./report.js";
export * from "./scan.js";

// ── Session state ────────────────────────────────────────────────────────────

export interface CodeQualitySessionState {
  ctx: ExtensionContext | undefined;
  lastReport: MetricReport | null;
  scanCount: number;
}

export function makeCleanSession(): CodeQualitySessionState {
  return { ctx: undefined, lastReport: null, scanCount: 0 };
}

let session: CodeQualitySessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

function countFindings(report: MetricReport): number {
  return Object.values(report.scores).reduce((n, m) => n + m.findings.length, 0);
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Live spinner + elapsed-time heartbeat; returns a stop function. */
function startHeartbeat(
  render: (text: string) => void,
  getStage: () => string,
  intervalMs = 200,
): () => void {
  const started = Date.now();
  let frame = 0;
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    render(`${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]} ${getStage()}… ${secs}s`);
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}

// ── Extension activation ─────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {
  // Footer badge via @victorhg/pi-footer (optional).
  try {
    const { footerRegistry } = await import("@victorhg/pi-footer/registry");
    footerRegistry.register("code-quality", () => {
      if (!session.lastReport) return "📐 quality";
      const score = session.lastReport.overall;
      const icon = score == null ? "📐" : score >= 80 ? "✅📐" : score >= 60 ? "⚠️📐" : "❌📐";
      return `${icon} ${score ?? "n/a"}%`;
    });
  } catch {
    // Silently skip if pi-footer is not installed.
  }

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    resetSession(ctx);
  });

  // Persistent report card rendered into the chat transcript.
  pi.registerEntryRenderer("code-quality-report", (entry, { expanded }, theme) => {
    const card = entry.data as ReportCard;
    const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
    box.addChild(
      new Text(theme.bold(`📐 Code Quality: ${card.overall ?? "n/a"}/100 — ${card.target}`)),
    );
    for (const m of card.metrics) {
      const icon = scoreEmoji(m.status, m.score);
      const value = m.status === "unavailable" ? "unavailable" : `${m.score}/100`;
      const count = m.findingsCount ? ` · ${m.findingsCount} finding${m.findingsCount === 1 ? "" : "s"}` : "";
      box.addChild(new Text(`${icon} ${METRIC_LABELS[m.id]}: ${value}${count}`));
    }
    if (expanded) {
      box.addChild(new Text(theme.fg("dim", renderFindingsList(card.findings))));
    }
    return box;
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  const scan = async (
    target: string,
    ctx: ExtensionContext,
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<MetricReport> => {
    const config = await loadConfig(ctx.cwd);
    const report = await runScan(
      {
        exec: (command, args, options) =>
          pi.exec(command, args, {
            signal: options?.signal,
            timeout: options?.timeout,
            cwd: options?.cwd,
          }),
      },
      { target, cwd: ctx.cwd, config, onProgress },
    );
    session.lastReport = report;
    session.scanCount++;
    return report;
  };

  // ── Custom tool: code_quality_scan ─────────────────────────────────────────
  pi.registerTool({
    name: "code_quality_scan",
    label: "Code Quality Scan",
    description:
      "Run code quality metrics — cyclomatic complexity, duplication, spaghetti index, security errors, exposed secrets, and anti-code-slop patterns — and return a maintainability scorecard.",
    promptSnippet: "Scan code for maintainability metrics and anti-code-slop patterns",
    promptGuidelines: [
      "Use code_quality_scan when the user asks to assess code quality, maintainability, complexity, duplication, spaghetti code, security issues, or AI code slop.",
    ],
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Path to scan (default: workspace root)",
        },
      },
      required: ["target"],
    },
    async execute(_toolCallId, args, _signal, onUpdate, ctx) {
      const target = (args as { target?: string }).target || ".";
      const report = await scan(target, ctx, (p) => {
        const text =
          p.status === "start"
            ? `⏳ ${p.stage}…`
            : `${p.status === "done" ? "✅" : "⚠️"} ${p.stage}${p.detail ? ` — ${p.detail}` : ""}`;
        onUpdate?.({ content: [{ type: "text", text }], details: {} });
      });

      const text = `${renderScorecardText(report)}\n\nTop findings:\n${renderFindingsSummary(report)}`;
      return {
        content: [{ type: "text", text }],
        details: {
          target,
          overall: report.overall,
          scores: report.scores,
          findingsCount: countFindings(report),
        },
      };
    },
  });

  // ── Slash commands ─────────────────────────────────────────────────────────
  pi.registerCommand("code-quality:doctor", {
    description: "Check which analyzer tools are installed",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const availability = checkToolAvailability();
      const missing = availability.filter((t) => !t.available);
      const installed = availability.filter((t) => t.available);

      if (missing.length === 0) {
        ctx.ui.notify("✅ All code quality tools are available.", "info");
        return;
      }

      const missingLines = missing
        .map((t) => `  ❌ ${t.metric} (${t.tool}) — install with: ${t.installHint}`)
        .join("\n");
      const installedSummary = installed.length
        ? `\nInstalled:\n${installed.map((t) => `  ✅ ${t.metric} (${t.tool})`).join("\n")}`
        : "";
      ctx.ui.notify(
        `⚠️ ${missing.length}/${availability.length} tools missing:\n${missingLines}${installedSummary}`,
        "warning",
      );
    },
  });

  pi.registerCommand("code-quality:scan", {
    description: "Run a code quality scan on a path and report findings",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim() || ".";
      ctx.ui.notify(`📐 Scanning code quality on '${target}'...`, "info");

      // Validate tools upfront so missing analyzers are visible immediately.
      const missing = checkToolAvailability().filter((t) => !t.available);
      if (missing.length > 0) {
        ctx.ui.notify(
          `⚠️ Missing tools (those metrics will be skipped): ${missing
            .map((t) => `${t.tool} → ${t.installHint}`)
            .join(" · ")}`,
          "warning",
        );
      }

      let stage = "Preparing scan";
      const stopHeartbeat = startHeartbeat(
        (t) => ctx.ui.setStatus("code-quality", `📐 ${t}`),
        () => stage,
      );

      try {
        const report = await scan(target, ctx, (p) => {
          if (p.status === "start") {
            stage = p.stage;
          } else {
            const icon = p.status === "done" ? "✅" : "⚠️";
            const detail = p.detail ? ` — ${p.detail}` : "";
            ctx.ui.notify(`${icon} ${p.stage}${detail}`, p.status === "done" ? "info" : "warning");
          }
        });

        // Persistent report card in the transcript (collapse for summary, expand for findings).
        pi.appendEntry("code-quality-report", buildReportCard(report));

        // Auto-save the full Markdown risk report.
        const filePath = reportPath(report.slug);
        try {
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, renderMarkdownReport(report), "utf-8");
        } catch {
          // Report card already shown; file save is best-effort.
        }

        const icon = report.overall == null ? "📐" : report.overall >= 80 ? "✅" : report.overall >= 60 ? "⚠️" : "❌";
        ctx.ui.notify(
          `${icon} Code quality: ${report.overall ?? "n/a"}/100 — ${countFindings(report)} findings. Full report: ${filePath}`,
          report.overall != null && report.overall >= 60 ? "info" : "warning",
        );
      } catch (err) {
        ctx.ui.notify(`❌ Code quality scan failed: ${String(err)}`, "error");
      } finally {
        stopHeartbeat();
        ctx.ui.setStatus("code-quality", undefined);
      }
    },
  });

  pi.registerCommand("code-quality:status", {
    description: "Show the last code quality scorecard",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!session.lastReport) {
        ctx.ui.notify("⚠️ No code quality scan yet. Run /code-quality:scan first.", "warning");
        return;
      }
      ctx.ui.notify(renderScorecardText(session.lastReport), "info");
    },
  });

  pi.registerCommand("code-quality:report", {
    description: "Save a Markdown code quality report",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!session.lastReport) {
        ctx.ui.notify("⚠️ No scan results. Run /code-quality:scan first.", "warning");
        return;
      }
      const filePath = reportPath(session.lastReport.slug);
      try {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, renderMarkdownReport(session.lastReport), "utf-8");
        ctx.ui.notify(`📄 Code quality report saved to ${filePath}`, "info");
      } catch (err) {
        ctx.ui.notify(`❌ Failed to save report: ${String(err)}`, "error");
      }
    },
  });
}
