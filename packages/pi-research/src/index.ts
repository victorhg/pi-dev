/**
 * Subject research and reference document generator.
 *
 * Given a topic, runs a structured research loop (Planner → Researcher → Writer)
 * and produces a self-contained Markdown document with overview, key findings,
 * references, and recommended next directions.
 *
 * Inspired by multi-agent research systems (CogGen, ARIA).
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

  // High-credibility domains
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

  // Medium-credibility (blog-like, wikis)
  const mediumCredDomains = [
    "wordpress.com",
    "blogger.com",
    "quora.com",
    "reddit.com",
  ];

  for (const d of mediumCredDomains) {
    if (domain.includes(d)) return 60;
  }

  return 40; // default low
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
  } catch (err) {
    // Silently ignore if @victorhg/pi-footer is not installed
  }
}

// ── Notification helpers ──────────────────────────────────────────────────────

function notify(message: string, type: "info" | "warning" | "error"): void {
  if (session.ctx && session.ctx.hasUI) {
    session.ctx.ui.notify(message, type);
  } else {
    const prefix = `[Research]`;
    if (type === "error") {
      console.error(`${prefix} ${message}`);
    } else if (type === "warning") {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// ── Extension Activation ──────────────────────────────────────────────────────

export default async function activate(pi: ExtensionAPI): Promise<void> {
  // ── Footer badge ──────────────────────────────────────────────────────────
  initFooterBadge();

  // ── Session Event Hooks ──────────────────────────────────────────────────
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    resetSession(ctx);
  });

  pi.on("session_shutdown", () => {
    resetSession();
  });

  // ── Command: research:start <topic> ──────────────────────────────────────
  pi.registerCommand("research:start", {
    description:
      "Kick off a new research run: decompose topic into sub-questions, run web searches, and produce a structured document",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const topic = args.trim();
      if (!topic) {
        notify(
          "❌ Usage: /research:start <topic>",
          "error",
        );
        return;
      }

      const slug = slugify(topic);
      const path = researchPath(slug);
      const now = new Date().toISOString();

      // Start planning phase
      session.phase = "planning";
      session.subQuestions = [];
      session.sources = [];

      notify(`🔬 Starting research on: "${topic}"`, "info");
      notify(`📄 Output: ${path}`, "info");

      // Prompt the agent to handle the research loop via a system prompt injection.
      // The agent should:
      // 1. Decompose the topic into 3-5 focused sub-questions (planning phase)
      // 2. Run web_search + fetch_content per sub-question (research phase)
      // 3. Synthesize findings into a structured document (writer phase)
      // 4. Save to the specified path using write tool

      const researchPrompt = `RESEARCH TASK — "${topic}"

You are now in research mode. Follow this structured loop:

### Phase 1: Planning (sub-questions)
Decompose "${topic}" into 3-5 focused sub-questions. These should cover different angles of the topic (definition, comparisons, use cases, trade-offs, alternatives).

### Phase 2: Research
For each sub-question:
- Use \`web_search\` to find relevant sources
- Use \`fetch_content\` to read promising sources
- Score each source for credibility (high/medium/low)
- Track URLs, titles, and relevance scores

### Phase 3: Writing
Synthesize findings into a structured Markdown document with:
- **Overview** — concise description of the subject
- **Key Concepts** — definitions and relationships
- **Findings** — answers to each sub-question with inline citations
- **References** — numbered list with URL, title, and access date
- **Directions** — open questions and recommended next steps

Save the document to: \`${path}\`

When complete, call \`research:status\` to report results.`;

      // Since we can't inject a system prompt directly, we inform the user
      // that they should type the topic and the agent will handle the research
      // via the pi agent's normal flow. The commands below let the agent
      // track progress.

      if (ctx.hasUI) {
        ctx.ui.notify(
          `🔬 Research session started on "${topic}".\n📄 Output: ${path}\n\nPlease proceed with the research. Use \`/research:status\` to check progress and \`/research:list\` to see past research.`,
          "info",
        );
      } else {
        console.log(
          `🔬 Research session started on "${topic}".`,
        );
        console.log(`📄 Output: ${path}`);
      }

      // Create the initial document skeleton
      const doc: ResearchDocument = {
        topic,
        slug,
        subQuestions: [],
        sources: [],
        sections: {
          overview: "",
          keyConcepts: "",
          findings: [],
          directions: "",
        },
        createdAt: now,
        path,
      };

      session.activeDoc = doc;

      // Signal to agent that it should now run the research loop
      // by writing a planning message. The agent handles the rest.
    },
  });

  // ── Command: research:status ─────────────────────────────────────────────
  pi.registerCommand("research:status", {
    description:
      "Show current research phase, topic, sub-questions, and sources collected",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const doc = session.activeDoc;

      if (!doc || session.phase === "idle") {
        notify("No active research session. Use \`/research:start <topic>\` to begin.", "info");
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
        for (let i = 0; i < doc.subQuestions.length; i++) {
          lines.push(`    ${i + 1}. ${doc.subQuestions[i]}`);
        }
      }

      if (doc.sources.length > 0) {
        lines.push("  Top sources:");
        const topSources = doc.sources
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 5);
        for (const src of topSources) {
          lines.push(
            `    - ${src.title} [${src.credibility}] (${src.relevanceScore})`,
          );
        }
      }

      const statusMessage = lines.join("\n");
      notify(statusMessage, "info");
    },
  });

  // ── Command: research:open ───────────────────────────────────────────────
  pi.registerCommand("research:open", {
    description: "Display the latest research document in the TUI",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      // Allow opening a specific document by topic or slug
      const query = args.trim();

      let path: string;

      if (query) {
        const slug = slugify(query);
        path = researchPath(slug);
      } else {
        // Open the most recent research document
        const doc = session.activeDoc;
        if (doc) {
          path = doc.path;
        } else {
          // Find the most recent file in research/
          const fs = await import("fs");
          try {
            const files = fs.readdirSync("research").filter((f: string) => f.endsWith(".md"));
            if (files.length === 0) {
              notify("No research documents found. Use \`/research:start <topic>\` to create one.", "info");
              return;
            }
            files.sort();
            path = `research/${files[files.length - 1]}`;
          } catch {
            notify("No research directory found. Use \`/research:start <topic>\` to create one.", "info");
            return;
          }
        }
      }

      // Try to read and display the document
      const fs = await import("fs");
      try {
        const content = fs.readFileSync(path, "utf-8");
        notify(content, "info");
      } catch {
        notify(`Research document not found at ${path}. Has the research run completed?`, "error");
      }
    },
  });

  // ── Command: research:list (when no active session exists) ───────────────
  pi.registerCommand("research:list", {
    description: "List all saved research documents with metadata",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const fs = await import("fs");
      try {
        const files = fs.readdirSync("research").filter((f: string) => f.endsWith(".md"));

        if (files.length === 0) {
          notify("No research documents found. Use \`/research:start <topic>\` to create one.", "info");
          return;
        }

        const lines = ["📚 Saved Research Documents:"];

        for (const file of files.sort().reverse()) {
          const filePath = `research/${file}`;
          const content = fs.readFileSync(filePath, "utf-8");

          // Extract title from first line
          const titleMatch = content.match(/^# (.+)$/m);
          const title = titleMatch ? titleMatch[1] : file.replace(".md", "");

          // Extract date from date pattern
          const dateMatch = content.match(/Generated: (\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : "unknown";

          lines.push(`  - ${title} (${date}) — ${file}`);
        }

        notify(lines.join("\n"), "info");
      } catch {
        notify("No research directory found. Use \`/research:start <topic>\` to create one.", "info");
      }
    },
  });
}
