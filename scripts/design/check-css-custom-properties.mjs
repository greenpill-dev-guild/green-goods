#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const DEFAULT_SCAN_ROOTS = [
  "packages/admin/src",
  "packages/client/src",
  "packages/shared/src",
  "packages/shared/.storybook",
];
const DEFAULT_BASELINE = "scripts/data/css-custom-property-baseline.tsv";
const SCANNED_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
const EXCLUDED_DIRS = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static",
]);
const EXTERNAL_RUNTIME_PREFIXES = [
  "--breakpoint-",
  "--radix-",
  "--tw-",
];
const ALLOWED_BASELINE_CATEGORIES = new Set([
  "legacy-runtime",
  "migration-debt",
]);

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    baseline: DEFAULT_BASELINE,
    scanRoots: DEFAULT_SCAN_ROOTS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--root") {
      args.root = resolve(value);
      index += 1;
    } else if (arg === "--baseline") {
      args.baseline = value;
      index += 1;
    } else if (arg === "--scan-root") {
      args.scanRoots = [...args.scanRoots, value];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/design/check-css-custom-properties.mjs [--root <repo>] [--baseline <path>]",
    "",
    "Scans admin/client/shared CSS, TS, and TSX files for var(--*) references",
    "that have no fallback and no matching custom-property definition.",
  ].join("\n");
}

function normalizePath(root, filePath) {
  return relative(root, filePath).split("\\").join("/");
}

function walkFiles(root, relativeDir, files = []) {
  const absoluteDir = join(root, relativeDir);
  if (!existsSync(absoluteDir)) return files;

  for (const entry of readdirSync(absoluteDir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const absolutePath = join(absoluteDir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walkFiles(root, normalizePath(root, absolutePath), files);
      continue;
    }
    if (SCANNED_EXTENSIONS.has(extname(entry))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectFiles(root, scanRoots) {
  return [...new Set(scanRoots.flatMap((scanRoot) => walkFiles(root, scanRoot)))].sort();
}

function collectDefinitions(source) {
  const definitions = new Set();
  const definitionPattern = /(^|[^\w-])(--[A-Za-z0-9_-]+)\s*:/g;
  const quotedObjectKeyPattern = /["'](--[A-Za-z0-9_-]+)["']\s*:/g;
  const propertyPattern = /@property\s+(--[A-Za-z0-9_-]+)/g;

  for (const match of source.matchAll(definitionPattern)) {
    definitions.add(match[2]);
  }
  for (const match of source.matchAll(quotedObjectKeyPattern)) {
    definitions.add(match[1]);
  }
  for (const match of source.matchAll(propertyPattern)) {
    definitions.add(match[1]);
  }

  return definitions;
}

function collectUsages(root, filePath, source) {
  const usages = [];
  const usagePattern = /var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g;
  const lines = source.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(usagePattern)) {
      usages.push({
        variable: match[1],
        hasFallback: match[2] === ",",
        path: normalizePath(root, filePath),
        line: lineIndex + 1,
        snippet: line.trim().replace(/\s+/g, " "),
      });
    }
  }
  return usages;
}

function isExternalRuntimeVariable(variable) {
  return EXTERNAL_RUNTIME_PREFIXES.some((prefix) => variable.startsWith(prefix));
}

function unresolvedKey(entry) {
  return `${entry.variable}\t${entry.path}`;
}

function collectUnresolvedReferences({ root, scanRoots }) {
  const definitions = new Set();
  const usages = [];
  const files = collectFiles(root, scanRoots);

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    for (const definition of collectDefinitions(source)) {
      definitions.add(definition);
    }
    usages.push(...collectUsages(root, filePath, source));
  }

  const unresolvedByKey = new Map();
  for (const usage of usages) {
    if (usage.hasFallback) continue;
    if (definitions.has(usage.variable)) continue;
    if (isExternalRuntimeVariable(usage.variable)) continue;

    const key = unresolvedKey(usage);
    const existing = unresolvedByKey.get(key);
    if (!existing) {
      unresolvedByKey.set(key, { ...usage, count: 1 });
      continue;
    }
    existing.count += 1;
    if (usage.line < existing.line) {
      existing.line = usage.line;
      existing.snippet = usage.snippet;
    }
  }

  return {
    definitions: definitions.size,
    usages: usages.length,
    unresolved: [...unresolvedByKey.values()].sort((left, right) =>
      unresolvedKey(left).localeCompare(unresolvedKey(right)),
    ),
  };
}

function parseBaseline(root, baselinePath) {
  const absolutePath = resolve(root, baselinePath);
  if (!existsSync(absolutePath)) {
    return { entries: new Map(), errors: [], exists: false };
  }

  const entries = new Map();
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  const lines = readFileSync(absolutePath, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/^\s*(#|$)/.test(line)) return;

    const fields = line.split("\t");
    if (fields.length !== 6) {
      errors.push(`line ${index + 1}: expected 6 tab-separated fields`);
      return;
    }

    const [variable, path, category, owner, expires, note] = fields;
    if (!/^--[A-Za-z0-9_-]+$/.test(variable)) {
      errors.push(`line ${index + 1}: invalid variable "${variable}"`);
    }
    if (!path || path.startsWith("/") || path.includes("\\")) {
      errors.push(`line ${index + 1}: path must be repo-relative`);
    }
    if (!ALLOWED_BASELINE_CATEGORIES.has(category)) {
      errors.push(`line ${index + 1}: unsupported category "${category}"`);
    }
    if (!owner) {
      errors.push(`line ${index + 1}: owner is required`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      errors.push(`line ${index + 1}: expires must use YYYY-MM-DD`);
    } else if (expires < today) {
      errors.push(`line ${index + 1}: baseline entry expired on ${expires}`);
    }
    if (note.length < 12) {
      errors.push(`line ${index + 1}: note must explain the exception`);
    }

    const key = `${variable}\t${path}`;
    if (entries.has(key)) {
      errors.push(`line ${index + 1}: duplicate baseline entry for ${variable} in ${path}`);
    }
    entries.set(key, { variable, path, category, owner, expires, note });
  });

  return { entries, errors, exists: true };
}

function formatReference(entry) {
  const count = entry.count > 1 ? ` (${entry.count} refs in file)` : "";
  return `${entry.path}:${entry.line}: ${entry.variable}${count} :: ${entry.snippet}`;
}

function run({ root, baseline, scanRoots }) {
  const result = collectUnresolvedReferences({ root, scanRoots });
  const baselineResult = parseBaseline(root, baseline);
  const unresolvedKeys = new Set(result.unresolved.map(unresolvedKey));
  const baselineKeys = new Set(baselineResult.entries.keys());
  const newUnresolved = result.unresolved.filter((entry) => !baselineKeys.has(unresolvedKey(entry)));
  const staleBaseline = [...baselineResult.entries.values()].filter(
    (entry) => !unresolvedKeys.has(`${entry.variable}\t${entry.path}`),
  );

  if (baselineResult.errors.length > 0) {
    console.log(`Invalid CSS custom property baseline metadata in ${baseline}:`);
    for (const error of baselineResult.errors) {
      console.log(`  ${error}`);
    }
    return 1;
  }

  if (newUnresolved.length > 0) {
    console.log("Undefined CSS custom properties without fallbacks:");
    for (const entry of newUnresolved) {
      console.log(`  ${formatReference(entry)}`);
    }
    console.log();
    if (!baselineResult.exists) {
      console.log(`No baseline found at ${baseline}.`);
    }
    console.log(
      "Define the variable, add a fallback to var(...), or add an audited baseline entry if this is known migration debt.",
    );
    return 1;
  }

  if (staleBaseline.length > 0) {
    console.log("Stale CSS custom property baseline entries found. Remove these fixed entries:");
    for (const entry of staleBaseline) {
      console.log(`  ${entry.variable}\t${entry.path}`);
    }
    return 1;
  }

  console.log(
    `CSS custom property guard passed: ${result.usages} var() references, ${result.definitions} definitions, ${baselineResult.entries.size} audited unresolved entries.`,
  );
  return 0;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  process.exit(run(args));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(2);
}
