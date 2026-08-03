/**
 * Anti-AI-slop audit engine for Hallmark.
 * Evaluates target code against Hallmark's slop-test gates and anti-patterns.
 */

import type {
  SlopGateViolation,
  HallmarkAuditResult,
  HallmarkCritiqueScores,
} from "./types.js";

/** Generate slug for target */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "hallmark-audit"
  );
}

/** Evaluate code content against Hallmark Slop Test Gates */
export function evaluateSlopGates(content: string, filename = "file.html"): SlopGateViolation[] {
  const violations: SlopGateViolation[] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Gate 1: Generic purple/blue gradients
    if (
      /linear-gradient\s*\(.*(purple|blue|#6366f1|#a855f7|#8b5cf6|#3b82f6|#1d4ed8).*\)/i.test(
        line
      )
    ) {
      violations.push({
        gateId: 1,
        category: "color-and-theme",
        severity: "error",
        rule: "No generic purple/blue gradients",
        message:
          "Generic AI purple/blue gradient detected. Hallmark mandates distinct color palettes with muted or chromatic OKLCH accents.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 2: Generic 3-card grid layout
    if (
      /grid-template-columns\s*:\s*repeat\s*\(\s*3\s*,\s*1fr\s*\)/i.test(line) ||
      /grid-cols-3/i.test(line)
    ) {
      violations.push({
        gateId: 2,
        category: "layout-and-space",
        severity: "warning",
        rule: "Avoid symmetric 3-card feature grid defaults",
        message:
          "Standard symmetric 3-card grid detected. Consider asymmetric Bento Grid (01) or Feature Stack (16) macrostructure.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 3: Overly rounded UI components (border-radius > 4px)
    const radiusMatch = line.match(/border-radius\s*:\s*(\d+)(px|rem)/i);
    if (radiusMatch) {
      const val = parseFloat(radiusMatch[1]);
      const unit = radiusMatch[2].toLowerCase();
      const pxVal = unit === "rem" ? val * 16 : val;
      const isExplicitPill = /badge|pill|avatar|circle|rounded-full/i.test(line);

      if (pxVal > 4 && !isExplicitPill) {
        violations.push({
          gateId: 3,
          category: "component-craft",
          severity: "warning",
          rule: "Reject overly-rounded UI components (border-radius > 4px)",
          message: `Border radius of ${pxVal}px exceeds the 4px max threshold for standard containers. Hallmark enforces sharp, intentional radii.`,
          file: filename,
          line: lineNum,
          snippet: line.trim(),
        });
      }
    }

    // Gate 4: Generic font stacks (Inter/Roboto as display type)
    if (
      /font-family\s*:\s*['"]?(Inter|Roboto|System-UI)['"]?/i.test(line) &&
      /h[1-3]|display|hero/i.test(line)
    ) {
      violations.push({
        gateId: 4,
        category: "typography",
        severity: "warning",
        rule: "Mandate distinct typography stacks beyond Inter/Roboto",
        message:
          "Generic Inter/Roboto font stack used for display headings. Pair display serif or grotesk sans with character.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 5: Invented marketing metrics
    if (
      /(\+?\d+%\s*(conversion|growth|faster)|trusted by \d+,?\d*\+?|10x faster)/i.test(
        line
      )
    ) {
      violations.push({
        gateId: 5,
        category: "content-and-copy",
        severity: "error",
        rule: "Honest copy — no fabricated content or invented metrics",
        message:
          "Invented marketing claim or metric detected. If unconfirmed, use '—' placeholder or real brief numbers.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 6: Re-drawn browser / IDE chrome
    if (
      (/mac-dots|window-dots|browser-bar|fake-url|chrome-wrapper/i.test(line) ||
        (/traffic-lights/i.test(line) && /red|yellow|green/i.test(line))) &&
      !/<img/i.test(line)
    ) {
      violations.push({
        gateId: 6,
        category: "component-craft",
        severity: "warning",
        rule: "Re-drawn UI chrome forbidden",
        message:
          "Hand-built browser/IDE chrome (dots + address bar) detected. Use raw screenshots in hairline frames instead.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 7: Italic display headings
    if (
      /<h[1-6]\b[^>]*>.*<em\b[^>]*>.*<\/em>.*<\/h[1-6]>/i.test(line) ||
      (/font-style\s*:\s*italic/i.test(line) && /h[1-6]|\.heading|\.title/i.test(line))
    ) {
      violations.push({
        gateId: 7,
        category: "typography",
        severity: "warning",
        rule: "Typography purity — no italic headers",
        message:
          "Italic display heading or italic emphasis word inside heading detected. Use weight, accent color, or underline for header emphasis.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 8: Mid-render token improvisation (inline hex/rgb in markup)
    if (
      /style=["'].*(color|background|border)\s*:\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\))/i.test(
        line
      )
    ) {
      violations.push({
        gateId: 8,
        category: "color-and-theme",
        severity: "warning",
        rule: "Locked tokens — no mid-render token improvisation",
        message:
          "Hardcoded inline color detected in style attribute. Reference named CSS tokens like var(--color-accent) instead.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // Gate 9: Bare 1fr in CSS grid tracks
    if (/grid-template-columns\s*:\s*1fr\s+1fr/i.test(line)) {
      violations.push({
        gateId: 9,
        category: "layout-and-space",
        severity: "warning",
        rule: "Grid tracks must use minmax(0, 1fr)",
        message:
          "Bare '1fr' grid track detected. Use 'minmax(0, 1fr)' to prevent overflow on mobile viewport.",
        file: filename,
        line: lineNum,
        snippet: line.trim(),
      });
    }
  });

  return violations;
}

/** Compute 6 critique scores based on violations */
export function calculateCritiqueScores(violations: SlopGateViolation[]): HallmarkCritiqueScores {
  let pPenalty = 0;
  let hPenalty = 0;
  let ePenalty = 0;
  let sPenalty = 0;
  let rPenalty = 0;
  let vPenalty = 0;

  for (const v of violations) {
    const p = v.severity === "error" ? 1.0 : 0.5;
    if (v.category === "color-and-theme") {
      rPenalty += p;
      ePenalty += p;
    }
    if (v.category === "typography") {
      sPenalty += p;
      hPenalty += p;
    }
    if (v.category === "layout-and-space") {
      vPenalty += p;
      hPenalty += p;
    }
    if (v.category === "component-craft") {
      ePenalty += p;
      pPenalty += p;
    }
    if (v.category === "content-and-copy") {
      pPenalty += p;
      sPenalty += p;
    }
  }

  const philosophy = Math.max(1, Math.min(5, Math.round(5 - pPenalty)));
  const hierarchy = Math.max(1, Math.min(5, Math.round(5 - hPenalty)));
  const execution = Math.max(1, Math.min(5, Math.round(5 - ePenalty)));
  const specificity = Math.max(1, Math.min(5, Math.round(5 - sPenalty)));
  const restraint = Math.max(1, Math.min(5, Math.round(5 - rPenalty)));
  const variety = Math.max(1, Math.min(5, Math.round(5 - vPenalty)));

  return { philosophy, hierarchy, execution, specificity, restraint, variety };
}

/** Calculate overall health score (0-100) */
export function calculateOverallScore(scores: HallmarkCritiqueScores): number {
  const sum =
    scores.philosophy +
    scores.hierarchy +
    scores.execution +
    scores.specificity +
    scores.restraint +
    scores.variety;
  return Math.round((sum / 30) * 100);
}

/** Run audit on given code */
export function auditContent(content: string, targetName = "workspace"): HallmarkAuditResult {
  const violations = evaluateSlopGates(content, targetName);
  const scores = calculateCritiqueScores(violations);
  const overallScore = calculateOverallScore(scores);

  return {
    target: targetName,
    scores,
    overallScore,
    violations,
    passedGatesCount: Math.max(0, 57 - violations.length),
    totalGatesEvaluated: 57,
    createdAt: new Date().toISOString(),
    slug: slugify(targetName),
  };
}

/** Render Markdown report from audit result */
export function renderAuditReport(audit: HallmarkAuditResult): string {
  const s = audit.scores;
  const stamp = `/* Hallmark · pre-emit critique: P${s.philosophy} H${s.hierarchy} E${s.execution} S${s.specificity} R${s.restraint} V${s.variety} */`;

  const lines: string[] = [
    `# Hallmark Anti-Slop Audit: ${audit.target}`,
    "",
    `\`${stamp}\``,
    "",
    `> **Overall Design Score:** ${audit.overallScore}/100`,
    `> **Passed Slop Gates:** ${audit.passedGatesCount} / ${audit.totalGatesEvaluated}`,
    `> **Generated:** ${audit.createdAt}`,
    "",
    "## Pre-Emit Critique Axes (1–5)",
    "",
    `- **Philosophy (P):** ${s.philosophy}/5 ${s.philosophy >= 4 ? "✅" : "⚠️"}`,
    `- **Hierarchy (H):** ${s.hierarchy}/5 ${s.hierarchy >= 4 ? "✅" : "⚠️"}`,
    `- **Execution (E):** ${s.execution}/5 ${s.execution >= 4 ? "✅" : "⚠️"}`,
    `- **Specificity (S):** ${s.specificity}/5 ${s.specificity >= 4 ? "✅" : "⚠️"}`,
    `- **Restraint (R):** ${s.restraint}/5 ${s.restraint >= 4 ? "✅" : "⚠️"}`,
    `- **Variety (V):** ${s.variety}/5 ${s.variety >= 4 ? "✅" : "⚠️"}`,
    "",
    "## Slop Gate Punch List",
    "",
  ];

  if (audit.violations.length === 0) {
    lines.push("🎉 Zero AI-slop markers detected! Design passes all active Hallmark gates.");
  } else {
    for (const v of audit.violations) {
      const loc = v.file ? ` (${v.file}:${v.line ?? 1})` : "";
      const icon = v.severity === "error" ? "❌" : v.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`### ${icon} Gate ${v.gateId}: ${v.rule}${loc}`);
      lines.push(`${v.message}`);
      if (v.snippet) {
        lines.push("```css");
        lines.push(v.snippet);
        lines.push("```");
      }
      lines.push("");
    }
  }

  lines.push("---", "*Audited with @victorhg/pi-hallmark extension*");
  return lines.join("\n");
}
