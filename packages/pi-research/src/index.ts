/**
 * Subject research and reference document generator.
 *
 * Given a topic, runs a structured research loop (Planner → Researcher → Writer)
 * and produces a self-contained Markdown document with overview, key findings,
 * references, and recommended next directions.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { footerRegistry } from "@victorhg/pi-footer/registry";

// ── Research document structure ──────────────────────────────────────────────

export interface ResearchDocument {
  topic: string;
  slug: string;
  subQuestions: string[];
  sources: SourceEntry[];
  sections: {
    overview: string;
    keyConcepts: string;
    findings: string[];
    directions: string;
  };
  createdAt: string;
  path: string;
}

export interface SourceEntry {
  url: string;
  title: string;
  credibility: "high" | "medium" | "low";
  relevanceScore: number; // 0-100
}

// ── Phase enum ───────────────────────────────────────────────────────────────

export type ResearchPhase =
  | "idle"
  | "planning"
  | "researching"
  | "writing"
  | "complete";

// ── Session-scoped runtime state ──────────────────────────────────────────────

export interface ResearchSessionState {
  ctx: ExtensionContext | undefined;
  activeDoc: ResearchDocument | null;
  phase: ResearchPhase;
  sources: SourceEntry[];
  subQuestions: string[];
}

export function makeCleanSession(): ResearchSessionState {
  return {
    ctx: undefined,
    activeDoc: null,
    phase: "idle",
    sources: [],
    subQuestions: [],
  };
}

let session: ResearchSessionState = makeCleanSession();

function resetSession(ctx?: ExtensionContext): void {
  session = makeCleanSession();
  if (ctx) session.ctx = ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a URL-safe slug from a topic string. */
export function slugify(topic: string): string {
  return (
    topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "research"
  );
}

/** Generate the output path for a research document. */
export function researchPath(slug: string): string {
  return `research/${slug}.md`;
}

/** Write the final Markdown document from a ResearchDocument. */
export function renderDocument(doc: ResearchDocument): string {
  const lines: string[] = [
    `# ${doc.topic}`,
    "",
    `> **Generated:** ${doc.createdAt}`,
    `> **Phase:** ${session.phase}`,
    "",
    "## Overview",
    "",
    doc.sections.overview,
    "",
    "## Key Concepts",
    "",
    doc.sections.keyConcepts,
    "",
    "## Findings",
    "",
  ];

  for (let i = 0; i < doc.subQuestions.length; i++) {
    lines.push(`### ${i + 1}. ${doc.subQuestions[i]}`);
    lines.push("");
    if (doc.sections.findings[i]) {
      lines.push(doc.sections.findings[i]);
      lines.push("");
    }
  }

  lines.push("## References");
  lines.push("");
  for (let i = 0; i < doc.sources.length; i++) {
    const src = doc.sources[i];
    lines.push(
      `${i + 1}. ${src.title} — [${src.url}](${src.url}) (accessed ${new Date().toLocaleDateString()}) [${src.credibility}]`,
    );
  }

  if (doc.sources.length === 0) {
    lines.push("_No sources collected yet._");
  }

  lines.push("");
  lines.push("## Directions");
  lines.push("");
  lines.push(doc.sections.directions);
  lines.push("");

  return lines.join("\n");
}

// ── Credibility scoring helpers ───────────────────────────────────────────────

/** Score a URL for source credibility (0-100). */
export function scoreSourceCredibility(url: string): number {
  const domain = url.split("/")[2] || "";

  const highCredDomains = [
    "github.com",
    "arxiv.org",
    "wikipedia.org",
    "scholar.google.com",
    "ieee.org",
    "acm.org",
    "medium.com",
    "stackoverflow.com",
    "docs.",
    "developer.mozilla.org",
  ];

  for (const d of highCredDomains) {
    if (domain.includes(d)) return 90;
  }

  const mediumCredDomains = [
    "wordpress.com",
    "blogger.com",
    "quora.com",
    "reddit.com",
  ];

  for (const d of mediumCredDomains) {
    if (domain.includes(d)) return 60;
  }

  return 40;
}

/** Assign credibility label based on score. */
export function credibilityLabel(score: number): SourceEntry["credibility"] {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

// ── Footer badge integration ──────────────────────────────────────────────────

function initFooterBadge(): void {
  try {
    footerRegistry.register("research", () => {
      if (session.phase === "idle" || session.phase === "complete") {
        return undefined;
      }
      const phaseLabels: Record<ResearchPhase, string> = {
        idle: "",
        planning: "🔬 planning…",
        researching: "🔬 searching…",
        writing: "🔬 writing…",
        complete: "🔬 done",
      };
      return phaseLabels[session.phase] || undefined;
    });
  } catch {
    // Silently ignore if @victorhg/pi-footer is not installed
  }
}

// ── Build research prompt ─────────────────────────────────────────────────────

function buildResearchPrompt(topic: string, path: string): string {
  return `RESEARCH TASK — "${topic}"

You are now in research mode. Execute this structured loop:

### Phase 1: Planning
Decompose "${topic}" into 3-5 focused sub-questions that cover different angles (definition, comparisons, use cases, trade-offs, alternatives).

### Phase 2: Research
For each sub-question:
- Use \`web_search\` to find relevant sources
- Use \`fetch_content\` to read the most promising ones
- Score each source for credibility (high/medium/low) and relevance (0-100)

### Phase 3: Writing
Synthesize findings into a structured Markdown document with:
- **Overview** — concise description of the subject
- **Key Concepts** — definitions and relationships
- **Findings** — answers to each sub-question with inline citations [^1]
- **References** — numbered list with URL, title, credibility, and access date
- **Directions** — open questions and recommended next steps

Save the document to: \`${path}\``;
}

// ── Extension Activation ──────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {
  initFooterBadge();

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    resetSession(ctx);
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // ── Command: /research ───────────────────────────────────────────────────
  // Opens a multi-line editor dialog for the user to describe their research,
  // then injects the structured research prompt to kick off the agent loop.
  pi.registerCommand("research", {
    description: "Open a dialog to describe your research topic, then run a structured research loop producing a citable Markdown document",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.isIdle()) {
        ctx.ui.notify("⚠️ Agent is busy. Wait for it to finish before starting research.", "warning");
        return;
      }

      const description = await ctx.ui.editor(
        "What do you want to research?",
        "",
      );

      if (!description || !description.trim()) {
        ctx.ui.notify("Research cancelled — no topic provided.", "warning");
        return;
      }

      const topic = description.trim();
      const slug = slugify(topic.split("\n")[0]); // slug from first line
      const path = researchPath(slug);
      const now = new Date().toISOString();

      session.phase = "planning";
      session.subQuestions = [];
      session.sources = [];
      session.activeDoc = {
        topic,
        slug,
        subQuestions: [],
        sources: [],
        sections: { overview: "", keyConcepts: "", findings: [], directions: "" },
        createdAt: now,
        path,
      };

      ctx.ui.notify(`🔬 Research starting — output: ${path}`, "info");

      pi.sendUserMessage(buildResearchPrompt(topic, path));
    },
  });

  // ── Command: /research:start <topic> ────────────────────────────────────
  // Direct command for when the topic is known upfront (e.g. scripting).
  pi.registerCommand("research:start", {
    description: "Start a research run for a given topic (inline topic, no dialog)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const topic = args.trim();
      if (!topic) {
        ctx.ui.notify("❌ Usage: /research:start <topic>", "error");
        return;
      }

      if (!ctx.isIdle()) {
        ctx.ui.notify("⚠️ Agent is busy. Wait for it to finish before starting research.", "warning");
        return;
      }

      const slug = slugify(topic);
      const path = researchPath(slug);
      const now = new Date().toISOString();

      session.phase = "planning";
      session.subQuestions = [];
      session.sources = [];
      session.activeDoc = {
        topic,
        slug,
        subQuestions: [],
        sources: [],
        sections: { overview: "", keyConcepts: "", findings: [], directions: "" },
        createdAt: now,
        path,
      };

      ctx.ui.notify(`🔬 Research starting — output: ${path}`, "info");

      pi.sendUserMessage(buildResearchPrompt(topic, path));
    },
  });

  // ── Command: /research:status ────────────────────────────────────────────
  pi.registerCommand("research:status", {
    description: "Show current research phase, topic, sub-questions, and sources collected",
    handler: async (_args: string, _ctx: ExtensionCommandContext) => {
      const doc = session.activeDoc;

      if (!doc || session.phase === "idle") {
        session.ctx?.ui.notify("No active research session. Use `/research` to begin.", "info");
        return;
      }

      const lines = [
        `🔬 Research Status: "${doc.topic}"`,
        `  Phase: ${session.phase}`,
        `  Output: ${doc.path}`,
        `  Created: ${doc.createdAt}`,
        `  Sub-questions: ${doc.subQuestions.length}`,
        `  Sources collected: ${doc.sources.length}`,
      ];

      if (doc.subQuestions.length > 0) {
        lines.push("  Questions:");
        doc.subQuestions.forEach((q, i) => lines.push(`    ${i + 1}. ${q}`));
      }

      if (doc.sources.length > 0) {
        lines.push("  Top sources:");
        doc.sources
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 5)
          .forEach((src) =>
            lines.push(`    - ${src.title} [${src.credibility}] (${src.relevanceScore})`),
          );
      }

      session.ctx?.ui.notify(lines.join("\n"), "info");
    },
  });

  // ── Command: /research:list ──────────────────────────────────────────────
  pi.registerCommand("research:list", {
    description: "List all saved research documents",
    handler: async (_args: string, _ctx: ExtensionCommandContext) => {
      const fs = await import("fs");
      try {
        const files = fs.readdirSync("research").filter((f: string) => f.endsWith(".md"));

        if (files.length === 0) {
          session.ctx?.ui.notify("No research documents found. Use `/research` to create one.", "info");
          return;
        }

        const lines = ["📚 Saved Research Documents:"];
        for (const file of files.sort().reverse()) {
          const content = fs.readFileSync(`research/${file}`, "utf-8");
          const titleMatch = content.match(/^# (.+)$/m);
          const title = titleMatch ? titleMatch[1] : file.replace(".md", "");
          const dateMatch = content.match(/Generated: (\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : "unknown";
          lines.push(`  - ${title} (${date}) — ${file}`);
        }

        session.ctx?.ui.notify(lines.join("\n"), "info");
      } catch {
        session.ctx?.ui.notify("No research directory found. Use `/research` to create one.", "info");
      }
    },
  });
}
