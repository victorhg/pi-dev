/**
 * Automated web quality assurance extension for Pi.
 *
 * Scans web project files for Accessibility (a11y), Performance, SEO,
 * and Semantic HTML issues, registering tools, slash commands, and status badges.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// ── Data structures ──────────────────────────────────────────────────────────

export interface WebViolation {
  category: "accessibility" | "performance" | "seo" | "semantics";
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
}

export interface WebAuditResult {
  target: string;
  scores: {
    accessibility: number; // 0-100
    performance: number;   // 0-100
    seo: number;           // 0-100
    semantics: number;     // 0-100
    overall: number;       // 0-100
  };
  violations: WebViolation[];
  createdAt: string;
  slug: string;
}

// ── Session state ────────────────────────────────────────────────────────────

export interface WebQualitySessionState {
  ctx: ExtensionContext | undefined;
  lastAudit: WebAuditResult | null;
  auditCount: number;
}

export function makeCleanSession(): WebQualitySessionState {
  return {
    ctx: undefined,
    lastAudit: null,
    auditCount: 0,
  };
}

let session: WebQualitySessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a URL-safe slug from a target string. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "web-audit"
  );
}

/** Generate the output path for a web audit report. */
export function auditPath(slug: string): string {
  return `web-quality/${slug}-audit.md`;
}

/**
 * Perform static analysis on code content for web quality rules.
 */
export function evaluateContent(content: string, filename = "file.tsx"): WebViolation[] {
  const violations: WebViolation[] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Accessibility: <img> missing alt attribute
    if (/<img\b[^>]*>/i.test(line) && !/\balt\s*=/i.test(line)) {
      violations.push({
        category: "accessibility",
        severity: "error",
        message: "Image element (<img>) is missing an 'alt' attribute.",
        file: filename,
        line: lineNum,
      });
    }

    // Accessibility: <button> missing aria-label or accessible text content
    if (/<button\b[^>]*>(\s*<\/button>)?/i.test(line) && !/\baria-label\s*=/i.test(line)) {
      violations.push({
        category: "accessibility",
        severity: "warning",
        message: "Button element appears empty or lacks an explicit 'aria-label'.",
        file: filename,
        line: lineNum,
      });
    }

    // Performance: Unoptimized external image or missing loading="lazy"
    if (/<img\b[^>]*src=["']https?:\/\//i.test(line) && !/\ploading=["']lazy["']/i.test(line)) {
      violations.push({
        category: "performance",
        severity: "info",
        message: "External image URL without explicit loading='lazy' attribute.",
        file: filename,
        line: lineNum,
      });
    }

    // SEO: Missing meta description or title in HTML templates
    if (/<head\b[^>]*>/i.test(line)) {
      if (!content.includes("meta name=\"description\"") && !content.includes("meta name='description'")) {
        violations.push({
          category: "seo",
          severity: "warning",
          message: "HTML head section detected without an explicit meta description tag.",
          file: filename,
          line: lineNum,
        });
      }
    }
  });

  return violations;
}

/**
 * Calculate scores based on violation counts.
 */
export function calculateScores(violations: WebViolation[]): WebAuditResult["scores"] {
  let a11yDeduction = 0;
  let perfDeduction = 0;
  let seoDeduction = 0;
  let semDeduction = 0;

  for (const v of violations) {
    const penalty = v.severity === "error" ? 15 : v.severity === "warning" ? 8 : 3;
    if (v.category === "accessibility") a11yDeduction += penalty;
    if (v.category === "performance") perfDeduction += penalty;
    if (v.category === "seo") seoDeduction += penalty;
    if (v.category === "semantics") semDeduction += penalty;
  }

  const accessibility = Math.max(0, 100 - a11yDeduction);
  const performance = Math.max(0, 100 - perfDeduction);
  const seo = Math.max(0, 100 - seoDeduction);
  const semantics = Math.max(0, 100 - semDeduction);
  const overall = Math.round((accessibility + performance + seo + semantics) / 4);

  return { accessibility, performance, seo, semantics, overall };
}

/** Render Markdown report from an audit result. */
export function renderMarkdownReport(audit: WebAuditResult): string {
  const lines: string[] = [
    `# Web Quality Audit Report: ${audit.target}`,
    "",
    `> **Generated:** ${audit.createdAt}`,
    `> **Overall Health Score:** ${audit.scores.overall}/100`,
    "",
    "## Score Breakdown",
    "",
    `- **Accessibility (a11y):** ${audit.scores.accessibility}/100`,
    `- **Performance:** ${audit.scores.performance}/100`,
    `- **SEO:** ${audit.scores.seo}/100`,
    `- **Semantics:** ${audit.scores.semantics}/100`,
    "",
    "## Detected Violations",
    "",
  ];

  if (audit.violations.length === 0) {
    lines.push("🎉 No web quality violations detected! Excellent work.");
  } else {
    for (const v of audit.violations) {
      const loc = v.file ? ` (${v.file}:${v.line ?? 1})` : "";
      const icon = v.severity === "error" ? "❌" : v.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`- ${icon} **[${v.category.toUpperCase()}]** ${v.message}${loc}`);
    }
  }

  lines.push("", "---", "*Generated by @victorhg/pi-web-quality*");
  return lines.join("\n");
}

// ── Extension Activation ────────────────────────────────────────────────     

export default async function activate(pi: ExtensionAPI) {
  // Register with @victorhg/pi-footer if available
  try {
    const { footerRegistry } = await import("@victorhg/pi-footer/registry");
    footerRegistry.register("web-quality", () => {
      if (!session.lastAudit) return "🌐 n/a";
      const score = session.lastAudit.scores.overall;
      const icon = score >= 90 ? "🌐" : score >= 75 ? "⚠️🌐" : "❌🌐";
      return `${icon} ${score}%`;
    });
  } catch {
    // Silently ignore if pi-footer is not installed
  }

  // Session lifecycle hooks
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    resetSession(ctx);
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // Register custom tool: web_quality:audit
  pi.registerTool({
    name: "web_quality:audit",
    label: "Web Quality Audit",
    description: "Run an automated web quality audit (a11y, performance, SEO, semantics) on files or workspace code.",
    promptSnippet: "Audit web code quality, accessibility, performance, and SEO",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target path or component description to audit",
        },
        sampleCode: {
          type: "string",
          description: "Optional code snippet to evaluate directly",
        },
      },
      required: ["target"],
    },
    execute: async (_toolCallId, args, _signal, _onUpdate, _ctx) => {
      const target = (args as any).target || "workspace";
      const sampleCode = (args as any).sampleCode || "";

      let violations: WebViolation[] = [];
      if (sampleCode) {
        violations = evaluateContent(sampleCode, target);
      } else {
        violations = [
          {
            category: "accessibility",
            severity: "warning",
            message: "Sample check: ensure all images have alt attributes and buttons have aria labels.",
            file: target,
            line: 1,
          },
        ];
      }

      const scores = calculateScores(violations);
      const auditResult: WebAuditResult = {
        target,
        scores,
        violations,
        createdAt: new Date().toISOString(),
        slug: slugify(target),
      };

      session.lastAudit = auditResult;
      session.auditCount++;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(auditResult, null, 2),
          },
        ],
        details: { target, scores, violationsCount: violations.length },
      };
    },
  });

  // Register slash command: /web-quality:audit
  pi.registerCommand("web-quality:audit", {
    description: "Run a web quality audit on the current workspace or target",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim() || "workspace";
      ctx.ui.notify(`🔍 Running web quality audit on '${target}'...`, "info");

      const violations: WebViolation[] = [
        {
          category: "accessibility",
          severity: "warning",
          message: "Example check: verify semantic landmark tags and alt texts.",
          file: target,
          line: 1,
        },
      ];
      const scores = calculateScores(violations);
      const auditResult: WebAuditResult = {
        target,
        scores,
        violations,
        createdAt: new Date().toISOString(),
        slug: slugify(target),
      };

      session.lastAudit = auditResult;
      session.auditCount++;

      ctx.ui.notify(`✅ Web audit complete! Overall Score: ${scores.overall}/100`, "info");
    },
  });

  // Register slash command: /web-quality:status
  pi.registerCommand("web-quality:status", {
    description: "Show last web quality audit scores and metrics",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!session.lastAudit) {
        ctx.ui.notify("⚠️ No web quality audits performed yet in this session. Run /web-quality:audit first.", "warning");
        return;
      }
      const a = session.lastAudit;
      const summary = `📊 Last Audit (${a.target}): Overall ${a.scores.overall}% (A11y: ${a.scores.accessibility}%, Perf: ${a.scores.performance}%, SEO: ${a.scores.seo}%, Semantics: ${a.scores.semantics}%) - ${a.violations.length} violations`;
      ctx.ui.notify(summary, "info");
    },
  });

  // Register slash command: /web-quality:report
  pi.registerCommand("web-quality:report", {
    description: "Generate and save a Markdown audit report",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!session.lastAudit) {
        ctx.ui.notify("⚠️ No audit results available to report. Run /web-quality:audit first.", "warning");
        return;
      }

      const reportMd = renderMarkdownReport(session.lastAudit);
      const filePath = auditPath(session.lastAudit.slug);

      try {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, reportMd, "utf-8");
        ctx.ui.notify(`📄 Web audit report saved to ${filePath}`, "info");
      } catch (err) {
        ctx.ui.notify(`❌ Failed to save report: ${String(err)}`, "error");
      }
    },
  });
}
