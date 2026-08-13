/**
 * @victorhg/pi-code-quality
 *
 * Code quality metrics extension for the Pi coding agent: complexity,
 * duplication, spaghetti index, security errors, exposed secrets, and
 * anti-code-slop scoring.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export * from "./schema.js";
export * from "./languages.js";
export * from "./normalize.js";
export * from "./score.js";
export * from "./runners.js";

export default function activate(_pi: ExtensionAPI) {
  // Phase 1: runners + normalizers (parse external tool JSON)
  // Phase 2: scoring + aggregation (computeSpaghettiFactor, aggregateScores)
  // Phase 3: tools, commands, TUI rendering, footer integration
}
