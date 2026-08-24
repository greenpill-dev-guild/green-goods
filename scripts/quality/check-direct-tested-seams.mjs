#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const ignoredDirs = new Set([
  ".claude", ".codex", ".git", ".turbo", ".plans", "artifacts", "build", "cache",
  "coverage", "dist", "docs", "node_modules", "out", "storybook-static",
]);

const argv = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};
const root = path.resolve(valueAfter("--root") ?? process.cwd());
const baselinePath = path.resolve(
  valueAfter("--baseline") ?? path.join(root, "scripts/data/direct-tested-seam-baseline.json")
);
const jsonOutput = argv.includes("--json");

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(target);
  }
  return files;
}

function existingModule(base) {
  for (const candidate of [base, ...extensions.map((extension) => `${base}${extension}`)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return path.resolve(candidate);
  }
  for (const extension of extensions) {
    const candidate = path.join(base, `index${extension}`);
    if (fs.existsSync(candidate)) return path.resolve(candidate);
  }
  return null;
}

function subjectFor(testFile) {
  const base = testFile.replace(/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/, "");
  const candidates = [base];
  const parts = base.split(path.sep);
  if (parts.includes("__tests__")) candidates.push(parts.filter((part) => part !== "__tests__").join(path.sep));
  for (const candidate of candidates) {
    const subject = existingModule(candidate);
    if (subject && subject !== path.resolve(testFile)) return subject;
  }
  return null;
}

function resolveSpecifier(specifier, testFile) {
  let base;
  if (specifier.startsWith(".")) base = path.resolve(path.dirname(testFile), specifier);
  else if (specifier.startsWith("@/")) {
    const match = testFile.match(/^(.*[/\\]packages[/\\][^/\\]+)[/\\]/);
    if (match) base = path.join(match[1], "src", specifier.slice(2));
  } else {
    const match = specifier.match(/^@green-goods\/([^/]+)(?:\/(.*))?$/);
    if (match) base = path.join(root, "packages", match[1], "src", match[2] ?? "index");
  }
  return base ? existingModule(base) : null;
}

function mockRanges(source) {
  const ranges = [];
  const pattern = /\bvi\.mock\s*\(/g;
  for (let match; (match = pattern.exec(source)); ) {
    const start = match.index;
    let depth = 0;
    let quote = null;
    let escaped = false;
    let end = source.length;
    for (let index = source.indexOf("(", start); index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")" && --depth === 0) {
        end = index + 1;
        break;
      }
    }
    const call = source.slice(start, end);
    const specifier = call.match(/vi\.mock\s*\(\s*["']([^"']+)["']/)?.[1];
    ranges.push({ start, end, specifier });
    pattern.lastIndex = end;
  }
  return ranges;
}

function directImports(source, ranges) {
  const visible = source
    .split("")
    .map((char, index) => (ranges.some((range) => index >= range.start && index < range.end) ? " " : char))
    .join("");
  const imports = [];
  const patterns = [
    /\b(?:import|export)\s+(?!type\b)(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\b(?:import|require|vi\.importActual)\s*\(\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) for (let match; (match = pattern.exec(visible)); ) imports.push(match[1]);
  return imports;
}

const violations = [];
for (const testFile of walk(root)) {
  const subject = subjectFor(testFile);
  if (!subject) continue;
  const source = fs.readFileSync(testFile, "utf8");
  const ranges = mockRanges(source);
  const mocksSubject = ranges.some(
    ({ specifier }) => specifier && resolveSpecifier(specifier, testFile) === subject
  );
  const importsSubject = directImports(source, ranges).some(
    (specifier) => resolveSpecifier(specifier, testFile) === subject
  );
  const relativeTest = path.relative(root, testFile).split(path.sep).join("/");
  const relativeSubject = path.relative(root, subject).split(path.sep).join("/");
  if (mocksSubject) violations.push(`mocked-subject|${relativeTest}|${relativeSubject}`);
  if (!importsSubject) violations.push(`missing-direct-import|${relativeTest}|${relativeSubject}`);
}

const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8")).violations ?? []
  : [];
const current = [...new Set(violations)].sort();
const expected = [...new Set(baseline)].sort();
const added = current.filter((violation) => !expected.includes(violation));
const stale = expected.filter((violation) => !current.includes(violation));

if (jsonOutput) console.log(JSON.stringify({ violations: current, added, stale }, null, 2));
if (added.length || stale.length) {
  if (!jsonOutput) {
    if (added.length) console.error(`New direct-test seam violations:\n- ${added.join("\n- ")}`);
    if (stale.length) console.error(`Stale baseline entries:\n- ${stale.join("\n- ")}`);
  }
  process.exit(1);
}
if (!jsonOutput) console.log(`PASS: ${current.length} known direct-test seam violation(s); no new drift.`);
