/**
 * Workspace File Compressor
 *
 * Scans workspace .md files (SOUL.md, USER.md, AGENTS.md, MEMORY.md, etc.)
 * and applies AI-efficient notation patterns to reduce token count.
 * All changes are presented as suggestions — never auto-mutates files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Types ──────────────────────────────────────────────────────────

export interface CompressedFile {
  filename: string;
  originalContent: string;
  compressedContent: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  percentageSaved: number;
}

export interface CompressResult {
  files: CompressedFile[];
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  totalTokensSaved: number;
}

// ── Token Estimation ──────────────────────────────────────────────

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.round(text.length / 4);
}

// ── Compression Patterns ──────────────────────────────────────────

/**
 * Generic compression patterns applicable to any .md file.
 * Ordered from most aggressive to least aggressive.
 */
const GENERIC_PATTERNS: Array<{ from: RegExp; to: string | ((match: string, ...groups: string[]) => string) }> = [
  // Collapse 3+ blank lines to 2
  { from: /\n{3,}/g, to: '\n\n' },

  // Compress verbose "When X happens, you should Y" → "X → Y"
  {
    from: /[Ww]hen\s+(.+?),\s*(?:I\s+)?(?:should|will|must|need to|always)\s+(.+?)(?:\.|$)/gm,
    to: (_, trigger: string, action: string) => {
      const cleanTrigger = trigger.replace(/\s+/g, ' ').trim();
      const cleanAction = action.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
      return `${cleanTrigger} → ${cleanAction}`;
    },
  },

  // Compress "If X, then Y" → "X ? Y"
  {
    from: /[Ii]f\s+(.+?),\s*(?:then\s+)?(.+?)(?:\.|$)/gm,
    to: (_, condition: string, result: string) => {
      const c = condition.replace(/\s+/g, ' ').trim();
      const r = result.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
      // Avoid breaking already-compressed or code content
      if (c.includes('?') || c.includes('→') || r.includes('?')) return _;
      return `${c} ? ${r}`;
    },
  },

  // Remove filler phrasing: "I prefer to", "I like to", "I tend to"
  { from: /\bI (?:prefer to|like to|tend to|usually|typically|generally|always try to)\s+/gi, to: '' },

  // Remove filler: "It is important to", "Make sure to", "Remember to"
  { from: /\b(?:It is important to|Make sure to|Remember to|Don't forget to|Be sure to)\s+/gi, to: '' },

  // "as well as" → "&"
  { from: /\bas well as\b/gi, to: '&' },

  // "in order to" → "to"
  { from: /\bin order to\b/gi, to: 'to' },

  // "a lot of" / "a number of" → "many"
  { from: /\ba (?:lot|number) of\b/gi, to: 'many' },

  // "due to the fact that" → "because"
  { from: /\bdue to the fact that\b/gi, to: 'because' },

  // "for the purpose of" → "for"
  { from: /\bfor the purpose of\b/gi, to: 'for' },

  // "in the event that" → "if"
  { from: /\bin the event that\b/gi, to: 'if' },

  // "at the present time" → "now"
  { from: /\bat the (?:present|current) time\b/gi, to: 'now' },

  // "in the near future" → "soon"
  { from: /\bin the near future\b/gi, to: 'soon' },

  // "on a regular basis" → "regularly"
  { from: /\bon a regular basis\b/gi, to: 'regularly' },

  // "with regard to" / "in regard to" → "about"
  { from: /\b(?:with|in) regard to\b/gi, to: 'about' },

  // "the majority of" → "most"
  { from: /\bthe majority of\b/gi, to: 'most' },

  // "a large number of" → "many"
  { from: /\ba large number of\b/gi, to: 'many' },

  // Collapse "one of the most" → "among the most"
  { from: /\bone of the most\b/gi, to: 'among the most' },

  // Remove redundant "please"
  { from: /\b[Pp]lease\s+(?:note that\s+)?/g, to: '' },

  // Compress "should be able to" → "can"
  { from: /\bshould be able to\b/gi, to: 'can' },

  // Compress "is able to" → "can"
  { from: /\bis able to\b/gi, to: 'can' },

  // Compress "is going to" → "will"
  { from: /\bis going to\b/gi, to: 'will' },

  // Compress "in a way that" → "so"
  { from: /\bin a way that\b/gi, to: 'so' },

  // Compress "a wide variety of" → "various"
  { from: /\ba wide variety of\b/gi, to: 'various' },

  // Compress "- " bullet prefix to "• " for visual compactness
  { from: /^(\s*)-\s+/gm, to: '$1• ' },

  // Remove trailing whitespace
  { from: /[ \t]+$/gm, to: '' },
];

/**
 * File-type specific patterns.
 */
const FILE_SPECIFIC_PATTERNS: Record<string, Array<{ from: RegExp; to: string | ((m: string, ...g: string[]) => string) }>> = {
  // AGENTS.md / CLAUDE.md: agent instruction files with procedural content
  AGENTS: [
    // Compress "When you receive X, do Y" → "X → Y"
    {
      from: /When you receive\s+(.+?),\s*(.+?)(?:\.|$)/gm,
      to: '$1 → $2',
    },
    // Compress workflow steps: "1. X 2. Y 3. Z" → "X → Y → Z"
    {
      from: /^(\d+)\.\s+(.+)$/gm,
      to: (_, num: string, text: string) => {
        return `→ ${text.replace(/\s+/g, ' ').trim()}`;
      },
    },
    // Collapse numbered workflow sequences (merge multiple "→" lines into one)
    {
      from: /(→\s+.+)\n(→\s+.+)/g,
      to: '$1 $2',
    },
  ],

  // MEMORY.md: user memory/context files (often the largest)
  MEMORY: [
    // Compress "X prefers Y" → "PREFERS: Y"
    {
      from: /(\w+)\s+(?:prefers|likes|wants|needs)\s+(.+?)(?:\.|$)/gim,
      to: (_, who: string, what: string) => {
        const cleanWhat = what.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
        return `${who.toUpperCase()}: ${cleanWhat}`;
      },
    },
  ],

  // USER.md: user profile files
  USER: [
    // Compress "Name: Something" → keep but compact
    // Compress timezone notation
    {
      from: /\b(America|Europe|Asia|Africa|Australia|Pacific)\/(\w+)(?:\/(\w+))?\b/g,
      to: '$1/$2',
    },
  ],
};

// ── Compression Logic ─────────────────────────────────────────────

/**
 * Detect file category for type-specific compression.
 */
function detectCategory(filename: string): string | null {
  const upper = filename.toUpperCase();
  if (upper.includes('AGENT') || upper.includes('CLAUDE')) return 'AGENTS';
  if (upper.includes('MEMORY') || upper.includes('SOUL') || upper.includes('CONTEXT')) return 'MEMORY';
  if (upper.includes('USER') || upper.includes('PROFILE') || upper.includes('IDENTITY')) return 'USER';
  return null;
}

/**
 * Apply compression patterns to content.
 */
export function compressContent(content: string, filename: string): string {
  let compressed = content;

  // Apply file-type specific patterns first
  const category = detectCategory(filename);
  if (category && FILE_SPECIFIC_PATTERNS[category]) {
    for (const pattern of FILE_SPECIFIC_PATTERNS[category]) {
      compressed = compressed.replace(pattern.from, pattern.to as string);
    }
  }

  // Apply generic patterns
  for (const pattern of GENERIC_PATTERNS) {
    compressed = compressed.replace(pattern.from, pattern.to as string);
  }

  return compressed;
}

/**
 * Compress a single file. Returns null if no savings.
 */
export function compressFile(filePath: string): CompressedFile | null {
  const filename = path.basename(filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  if (content.trim().length === 0) return null;

  const originalTokens = estimateTokens(content);
  const compressedContent = compressContent(content, filename);
  const compressedTokens = estimateTokens(compressedContent);

  if (compressedTokens >= originalTokens) return null;

  return {
    filename,
    originalContent: content,
    compressedContent,
    originalTokens,
    compressedTokens,
    tokensSaved: originalTokens - compressedTokens,
    percentageSaved: Math.round(((originalTokens - compressedTokens) / originalTokens) * 100),
  };
}

// ── Workspace Scanning ────────────────────────────────────────────

/**
 * Discover all .md files in a workspace directory.
 */
export function discoverWorkspaceFiles(workspacePath: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(workspacePath);
    const knownFiles = new Set([
      'AGENTS.md', 'CLAUDE.md', 'MEMORY.md', 'SOUL.md',
      'USER.md', 'IDENTITY.md', 'PROJECTS.md', 'HEARTBEAT.md',
      'TOOLS.md', 'README.md',
    ]);

    for (const entry of entries) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      if (entry.endsWith('.backup')) continue;

      const fp = path.join(workspacePath, entry);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile()) {
          // Prioritize known context files first, then others
          if (knownFiles.has(entry)) {
            files.unshift(fp);
          } else {
            files.push(fp);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory not readable
  }
  return files;
}

/**
 * Scan a workspace and return compression results for all .md files.
 */
export function compressWorkspace(workspacePath: string): CompressResult {
  const filePaths = discoverWorkspaceFiles(workspacePath);
  const files: CompressedFile[] = [];

  for (const filePath of filePaths) {
    const result = compressFile(filePath);
    if (result) files.push(result);
  }

  // Sort: largest savings first
  files.sort((a, b) => b.tokensSaved - a.tokensSaved);

  const totalOriginalTokens = files.reduce((sum, f) => sum + f.originalTokens, 0);
  const totalCompressedTokens = files.reduce((sum, f) => sum + f.compressedTokens, 0);

  return {
    files,
    totalOriginalTokens,
    totalCompressedTokens,
    totalTokensSaved: totalOriginalTokens - totalCompressedTokens,
  };
}

/**
 * Generate a summary text from compression results.
 */
export function formatCompressReport(result: CompressResult, workspacePath: string): string {
  if (result.files.length === 0) {
    return '📁 **Token Saver — Workspace Compression**\n\nNo compressible .md files found in workspace.\n\n> Tip: AGENTS.md, MEMORY.md, SOUL.md, and USER.md files are sent with every prompt.\n> Compressing them reduces costs on every single API call.';
  }

  const lines: string[] = [
    `📁 **Token Saver — Workspace Compression**`,
    '',
    `Workspace: \`${workspacePath}\``,
    `Files analyzed: ${result.files.length}`,
    `Total tokens: ${result.totalOriginalTokens.toLocaleString()} → ${result.totalCompressedTokens.toLocaleString()} (${Math.round((result.totalTokensSaved / result.totalOriginalTokens) * 100)}% possible saving)`,
    '',
    '---',
    '',
    '### File Breakdown',
    '',
  ];

  for (const file of result.files) {
    const icon = file.percentageSaved >= 70 ? '🔴' : file.percentageSaved >= 40 ? '🟡' : '🟢';
    lines.push(
      `${icon} **${file.filename}:** ${file.originalTokens.toLocaleString()} → ${file.compressedTokens.toLocaleString()} tokens (${file.percentageSaved}% possible saving)`,
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Top Savings Preview');
  lines.push('');

  // Show before/after for top 3 files
  for (const file of result.files.slice(0, 3)) {
    const beforePreview = file.originalContent.slice(0, 200).replace(/\n/g, ' ');
    const afterPreview = file.compressedContent.slice(0, 200).replace(/\n/g, ' ');
    lines.push(`**${file.filename}**`);
    lines.push(`> Before: ${beforePreview}${file.originalContent.length > 200 ? '...' : ''}`);
    lines.push(`> After:  ${afterPreview}${file.compressedContent.length > 200 ? '...' : ''}`);
    lines.push('');
  }

  lines.push('> 💡 These are *possible* savings. To apply compression, use `/token-saver:compress apply`.');
  lines.push('> Always review compressed content before replacing originals.');

  return lines.join('\n');
}
