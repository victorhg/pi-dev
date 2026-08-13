/**
 * Language detection and tool-support routing.
 *
 * Pure functions that map file paths to languages and decide which
 * language-sensitive tools can meaningfully score a project. This is what
 * lets the extension handle projects in different languages.
 */

import { basename, extname } from "node:path";

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "ruby"
  | "php"
  | "csharp"
  | "c"
  | "cpp"
  | "java"
  | "swift"
  | "kotlin"
  | "vue"
  | "svelte";

const EXTENSION_LANGUAGES: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".java": "java",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".vue": "vue",
  ".svelte": "svelte",
};

/** Project marker files → dominant language. */
const CONFIG_FILE_LANGUAGES: Record<string, Language> = {
  "package.json": "javascript",
  "tsconfig.json": "typescript",
  "pyproject.toml": "python",
  "setup.py": "python",
  "requirements.txt": "python",
  "Pipfile": "python",
  "go.mod": "go",
  "Cargo.toml": "rust",
  "Gemfile": "ruby",
  "composer.json": "php",
  "pom.xml": "java",
  "build.gradle": "java",
  "Package.swift": "swift",
  "build.gradle.kts": "kotlin",
};

/** Map a single file path to a language, or null if unrecognized. */
export function inferLanguage(path: string): Language | null {
  // Normalize Windows separators so this stays pure across platforms.
  const normalized = path.replace(/\\/g, "/");
  const base = basename(normalized);

  if (CONFIG_FILE_LANGUAGES[base]) return CONFIG_FILE_LANGUAGES[base];
  if (base.endsWith(".csproj") || base.endsWith(".sln")) return "csharp";

  const ext = extname(base).toLowerCase();
  return EXTENSION_LANGUAGES[ext] ?? null;
}

/**
 * Detect the languages present in a project from a list of file paths.
 * Returns languages ordered by frequency (most common first).
 */
export function detectLanguages(files: string[]): Language[] {
  const counts = new Map<Language, number>();
  for (const file of files) {
    const lang = inferLanguage(file);
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

/**
 * Languages `aislop` can score. Anything else (Java, Swift, Kotlin, Vue,
 * Svelte) causes aislop to withhold its score.
 */
export const AISLOP_LANGUAGES: Language[] = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "ruby",
  "php",
  "csharp",
  "c",
  "cpp",
];

/** True only when every detected language is in aislop's supported set. */
export function isAislopScoreable(languages: Language[]): boolean {
  if (languages.length === 0) return false;
  return languages.every((lang) => AISLOP_LANGUAGES.includes(lang));
}

/** lizard `-l` flag value per language (C and C++ both map to "cpp"). */
export const LIZARD_LANGUAGE_FLAGS: Partial<Record<Language, string>> = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  csharp: "csharp",
  c: "cpp",
  cpp: "cpp",
  java: "java",
  swift: "swift",
  kotlin: "kotlin",
};
