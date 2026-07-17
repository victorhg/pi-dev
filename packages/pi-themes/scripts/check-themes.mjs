#!/usr/bin/env node
// Validates every theme JSON file under themes/: must parse as JSON and
// must declare the fields the Pi theme loader requires (name, vars, colors).
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const themesDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "themes");
const requiredFields = ["name", "vars", "colors"];

let hasError = false;

const files = readdirSync(themesDir).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.error(`[check-themes] No theme files found in ${themesDir}`);
  process.exit(1);
}

for (const file of files) {
  const path = join(themesDir, file);
  const raw = readFileSync(path, "utf8");

  let theme;
  try {
    theme = JSON.parse(raw);
  } catch (err) {
    console.error(`[check-themes] ${basename(file)}: invalid JSON — ${err.message}`);
    hasError = true;
    continue;
  }

  for (const field of requiredFields) {
    if (!(field in theme)) {
      console.error(`[check-themes] ${basename(file)}: missing required field "${field}"`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`[check-themes] ${files.length} theme file(s) valid.`);
