export interface FilterResult {
  filtered: string;
  rawChars: number;
  filteredChars: number;
}

export interface Filter {
  name: string;
  matches: (command: string) => boolean;
  apply: (command: string, output: string) => FilterResult;
}

// ── Strip ANSI Helper ─────────────────────────────────────────────
export const stripAnsiText = (text: string): string => {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
             .replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, ''); // Hyperlinks
};

// ── Generic Fallback Line Truncator ──────────────────────────────
export const truncateLinesAt = (maxLines: number) => {
  return (output: string): string => {
    const lines = output.split('\n');
    if (lines.length <= maxLines) return output;
    return [...lines.slice(0, maxLines), `... truncated (${lines.length - maxLines} lines omitted)`].join('\n');
  };
};

// ── 1. Smart Git Status Filter ────────────────────────────────────
export function createGitStatusFilter(): Filter {
  const RE_BRANCH = /^On branch (.+)$/m;
  const RE_DETACHED = /^HEAD detached at (.+)$/m;
  const RE_UP_TO_DATE = /up to date/;
  const RE_AHEAD = /ahead of '.+?' by (\d+) commit/;
  const RE_BEHIND = /behind '.+?' by (\d+) commit/;
  const RE_DIVERGED = /have (\d+) and (\d+) different commits/;
  const RE_FATAL = /^fatal:/m;

  return {
    name: "git-status",
    matches: (command: string) => /^git\s+status\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      if (RE_FATAL.test(raw)) {
        return { filtered: raw, rawChars, filteredChars: rawChars };
      }

      const lines = raw.split("\n");
      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];
      const deleted: string[] = [];
      const conflicts: string[] = [];

      let branchName = "unknown";
      const branchMatch = raw.match(RE_BRANCH);
      const detachedMatch = raw.match(RE_DETACHED);

      if (detachedMatch) {
        branchName = `HEAD@${detachedMatch[1]}`;
      } else if (branchMatch) {
        branchName = branchMatch[1];
      }

      const trackingParts: string[] = [];
      if (RE_UP_TO_DATE.test(raw)) {
        trackingParts.push("up to date");
      } else {
        const divergedMatch = raw.match(RE_DIVERGED);
        if (divergedMatch) {
          trackingParts.push(`ahead ${divergedMatch[1]}`);
          trackingParts.push(`behind ${divergedMatch[2]}`);
        } else {
          const aheadMatch = raw.match(RE_AHEAD);
          if (aheadMatch) trackingParts.push(`ahead ${aheadMatch[1]}`);
          const behindMatch = raw.match(RE_BEHIND);
          if (behindMatch) trackingParts.push(`behind ${behindMatch[1]}`);
        }
      }

      const tracking = trackingParts.join(", ");
      const header = tracking ? `📌 ${branchName} (${tracking})` : `📌 ${branchName}`;

      let section = 'none';
      for (const line of lines) {
        if (line.includes("Changes to be committed")) {
          section = 'staged';
          continue;
        }
        if (line.includes("Changes not staged for commit")) {
          section = 'unstaged';
          continue;
        }
        if (line.includes("Untracked files")) {
          section = 'untracked';
          continue;
        }
        if (line.includes("Unmerged paths")) {
          section = 'unmerged';
          continue;
        }

        if (/^\s+\(use /.test(line)) continue;
        if (line.trim() === "") continue;

        if (section === 'unmerged') {
          const match = line.match(/^\t(?:both modified|both added|both deleted|added by us|added by them|deleted by us|deleted by them):\s+(.+)$/);
          if (match) {
            conflicts.push(match[1].trim());
            continue;
          }
        }

        const fileMatch = line.match(/^\t(modified|new file|deleted|renamed|copied|typechange):\s+(.+)$/);
        if (fileMatch) {
          const status = fileMatch[1];
          const file = fileMatch[2].trim();
          if (section === 'staged') {
            if (status === 'deleted') deleted.push(file);
            else staged.push(file);
          } else if (section === 'unstaged') {
            if (status === 'deleted') deleted.push(file);
            else modified.push(file);
          }
          continue;
        }

        if (section === 'untracked') {
          const untrackedMatch = line.match(/^\t([^\s].*)$/);
          if (untrackedMatch) {
            untracked.push(untrackedMatch[1].trim());
          }
        }
      }

      const formatFiles = (files: string[]) => {
        if (files.length <= 10) return files.join('  ');
        return `${files.slice(0, 10).join('  ')}  ... +${files.length - 10} more`;
      };

      const outputLines = [header];
      if (conflicts.length > 0) {
        outputLines.push(`⚠️ Conflicts: ${conflicts.length} files`, `   ${formatFiles(conflicts)}`);
      }
      if (staged.length > 0) {
        outputLines.push(`✅ Staged: ${staged.length} files`, `   ${formatFiles(staged)}`);
      }
      if (modified.length > 0) {
        outputLines.push(`📝 Modified: ${modified.length} files`, `   ${formatFiles(modified)}`);
      }
      if (deleted.length > 0) {
        outputLines.push(`🗑️ Deleted: ${deleted.length} files`, `   ${formatFiles(deleted)}`);
      }
      if (untracked.length > 0) {
        outputLines.push(`❓ Untracked: ${untracked.length} files`, `   ${formatFiles(untracked)}`);
      }

      if (outputLines.length === 1) {
        outputLines.push("nothing to commit, working tree clean");
      }

      const filtered = outputLines.join("\n");
      return { filtered, rawChars, filteredChars: filtered.length };
    }
  };
}

// ── 2. Smart Git Diff Filter ──────────────────────────────────────
interface FileDiff {
  file: string;
  isBinary: boolean;
  hunks: Array<{ startLine: number; lines: string[] }>;
  insertions: number;
  deletions: number;
}

export function createGitDiffFilter(): Filter {
  const RE_DIFF_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
  const RE_HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  const RE_BINARY = /^Binary files .+ and .+ differ$/;

  const parseDiff = (raw: string): FileDiff[] => {
    const files: FileDiff[] = [];
    let current: FileDiff | null = null;
    let currentHunk: { startLine: number; lines: string[] } | null = null;

    const lines = raw.split("\n");
    for (const line of lines) {
      const diffMatch = line.match(RE_DIFF_HEADER);
      if (diffMatch) {
        if (currentHunk && current) {
          current.hunks.push(currentHunk);
          currentHunk = null;
        }
        current = {
          file: diffMatch[2],
          isBinary: false,
          hunks: [],
          insertions: 0,
          deletions: 0,
        };
        files.push(current);
        continue;
      }

      if (!current) continue;

      if (RE_BINARY.test(line)) {
        current.isBinary = true;
        continue;
      }

      if (
        line.startsWith("index ") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("old mode ") ||
        line.startsWith("new mode ") ||
        line.startsWith("similarity index ") ||
        line.startsWith("rename ") ||
        line.startsWith("new file mode ") ||
        line.startsWith("deleted file mode ")
      ) {
        continue;
      }

      const hunkMatch = line.match(RE_HUNK_HEADER);
      if (hunkMatch) {
        if (currentHunk) current.hunks.push(currentHunk);
        currentHunk = {
          startLine: parseInt(hunkMatch[2], 10),
          lines: [],
        };
        continue;
      }

      if (currentHunk) {
        if (line.startsWith("+")) {
          current.insertions++;
          currentHunk.lines.push(line);
        } else if (line.startsWith("-")) {
          current.deletions++;
          currentHunk.lines.push(line);
        } else if (line.startsWith(" ") || line.startsWith("\\")) {
          currentHunk.lines.push(line);
        }
      }
    }

    if (currentHunk && current) {
      current.hunks.push(currentHunk);
    }
    return files;
  };

  const reduceContext = (lines: string[]): string[] => {
    const isChange = (l: string) => l.startsWith("+") || l.startsWith("-") || l.startsWith("\\");
    const keep = new Array<boolean>(lines.length).fill(false);

    for (let i = 0; i < lines.length; i++) {
      if (isChange(lines[i])) {
        keep[i] = true;
        if (i > 0 && lines[i - 1].startsWith(" ")) keep[i - 1] = true;
        if (i + 1 < lines.length && lines[i + 1].startsWith(" ")) keep[i + 1] = true;
      }
    }
    return lines.filter((_, i) => keep[i]);
  };

  return {
    name: "git-diff",
    matches: (command: string) => /^git\s+diff\b/.test(command) && !/^git\s+difftool\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      if (!raw.trim()) {
        return { filtered: "No changes", rawChars, filteredChars: 10 };
      }

      const files = parseDiff(raw);
      if (files.length === 0) {
        return { filtered: raw, rawChars, filteredChars: rawChars };
      }

      const output: string[] = [];
      for (const fd of files) {
        const total = fd.insertions + fd.deletions;
        if (fd.isBinary) {
          output.push(`${fd.file} | Binary`);
        } else {
          output.push(`${fd.file} | ${total} ${"+".repeat(Math.min(fd.insertions, 10))}${"-".repeat(Math.min(fd.deletions, 10))}`);
        }
      }
      output.push("");

      for (const fd of files) {
        if (fd.isBinary) continue;
        for (const hunk of fd.hunks) {
          output.push(`@@ ${fd.file}:${hunk.startLine} @@`);
          const reduced = reduceContext(hunk.lines);
          if (reduced.length > 20) {
            output.push(...reduced.slice(0, 10), `... ${reduced.length - 10} more lines`);
          } else {
            output.push(...reduced);
          }
        }
      }

      const totalFiles = files.length;
      const totalIns = files.reduce((s, f) => s + f.insertions, 0);
      const totalDel = files.reduce((s, f) => s + f.deletions, 0);
      output.push("", `${totalFiles} file${totalFiles === 1 ? '' : 's'} changed, ${totalIns} insertions(+), ${totalDel} deletions(-)`);

      const filtered = output.join("\n");
      return { filtered, rawChars, filteredChars: filtered.length };
    }
  };
}

// ── 3. Smart Git Log Filter ───────────────────────────────────────
export function createGitLogFilter(): Filter {
  return {
    name: "git-log",
    matches: (command: string) => /^git\s+log\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      const lines = raw.split("\n");
      const entries: string[] = [];

      let currentHash = "";
      for (const line of lines) {
        const commitMatch = line.match(/^commit\s+([0-9a-f]{7,40})/);
        if (commitMatch) {
          currentHash = commitMatch[1].slice(0, 7);
          continue;
        }

        if (currentHash) {
          if (line.startsWith("Author:") || line.startsWith("Date:") || line.startsWith("Merge:") || line.trim() === "") {
            continue;
          }
          const subject = line.trim();
          if (subject) {
            const truncated = subject.length > 80 ? subject.slice(0, 80) + "..." : subject;
            entries.push(`${currentHash} ${truncated}`);
            currentHash = "";
          }
        } else {
          const onelineMatch = line.match(/^([0-9a-f]{7,12})\s+(.+)/);
          if (onelineMatch) {
            const subject = onelineMatch[2].trim();
            const truncated = subject.length > 80 ? subject.slice(0, 80) + "..." : subject;
            entries.push(`${onelineMatch[1].slice(0, 7)} ${truncated}`);
          }
        }
      }

      if (entries.length === 0) {
        return { filtered: raw, rawChars, filteredChars: rawChars };
      }

      const maxCommits = 20;
      const shown = entries.slice(0, maxCommits);
      if (entries.length > maxCommits) {
        shown.push(`+ ${entries.length - maxCommits} more commits`);
      }

      const filtered = shown.join("\n");
      return { filtered, rawChars, filteredChars: filtered.length };
    }
  };
}

// ── 4. Smart Ls/Find/Fd/Tree Filter ───────────────────────────────
const NOISE_DIRS = new Set([
  "node_modules", ".git", "target", "__pycache__", ".venv", "dist", "build",
  "coverage", ".next", ".nuxt", ".svelte-kit", ".cache", "venv", "env"
]);

function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function createLsFilter(): Filter {
  return {
    name: "ls",
    matches: (command: string) => /^(ls|exa|eza|find|fd|tree)\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      if (!raw.trim()) return { filtered: "", rawChars, filteredChars: 0 };

      const lines = raw.split("\n");
      const isFind = /^(find|fd)\b/.test(command);
      const isTree = /^tree\b/.test(command) || /[├└│──]/.test(raw);

      if (isFind || isTree) {
        // Group by directories
        const groups = new Map<string, string[]>();
        let totalFiles = 0;

        for (const line of lines) {
          let p = line.trim();
          if (!p || p === ".") continue;
          if (p.startsWith("./")) p = p.slice(2);

          // Skip noise paths
          if (p.split("/").some(s => NOISE_DIRS.has(s))) continue;

          const lastSlash = p.lastIndexOf("/");
          const dir = lastSlash >= 0 ? p.slice(0, lastSlash) : ".";
          const file = lastSlash >= 0 ? p.slice(lastSlash + 1) : p;
          if (!file) continue;

          if (!groups.has(dir)) groups.set(dir, []);
          groups.get(dir)!.push(file);
          totalFiles++;
        }

        const outLines: string[] = [];
        const extensions = new Map<string, number>();

        for (const [dir, files] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          outLines.push(`${dir === "." ? "./" : dir + "/"}`);
          outLines.push(`   ${files.slice(0, 20).join("  ")}${files.length > 20 ? ` ... +${files.length - 20} more` : ""}`);
          for (const f of files) {
            const ext = getExt(f);
            if (ext) extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
          }
        }

        const extSummary = [...extensions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([ext, count]) => `${count} ${ext}`)
          .join(", ");

        outLines.push(`\n📊 ${totalFiles} files in ${groups.size} dirs${extSummary ? ` (${extSummary})` : ""}`);
        const filtered = outLines.join("\n");
        return { filtered, rawChars, filteredChars: filtered.length };
      } else {
        // Standard ls -la
        const entries: Array<{ name: string; isDir: boolean; size: number }> = [];
        for (const line of lines) {
          if (/^total\s+\d+/.test(line) || line.trim() === "") continue;

          // ls -la file
          const fileMatch = line.match(/^[-l](?:[rwxsStT-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
          if (fileMatch) {
            entries.push({ name: fileMatch[2].trim(), isDir: false, size: parseInt(fileMatch[1], 10) });
            continue;
          }

          // ls -la dir
          const dirMatch = line.match(/^d(?:[rwxsStT-]{9})\s+\d+\s+\S+\s+\S+\s+\d+\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
          if (dirMatch) {
            const name = dirMatch[1].trim();
            if (name !== "." && name !== "..") {
              entries.push({ name, isDir: true, size: -1 });
            }
            continue;
          }

          // simple listing
          const name = line.trim();
          if (name && name !== "." && name !== "..") {
            entries.push({ name, isDir: false, size: -1 });
          }
        }

        const clean = entries.filter(e => !NOISE_DIRS.has(e.name));
        if (clean.length === 0) return { filtered: "", rawChars, filteredChars: 0 };

        const outLines: string[] = [];
        const extensions = new Map<string, number>();

        for (const d of clean.filter(e => e.isDir)) {
          outLines.push(`${d.name}/`);
        }
        for (const f of clean.filter(e => !e.isDir)) {
          outLines.push(f.size >= 0 ? `${f.name}  ${humanSize(f.size)}` : f.name);
          const ext = getExt(f.name);
          if (ext) extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
        }

        const extSummary = [...extensions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([ext, count]) => `${count} ${ext}`)
          .join(", ");

        outLines.push(`\n📊 ${clean.length} entries${extSummary ? ` (${extSummary})` : ""}`);
        const filtered = outLines.join("\n");
        return { filtered, rawChars, filteredChars: filtered.length };
      }
    }
  };
}

// ── 5. Smart Package Manager Install Filter ───────────────────────
export function createNpmInstallFilter(): Filter {
  return {
    name: "npm-install",
    matches: (command: string) => /^(bun|npm|pnpm|yarn)\s+(install|add|i)\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      const clean = stripAnsiText(raw);

      let count: number | null = null;
      let duration: string | null = null;

      // Extractor matchers
      const countMatch = clean.match(/added\s+(\d+)\s+packages/i) || clean.match(/(\d+)\s+packages?\s+installed/i) || clean.match(/Packages:\s*\+(\d+)/);
      if (countMatch) count = parseInt(countMatch[1], 10);

      const durMatch = clean.match(/in\s+(\d+(?:\.\d+)?s)/) || clean.match(/Done in\s+(\d+(?:\.\d+)?s)/i) || clean.match(/\[(\d+(?:\.\d+)?(?:ms|s))\]/);
      if (durMatch) duration = durMatch[1];

      const parts: string[] = [];
      if (count !== null) {
        parts.push(`ok ✓ ${count} packages installed${duration ? ` (${duration})` : ""}`);
      } else {
        parts.push(`ok ✓ install completed${duration ? ` (${duration})` : ""}`);
      }

      // Preserve vulnerabilities
      const vulns = clean.split("\n")
        .map(l => l.trim())
        .filter(l => /vulnerabilit|npm\s+audit|security\s+audit|deprecated/i.test(l));
      if (vulns.length > 0) {
        parts.push("");
        for (const v of vulns.slice(0, 10)) {
          parts.push(`⚠ ${v}`);
        }
      }

      const filtered = parts.join("\n");
      return { filtered, rawChars, filteredChars: filtered.length };
    }
  };
}

// ── 6. Smart Grep Filter ──────────────────────────────────────────
export function createGrepFilter(): Filter {
  return {
    name: "grep",
    matches: (command: string) => /^(rg|grep)\b/.test(command),
    apply: (command: string, raw: string): FilterResult => {
      const rawChars = raw.length;
      const lines = stripAnsiText(raw).split("\n");
      const fileMatches = new Map<string, Array<{ lineNum: string; text: string }>>();

      let totalMatches = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "--") continue;

        const vimgrep = trimmed.match(/^(.+?):(\d+):\d+:(.+)$/);
        if (vimgrep) {
          const file = vimgrep[1];
          if (!fileMatches.has(file)) fileMatches.set(file, []);
          fileMatches.get(file)!.push({ lineNum: vimgrep[2], text: vimgrep[3].trim() });
          totalMatches++;
          continue;
        }

        const standard = trimmed.match(/^(.+?):(\d+):(.+)$/);
        if (standard) {
          const file = standard[1];
          if (!fileMatches.has(file)) fileMatches.set(file, []);
          fileMatches.get(file)!.push({ lineNum: standard[2], text: standard[3].trim() });
          totalMatches++;
          continue;
        }

        const noLineNum = trimmed.match(/^(.+?):(.+)$/);
        if (noLineNum && !noLineNum[1].match(/^\d+$/) && /[/.]/.test(noLineNum[1])) {
          const file = noLineNum[1];
          if (!fileMatches.has(file)) fileMatches.set(file, []);
          fileMatches.get(file)!.push({ lineNum: "", text: noLineNum[2].trim() });
          totalMatches++;
        }
      }

      if (totalMatches === 0) {
        return { filtered: "", rawChars, filteredChars: 0 };
      }

      const output: string[] = [];
      const sortedFiles = [...fileMatches.keys()].slice(0, 15);

      for (const file of sortedFiles) {
        output.push(`${file}:`);
        const matches = fileMatches.get(file)!;
        const shown = matches.slice(0, 5);
        for (const m of shown) {
          output.push(m.lineNum ? `  ${m.lineNum}: ${m.text}` : `  ${m.text}`);
        }
        if (matches.length > 5) {
          output.push(`  ... ${matches.length - 5} more matches`);
        }
        output.push("");
      }

      if (fileMatches.size > 15) {
        output.push(`... ${fileMatches.size - 15} more files`, "");
      }

      output.push(`${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${fileMatches.size} file${fileMatches.size === 1 ? '' : 's'}`);
      const filtered = output.join("\n").trimEnd();
      return { filtered, rawChars, filteredChars: filtered.length };
    }
  };
}

// ── Filter Engine Class ───────────────────────────────────────────
export class FilterEngine {
  private filters: Filter[] = [
    createGitStatusFilter(),
    createGitDiffFilter(),
    createGitLogFilter(),
    createLsFilter(),
    createNpmInstallFilter(),
    createGrepFilter()
  ];

  findFilter(command: string): Filter | null {
    const trimmed = command.trim();
    for (const f of this.filters) {
      if (f.matches(trimmed)) return f;
    }
    return null;
  }

  applyWithMetadata(command: string, output: string): { output: string; matched: boolean; filterName?: string } {
    const cleanOutput = stripAnsiText(output);
    const filter = this.findFilter(command);
    if (!filter) {
      return { output: cleanOutput, matched: false };
    }

    try {
      const result = filter.apply(command, cleanOutput);
      return { output: result.filtered, matched: true, filterName: filter.name };
    } catch (err) {
      console.error(`[TokenSaver] Failed to apply filter ${filter.name}:`, err);
      return { output: cleanOutput, matched: false };
    }
  }
}
