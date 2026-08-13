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
import { runScan } from "./scan.js";
import {
  renderScorecardText,
  renderFindingsSummary,
  renderMarkdownReport,
  reportPath,
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

  pi.on("session_shutdown", () => {
    resetSession();
  });

  const scan = async (target: string, ctx: ExtensionContext): Promise<MetricReport> => {
    const report = await runScan(
      {
        exec: (command, args, options) =>
          pi.exec(command, args, {
            signal: options?.signal,
            timeout: options?.timeout,
            cwd: options?.cwd,
          }),
      },
      { target, cwd: ctx.cwd },
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
    async execute(_toolCallId, args, _signal, _onUpdate, ctx) {
      const target = (args as { target?: string }).target || ".";
      const report = await scan(target, ctx);

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
  pi.registerCommand("code-quality:scan", {
    description: "Run a code quality scan on a path",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim() || ".";
      ctx.ui.notify(`📐 Scanning code quality on '${target}'...`, "info");
      try {
        const report = await scan(target, ctx);
        const icon = report.overall == null ? "📐" : report.overall >= 80 ? "✅" : report.overall >= 60 ? "⚠️" : "❌";
        ctx.ui.notify(
          `${icon} Code quality: ${report.overall ?? "n/a"}/100 (${countFindings(report)} findings)`,
          report.overall != null && report.overall >= 60 ? "info" : "warning",
        );
      } catch (err) {
        ctx.ui.notify(`❌ Code quality scan failed: ${String(err)}`, "error");
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
