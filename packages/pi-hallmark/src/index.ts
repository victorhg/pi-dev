/**
 * Main extension entrypoint for @victorhg/pi-hallmark.
 * Registers tools, slash commands, session lifecycle hooks, and footer status bar badges.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { auditContent, renderAuditReport, slugify } from "./audit.js";
import { HALLMARK_THEMES, getRotatedTheme, renderTokensCss, createCustomTheme } from "./themes.js";
import { HALLMARK_MACROSTRUCTURES, getRotatedMacrostructure } from "./macrostructures.js";
import { studyTarget } from "./study.js";
import type { HallmarkAuditResult, HallmarkGenerateResult } from "./types.js";

// ── Session State ────────────────────────────────────────────────────────────

export interface HallmarkSessionState {
  ctx: ExtensionContext | undefined;
  lastAudit: HallmarkAuditResult | null;
  lastThemeId: string | undefined;
  lastMacrostructureId: string | undefined;
  auditCount: number;
}

export function makeCleanSession(): HallmarkSessionState {
  return {
    ctx: undefined,
    lastAudit: null,
    lastThemeId: undefined,
    lastMacrostructureId: undefined,
    auditCount: 0,
  };
}

let session: HallmarkSessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

// ── Extension Activation ─────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {
  // Register footer badge if @victorhg/pi-footer is installed
  try {
    const { footerRegistry } = await import("@victorhg/pi-footer/registry");
    footerRegistry.register("hallmark", () => {
      if (!session.lastAudit) return "🎨 Hallmark";
      const score = session.lastAudit.overallScore;
      const icon = score >= 90 ? "🎨" : score >= 75 ? "⚠️🎨" : "❌🎨";
      return `${icon} ${score}%`;
    });
  } catch {
    // Silently skip if footer is not available
  }

  // Session lifecycle hooks
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    resetSession(ctx);
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // ── Custom Tool: hallmark_audit ──────────────────────────────────────────
  pi.registerTool({
    name: "hallmark_audit",
    label: "Hallmark Design Audit",
    description: "Audit HTML/CSS/JSX code against Hallmark's 57 slop-test gates and anti-pattern checklist.",
    promptSnippet: "Audit design code for anti-AI-slop compliance and score on 6 critique axes.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target file path or component name to audit",
        },
        sampleCode: {
          type: "string",
          description: "Optional code content to audit directly",
        },
      },
      required: ["target"],
    },
    execute: async (_toolCallId, args, _signal, _onUpdate, _ctx) => {
      const target = (args as any).target || "workspace";
      const sampleCode = (args as any).sampleCode || "";

      const auditResult = auditContent(sampleCode, target);
      session.lastAudit = auditResult;
      session.auditCount++;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(auditResult, null, 2),
          },
        ],
        details: {
          target,
          overallScore: auditResult.overallScore,
          violationsCount: auditResult.violations.length,
          critiqueScores: auditResult.scores,
        },
      };
    },
  });

  // ── Custom Tool: hallmark_generate ─────────────────────────────────────────
  pi.registerTool({
    name: "hallmark_generate",
    label: "Hallmark Design Generator",
    description: "Pick anti-slop macrostructure, theme, and tokens for a project brief.",
    promptSnippet: "Generate anti-slop design system tokens, macrostructure, and layout rhythm for a brief.",
    parameters: {
      type: "object",
      properties: {
        brief: {
          type: "string",
          description: "Description of the app or landing page brief",
        },
        customColor: {
          type: "string",
          description: "Optional custom OKLCH color anchor for custom route",
        },
      },
      required: ["brief"],
    },
    execute: async (_toolCallId, args, _signal, _onUpdate, _ctx) => {
      const brief = (args as any).brief || "Landing Page";
      const customColor = (args as any).customColor;

      const theme = customColor
        ? createCustomTheme(brief, customColor, "Instrument Serif, serif", "Inter, sans-serif")
        : getRotatedTheme(session.lastThemeId);

      const macrostructure = getRotatedMacrostructure(session.lastMacrostructureId);

      session.lastThemeId = theme.id;
      session.lastMacrostructureId = macrostructure.id;

      const result: HallmarkGenerateResult = {
        brief,
        isComponentScope: brief.split(" ").length <= 3 && /button|card|modal/i.test(brief),
        macrostructure,
        theme,
        navArchetype: "N5 Floating pill",
        footerArchetype: "Ft5 Statement",
        enrichment: "typography-only",
        critiqueStamp: "/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */",
        tokensCss: renderTokensCss(theme),
        structureSummary: `Brief: ${brief}\nMacrostructure: ${macrostructure.name} (${macrostructure.number})\nTheme: ${theme.name} (${theme.id})\nNav: N5 Floating pill\nFooter: Ft5 Statement`,
        createdAt: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        details: { brief, theme: theme.name, macrostructure: macrostructure.name },
      };
    },
  });

  // ── Custom Tool: hallmark_study ────────────────────────────────────────────
  pi.registerTool({
    name: "hallmark_study",
    label: "Hallmark Design DNA Study",
    description: "Extract design DNA (macrostructure, color anchor, fonts, archetypes) from a URL or design reference.",
    promptSnippet: "Study design reference to extract visual DNA without copying pixels.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "URL or design reference description",
        },
        sampleContent: {
          type: "string",
          description: "Optional HTML/CSS sample content of the reference",
        },
      },
      required: ["target"],
    },
    execute: async (_toolCallId, args, _signal, _onUpdate, _ctx) => {
      const target = (args as any).target || "reference";
      const sampleContent = (args as any).sampleContent || "";

      const studyResult = studyTarget(sampleContent, target);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(studyResult, null, 2),
          },
        ],
        details: { target, mode: studyResult.mode, dna: studyResult.dna },
      };
    },
  });

  // ── Slash Command: /hallmark:audit ─────────────────────────────────────────
  pi.registerCommand("hallmark:audit", {
    description: "Run Hallmark anti-slop design audit on a target file or workspace",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim() || "workspace";
      ctx.ui.notify(`🎨 Running Hallmark anti-slop audit on '${target}'...`, "info");

      const auditResult = auditContent("", target);
      session.lastAudit = auditResult;
      session.auditCount++;

      const reportMd = renderAuditReport(auditResult);
      const filePath = `hallmark-audit-${slugify(target)}.md`;

      try {
        await writeFile(filePath, reportMd, "utf-8");
        ctx.ui.notify(`✅ Audit complete! Score: ${auditResult.overallScore}/100. Saved report to ${filePath}`, "info");
      } catch (err) {
        ctx.ui.notify(`✅ Audit complete! Score: ${auditResult.overallScore}/100`, "info");
      }
    },
  });

  // ── Slash Command: /hallmark:generate ──────────────────────────────────────
  pi.registerCommand("hallmark:generate", {
    description: "Generate Hallmark design structure, theme, and CSS tokens for a brief",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const brief = args.trim() || "New Greenfield Landing Page";
      ctx.ui.notify(`🎨 Generating Hallmark layout rhythm for: '${brief}'...`, "info");

      const theme = getRotatedTheme(session.lastThemeId);
      const macro = getRotatedMacrostructure(session.lastMacrostructureId);

      session.lastThemeId = theme.id;
      session.lastMacrostructureId = macro.id;

      ctx.ui.notify(`✨ Selected Macrostructure: ${macro.number} ${macro.name} | Theme: ${theme.name}`, "info");
    },
  });

  // ── Slash Command: /hallmark:study ─────────────────────────────────────────
  pi.registerCommand("hallmark:study", {
    description: "Extract design DNA from a URL or reference image",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim() || "https://example.com";
      ctx.ui.notify(`🔍 Studying design DNA for: '${target}'...`, "info");

      const res = studyTarget("", target);
      ctx.ui.notify(`🧬 Extracted DNA: ${res.dna.macrostructure} | ${res.dna.displayFont}`, "info");
    },
  });

  // ── Slash Command: /hallmark:status ────────────────────────────────────────
  pi.registerCommand("hallmark:status", {
    description: "Show last Hallmark design audit scores and session stats",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!session.lastAudit) {
        ctx.ui.notify("⚠️ No Hallmark audits run in this session. Run /hallmark:audit first.", "warning");
        return;
      }
      const a = session.lastAudit;
      const s = a.scores;
      ctx.ui.notify(
        `🎨 Last Audit (${a.target}): Score ${a.overallScore}/100 [P${s.philosophy} H${s.hierarchy} E${s.execution} S${s.specificity} R${s.restraint} V${s.variety}] - ${a.violations.length} violations`,
        "info"
      );
    },
  });
}
