#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const implementationLanguages = new Set([
  "css",
  "html",
  "javascript",
  "js",
  "jsx",
  "scss",
  "ts",
  "tsx",
  "typescript",
]);

const checks = [
  {
    label: "hardcoded transition duration",
    pattern: /\bduration-(?!\[?var)[0-9]+(?:ms|s)?\b|\bduration\s*:\s*(?!var\()[0-9.]+(?:ms|s)/i,
  },
  { label: "hardcoded easing", pattern: /cubic-bezier\s*\(/i },
  { label: "raw hexadecimal color", pattern: /#[0-9a-f]{3,8}\b/i },
  {
    label: "raw color function",
    pattern: /\b(?:rgba?|hsla?|oklch)\s*\((?!\s*var\()/i,
  },
  {
    label: "raw palette utility",
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:white|black|[a-z]+-[0-9]{2,3})(?:\/[0-9]+)?\b/i,
  },
  {
    label: "arbitrary numeric radius",
    pattern:
      /\brounded-\[(?!var\()[^\]]*[0-9][^\]]*\]|\bborder-radius\s*:\s*(?!var\()[0-9.]|\bborderRadius\s*:\s*["']?[0-9.]/i,
  },
  {
    label: "raw shadow",
    pattern:
      /\bshadow-(?:xl|2xl)\b|\bshadow-\[(?!var\()[^\]]+\]|\bbox-shadow\s*:(?!\s*var\()|\bboxShadow\s*:(?!\s*["']?var\()/i,
  },
];

function markdownFiles(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownFiles(target, out);
    else if (entry.name.endsWith(".md")) out.push(target);
  }
  return out;
}

export function extractFencedBlocks(text) {
  const blocks = [];
  let current;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (!match) {
      if (current) current.lines.push({ line: index + 1, text: line });
      continue;
    }
    if (current) {
      if (match[1][0] === current.fence[0] && match[1].length >= current.fence.length) {
        blocks.push(current);
        current = undefined;
      } else {
        current.lines.push({ line: index + 1, text: line });
      }
      continue;
    }
    current = {
      fence: match[1],
      language: match[2].trim().split(/\s+/)[0].toLowerCase(),
      lines: [],
    };
  }
  return blocks;
}

export function findDesignGuidanceViolations(text, relativePath) {
  const failures = [];
  for (const block of extractFencedBlocks(text)) {
    if (!implementationLanguages.has(block.language)) continue;
    const illustratesTokenReplacement = block.lines.some((entry) =>
      entry.text.includes("Token form"),
    );
    const reducedMotionOverride = block.lines.some((entry) =>
      entry.text.includes("prefers-reduced-motion"),
    );
    for (const entry of block.lines) {
      const line = entry.text.trim();
      if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
      if (/^--[a-z0-9-]+\s*:/.test(line)) continue;
      for (const check of checks) {
        if (check.label === "arbitrary numeric radius" && illustratesTokenReplacement) continue;
        if (check.label === "hardcoded transition duration" && reducedMotionOverride) continue;
        if (check.pattern.test(line)) {
          failures.push(`${relativePath}:${entry.line}: ${check.label} in implementation example`);
        }
      }
    }
  }
  return failures;
}

function main() {
  if (process.argv.length > 2) {
    console.error(`check-guidance-examples: unknown argument: ${process.argv[2]}`);
    process.exit(2);
  }
  const designDir = path.join(repoRoot, ".claude", "skills", "design");
  const failures = [];
  for (const file of markdownFiles(designDir)) {
    failures.push(
      ...findDesignGuidanceViolations(
        fs.readFileSync(file, "utf8"),
        path.relative(repoRoot, file),
      ),
    );
  }
  if (failures.length > 0) {
    console.error(`check-guidance-examples: ${failures.length} failure(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("check-guidance-examples: design implementation fences use shared tokens.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
