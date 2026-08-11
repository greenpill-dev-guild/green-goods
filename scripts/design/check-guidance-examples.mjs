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
    pattern:
      /\bduration-(?!\[?var)[0-9]+(?:ms|s)?\b|\bduration-\[(?!var\()[^\]]*\b[0-9]*\.?[0-9]+(?:ms|s)\b[^\]]*\]|\b(?:transition|animation)(?:-duration)?\s*:[^;}]*\b[0-9]*\.?[0-9]+(?:ms|s)\b|\b(?:transitionDuration|animationDuration)\s*:\s*["']?(?!var\()[0-9]*\.?[0-9]+(?:ms|s)\b/i,
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
    test: (line) => {
      const cssProperty = line.match(/\bbox-shadow\s*:\s*([^;}]+)/i)?.[1]?.trim();
      if (cssProperty && cssProperty !== "none" && !cssProperty.startsWith("var(")) return true;
      const jsProperty = line.match(/\bboxShadow\s*:\s*["']?([^"',;}]+)/)?.[1]?.trim();
      if (jsProperty && jsProperty !== "none" && !jsProperty.startsWith("var(")) return true;
      return /(?<!box-)(?<!--)\b(?:drop-)?shadow(?:-(?:sm|md|lg|xl|2xl|inner))?\b(?!-none\b)(?!-\[var\()/i.test(
        line,
      );
    },
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
    let inBlockComment = false;
    let reducedMotionDepth = 0;
    for (const entry of block.lines) {
      const line = entry.text.trim();
      if (!line) continue;
      if (inBlockComment) {
        if (line.includes("*/")) inBlockComment = false;
        continue;
      }
      if (line.startsWith("//")) continue;
      if (line.startsWith("/*")) {
        if (!line.includes("*/")) inBlockComment = true;
        continue;
      }
      if (/^--[a-z0-9-]+\s*:/.test(line)) continue;
      const opensReducedMotion = line.includes("prefers-reduced-motion");
      const inReducedMotion = reducedMotionDepth > 0 || opensReducedMotion;
      const radiusExampleLine = line.includes("design-guard: allow-radius-literal");
      for (const check of checks) {
        if (check.label === "arbitrary numeric radius" && radiusExampleLine) continue;
        if (
          check.label === "hardcoded transition duration" &&
          inReducedMotion &&
          /\b(?:0|0\.0*\d+)(?:ms|s)\b/.test(line)
        ) {
          continue;
        }
        const implementation = line.replace(/\s+\/\/.*$/, "");
        if ((check.test ?? ((value) => check.pattern.test(value)))(implementation)) {
          failures.push(`${relativePath}:${entry.line}: ${check.label} in implementation example`);
        }
      }
      if (opensReducedMotion) reducedMotionDepth = 1;
      if (reducedMotionDepth > 0) {
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;
        reducedMotionDepth += opens - closes - (opensReducedMotion ? 1 : 0);
        if (reducedMotionDepth < 0) reducedMotionDepth = 0;
      }
    }
  }
  return failures;
}

function main() {
  try {
    if (process.argv.length > 2) throw new Error(`unknown argument: ${process.argv[2]}`);
    const designDir = path.join(repoRoot, ".claude", "skills", "design");
    if (!fs.existsSync(designDir)) {
      throw new Error(
        `design guidance directory not found: ${path.relative(repoRoot, designDir)}`,
      );
    }
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
  } catch (error) {
    console.error(`check-guidance-examples: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
