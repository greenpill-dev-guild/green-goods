#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const sourceDir = path.join(repoRoot, ".claude/skills");
const targetDir = path.join(repoRoot, ".agents/skills");

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

for (const arg of args) {
  if (arg !== "--check") {
    console.error(`Unknown option: ${arg}`);
    process.exit(2);
  }
}

function walkFiles(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "_archived") continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, baseDir));
      continue;
    }

    if (!entry.isFile()) continue;

    const relPath = path.relative(baseDir, fullPath);
    if (relPath === "index.md") continue;

    files.push(relPath);
  }

  return files.sort();
}

const semanticMirrorChecks = [
  {
    message: "duplicated AGENTS.md reference after CLAUDE.md transform",
    pattern: /`AGENTS\.md`\s*(?:,|and)\s*`AGENTS\.md`/,
  },
  {
    message: "canonical skill source points at generated mirror",
    pattern: /canonical[^`]*`\.agents\/skills\//i,
  },
  {
    message: "mirror source and target both point at .agents/skills",
    pattern: /`\.agents\/skills\/[^`]+`\s*\(mirrored at `\.agents\/skills\//,
  },
];

function transformLineForCodex(line) {
  let transformed = line;

  if (!transformed.includes("AGENTS.md")) {
    transformed = transformed.replaceAll("CLAUDE.md", "AGENTS.md");
  }

  if (!transformed.includes(".agents/skills")) {
    transformed = transformed
      .replaceAll(".claude/skills/", ".agents/skills/")
      .replaceAll(".claude/skills", ".agents/skills");
  }

  return transformed;
}

function transformForCodex(content) {
  return content.split("\n").map(transformLineForCodex).join("\n");
}

function collectSemanticFailures(expected) {
  const semanticFailures = [];

  for (const [relPath, content] of expected) {
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      for (const check of semanticMirrorChecks) {
        if (check.pattern.test(lines[index])) {
          semanticFailures.push(
            `${path.join(".agents/skills", relPath)}:${index + 1}: ${check.message}`,
          );
        }
      }
    }
  }

  return semanticFailures;
}

function read(relPath, rootDir) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

function writeIfChanged(relPath, content) {
  const targetPath = path.join(targetDir, relPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (fs.existsSync(targetPath) && fs.readFileSync(targetPath, "utf8") === content) {
    return false;
  }

  fs.writeFileSync(targetPath, content);
  return true;
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      removeEmptyDirs(path.join(dir, entry.name));
    }
  }

  if (dir !== targetDir && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing canonical skill source: ${path.relative(repoRoot, sourceDir)}`);
  process.exit(1);
}

if (fs.existsSync(targetDir) && fs.lstatSync(targetDir).isSymbolicLink()) {
  console.error(".agents/skills must be a generated directory, not a symlink.");
  process.exit(1);
}

const expected = new Map();
for (const relPath of walkFiles(sourceDir)) {
  expected.set(relPath, transformForCodex(read(relPath, sourceDir)));
}

const semanticFailures = collectSemanticFailures(expected);
if (semanticFailures.length > 0) {
  console.error("Skill mirror semantic check failed:");
  for (const failure of semanticFailures) console.error(`  - ${failure}`);
  process.exit(1);
}

const actualFiles = new Set(walkFiles(targetDir));
const failures = [];

for (const [relPath, expectedContent] of expected) {
  const targetPath = path.join(targetDir, relPath);
  if (!fs.existsSync(targetPath)) {
    failures.push(`missing ${path.join(".agents/skills", relPath)}`);
    continue;
  }

  const actualContent = fs.readFileSync(targetPath, "utf8");
  if (actualContent !== expectedContent) {
    failures.push(`stale ${path.join(".agents/skills", relPath)}`);
  }
}

for (const relPath of actualFiles) {
  if (!expected.has(relPath)) {
    failures.push(`extra ${path.join(".agents/skills", relPath)}`);
  }
}

if (checkOnly) {
  if (failures.length > 0) {
    console.error("Skill mirror drift detected:");
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error("Run `bun run skills:sync` to regenerate .agents/skills from .claude/skills.");
    process.exit(1);
  }

  console.log("Skill mirror is in sync.");
  process.exit(0);
}

let written = 0;
let removed = 0;

for (const [relPath, content] of expected) {
  if (writeIfChanged(relPath, content)) written += 1;
}

for (const relPath of actualFiles) {
  if (!expected.has(relPath)) {
    fs.rmSync(path.join(targetDir, relPath));
    removed += 1;
  }
}

removeEmptyDirs(targetDir);

console.log(`Skill mirror synced: ${written} updated, ${removed} removed.`);
