#!/usr/bin/env node
/**
 * check-react-patterns.js
 *
 * Lint executor for repository source-pattern and package-boundary rules that
 * oxlint cannot express directly.
 *
 * Modeled on `scripts/quality/check-source-structure.js` and
 * `scripts/design/check-vocab.sh`. Regex-based — AST is overkill for v1.
 *
 * Rules evaluated:
 *  - Rule 1   raw setTimeout / setInterval inside hooks (TS/TSX)
 *  - Rule 2   raw addEventListener without `{ once: true }` outside useEventListener
 *  - Rule 5   field/variable named like an Ethereum address typed as `string`
 *  - Rule 6   Zustand selector returning whole state `(state) => state`
 *  - Rule 11  undeclared `@green-goods/shared/...` imports
 *  - Rule 13  raw Tailwind palette colors (frontend-design Rule 13)
 *  - Rule 16  inline alert-style divs that should use shared <Alert /> (frontend Rule 16)
 *  - Architecture: declared internal-package direction and package-level cycles
 *  - Architecture: shared export targets and consumer imports
 *  - Architecture: exported client/admin hooks stay in shared unless explicitly local
 *
 * Modes:
 *   --report          emit JSON for blocking and heuristic advisory rules
 *   --baseline-write  rewrite the advisory triage inventory
 *   default           run only high-confidence blocking rules and fail on any hit
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const baselinePath = resolve(repoRoot, "scripts/quality/data/lint-rules-baseline.json");
const sharedPackagePath = resolve(repoRoot, "packages/shared/package.json");

// Package-level dependency direction only. This deliberately does not claim to
// detect file-level TypeScript cycles; doing that reliably requires module
// resolution/AST tooling. Keep the allowed edges explicit so architecture
// changes are reviewed instead of silently widening the graph.
const PACKAGE_DEPENDENCY_POLICY = {
  contracts: [],
  shared: ["contracts"],
  indexer: [],
  client: ["shared"],
  admin: ["shared"],
  agent: ["shared"],
  // Internal QA tooling, deliberately dependency-free: it reads the test
  // catalog from disk at build time rather than importing a package, so it can
  // never drag product code into a tool nobody ships to users.
  qa: [],
};

// This channel is an admin-shell implementation detail: its hooks coordinate
// components inside one package and are not reusable domain/application hooks.
const LOCAL_EXPORTED_HOOK_EXCEPTIONS = new Set([
  "packages/admin/src/components/Layout/leftSheetChannel.tsx",
]);

// Regex heuristics stay available in --report mode for cleanup analysis without
// flooding normal lint output. Only deterministic rules belong in the blocking gate.
const BLOCKING_RULES = new Set([
  "rule-6-zustand-whole-state",
  "rule-11-undeclared-shared-import",
]);

// Globs of files in scope. Mirror the scopes from `.claude/rules/*.md` frontmatter.
const SCOPES = {
  "rule-1-raw-timer": ["packages/shared/src", "packages/client/src", "packages/admin/src"],
  "rule-2-raw-addeventlistener": [
    "packages/shared/src",
    "packages/client/src",
    "packages/admin/src",
  ],
  "rule-5-address-as-string": [
    "packages/shared/src",
    "packages/client/src",
    "packages/admin/src",
  ],
  "rule-6-zustand-whole-state": [
    "packages/shared/src",
    "packages/client/src",
    "packages/admin/src",
  ],
  // Rule 11 only checks consumers of the barrel — internal `packages/shared/src/`
  // legitimately uses relative imports per the rule's own exception clause.
  "rule-11-undeclared-shared-import": [
    "packages/admin/src",
    "packages/client/src",
    "packages/agent/src",
    "packages/indexer/src",
  ],
  "rule-13-raw-tailwind-color": ["packages/admin/src", "packages/client/src"],
  "rule-16-inline-alert-div": ["packages/admin/src", "packages/client/src"],
};


// File-level allowlist for hooks that legitimately implement timer/event utilities.
// These ARE the utility hooks the rules ask consumers to use.
const RULE_1_FILE_ALLOWLIST = new Set([
  "packages/shared/src/hooks/utils/useTimeout.ts",
  "packages/shared/src/hooks/utils/useDelayedInvalidation.ts",
]);
const RULE_2_FILE_ALLOWLIST = new Set([
  "packages/shared/src/hooks/utils/useEventListener.ts",
  "packages/shared/src/hooks/utils/useWindowEvent.ts",
  "packages/shared/src/hooks/utils/useDocumentEvent.ts",
]);

const sharedPackage = JSON.parse(readFileSync(sharedPackagePath, "utf8"));
const DECLARED_SHARED_IMPORTS = new Set(
  Object.keys(sharedPackage.exports ?? {}).map((exportPath) =>
    exportPath === "."
      ? "@green-goods/shared"
      : `@green-goods/shared/${exportPath.replace(/^\.\//, "")}`,
  ),
);
const SHARED_IMPORT_PATTERN =
  /(?:from\s+|import\s*\(\s*|import\s+)["'](@green-goods\/shared(?:\/[^"']+)?)['"]/g;

const INTERNAL_PACKAGE_IMPORT_PATTERN =
  /(?:from\s+|import\s*\(\s*|import\s+)["'](@green-goods\/([a-z0-9-]+)(?:\/[^"']+)?)["']/g;

function extractSharedImportPaths(line) {
  SHARED_IMPORT_PATTERN.lastIndex = 0;
  return Array.from(line.matchAll(SHARED_IMPORT_PATTERN), (match) => match[1]);
}

function assertSharedImportRule() {
  const fixtures = [
    ['import { logger } from "@green-goods/shared";', "@green-goods/shared", true],
    [
      'import type { PublicGarden } from "@green-goods/shared/public-contracts";',
      "@green-goods/shared/public-contracts",
      true,
    ],
    [
      'import { secret } from "@green-goods/shared/src/internal";',
      "@green-goods/shared/src/internal",
      false,
    ],
    [
      'const lazy = import(\n  "@green-goods/shared/src/internal"\n);',
      "@green-goods/shared/src/internal",
      false,
    ],
  ];

  for (const [source, expectedPath, expectedDeclared] of fixtures) {
    const [actualPath] = extractSharedImportPaths(source);
    if (actualPath !== expectedPath || DECLARED_SHARED_IMPORTS.has(actualPath) !== expectedDeclared) {
      throw new Error(`Rule 11 self-check failed for fixture: ${source}`);
    }
  }
}

assertSharedImportRule();

// ---------------- helpers ----------------

// Directory names to skip when walking source trees.
const WALK_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "dev-dist",
  "__tests__",
  "lib",
  "generated",
  "vendor",
]);

function walk(rootAbs, out) {
  let entries;
  try {
    entries = readdirSync(rootAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (WALK_SKIP_DIRS.has(entry.name)) continue;
    const childAbs = resolve(rootAbs, entry.name);
    if (entry.isDirectory()) {
      walk(childAbs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.(test|spec|stories)\.(ts|tsx)$/.test(name)) continue;
    if (/\.d\.ts$/.test(name)) continue;
    out.push(relative(repoRoot, childAbs));
  }
}

function listFiles(scopes) {
  const out = [];
  for (const scope of scopes) {
    const abs = resolve(repoRoot, scope);
    if (!existsSync(abs)) continue;
    walk(abs, out);
  }
  // Stable ordering for diff-friendly output.
  return Array.from(new Set(out)).sort();
}

function readFile(filePath) {
  return readFileSync(resolve(repoRoot, filePath), "utf8");
}

export function extractInternalPackageImports(source) {
  const lines = source.split("\n");
  INTERNAL_PACKAGE_IMPORT_PATTERN.lastIndex = 0;
  const imports = [];

  for (const match of source.matchAll(INTERNAL_PACKAGE_IMPORT_PATTERN)) {
    const line = source.slice(0, match.index).split("\n").length;
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? "")) continue;
    imports.push({ importPath: match[1], target: match[2], line });
  }

  return imports;
}

export function findDirectedCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycles = new Map();

  function visit(node) {
    state.set(node, "visiting");
    stack.push(node);

    for (const dependency of graph[node] ?? []) {
      if (state.get(dependency) === "visiting") {
        const cycle = stack.slice(stack.indexOf(dependency));
        const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)]);
        const canonical = rotations.map((entry) => entry.join(" -> ")).sort()[0];
        cycles.set(canonical, [...canonical.split(" -> "), canonical.split(" -> ")[0]]);
        continue;
      }
      if (!state.has(dependency)) visit(dependency);
    }

    stack.pop();
    state.set(node, "visited");
  }

  for (const node of Object.keys(graph).sort()) {
    if (!state.has(node)) visit(node);
  }

  return Array.from(cycles.values());
}

function internalDependencyEntries(manifest) {
  const entries = [];
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  for (const section of sections) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (dependency.startsWith("@green-goods/")) entries.push({ dependency, section });
    }
  }
  return entries;
}

export function findPackageArchitectureViolations(records) {
  const hits = [];
  const packageNameToDirectory = new Map(
    records.map((record) => [record.manifest.name, record.directory]),
  );
  const graph = Object.fromEntries(records.map((record) => [record.directory, []]));

  for (const record of records) {
    if (!Object.hasOwn(PACKAGE_DEPENDENCY_POLICY, record.directory)) {
      hits.push({
        rule: "architecture-ungoverned-package",
        file: `packages/${record.directory}/package.json`,
        line: 1,
        snippet: `${record.directory} is missing from PACKAGE_DEPENDENCY_POLICY`,
      });
    }
    const allowed = new Set(PACKAGE_DEPENDENCY_POLICY[record.directory] ?? []);
    const productionDependencies = new Set([
      ...Object.keys(record.manifest.dependencies ?? {}),
      ...Object.keys(record.manifest.peerDependencies ?? {}),
      ...Object.keys(record.manifest.optionalDependencies ?? {}),
    ]);

    for (const { dependency, section } of internalDependencyEntries(record.manifest)) {
      const targetDirectory = packageNameToDirectory.get(dependency);
      if (!targetDirectory) {
        hits.push({
          rule: "architecture-unknown-internal-package",
          file: `packages/${record.directory}/package.json`,
          line: 1,
          snippet: `${section} declares unknown internal package ${dependency}`,
        });
        continue;
      }

      graph[record.directory].push(targetDirectory);
      if (!allowed.has(targetDirectory)) {
        hits.push({
          rule: "architecture-package-direction",
          file: `packages/${record.directory}/package.json`,
          line: 1,
          snippet: `${record.directory} -> ${targetDirectory} is not an allowed package dependency`,
        });
      }
    }

    for (const sourceImport of record.sourceImports) {
      const targetDirectory = packageNameToDirectory.get(`@green-goods/${sourceImport.target}`);
      if (!targetDirectory) {
        hits.push({
          rule: "architecture-unknown-internal-package",
          file: sourceImport.file,
          line: sourceImport.line,
          snippet: sourceImport.importPath,
        });
        continue;
      }
      // Package self-import aliases are an intra-package module-shape concern,
      // not an edge in the cross-package dependency graph governed here.
      if (targetDirectory === record.directory) continue;
      if (!allowed.has(targetDirectory)) {
        hits.push({
          rule: "architecture-package-direction",
          file: sourceImport.file,
          line: sourceImport.line,
          snippet: `${record.directory} source imports ${sourceImport.importPath}`,
        });
        continue;
      }
      if (!productionDependencies.has(`@green-goods/${sourceImport.target}`)) {
        hits.push({
          rule: "architecture-undeclared-package-import",
          file: sourceImport.file,
          line: sourceImport.line,
          snippet: `${sourceImport.importPath} is not declared in dependencies`,
        });
      }
    }
  }

  for (const cycle of findDirectedCycles(graph)) {
    hits.push({
      rule: "architecture-package-cycle",
      file: "packages/*/package.json",
      line: 1,
      snippet: cycle.join(" -> "),
    });
  }

  return hits;
}

function exportTargetStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargetStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargetStrings);
  return [];
}

export function findSharedExportTargetViolations(
  exportsMap,
  { packageRoot = resolve(repoRoot, "packages/shared"), fileExists = existsSync } = {},
) {
  const hits = [];
  for (const [exportPath, value] of Object.entries(exportsMap ?? {})) {
    const targets = exportTargetStrings(value);
    if (targets.length === 0) {
      hits.push({
        rule: "architecture-shared-export-target",
        file: "packages/shared/package.json",
        line: 1,
        snippet: `${exportPath} has no filesystem target`,
      });
      continue;
    }
    for (const target of targets) {
      const absoluteTarget = resolve(packageRoot, target);
      const relativeTarget = relative(packageRoot, absoluteTarget);
      if (
        !target.startsWith("./") ||
        relativeTarget.startsWith("..") ||
        !fileExists(absoluteTarget)
      ) {
        hits.push({
          rule: "architecture-shared-export-target",
          file: "packages/shared/package.json",
          line: 1,
          snippet: `${exportPath} points to missing or external target ${target}`,
        });
      }
    }
  }
  return hits;
}

export function extractExportedHookNames(source) {
  const names = [];
  const lines = source.split("\n");
  const pattern = /\bexport\s+(?:(?:async\s+)?function|const)\s+(use[A-Z][A-Za-z0-9_]*)\b/g;
  for (const match of source.matchAll(pattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? "")) continue;
    names.push({ name: match[1], line });
  }
  return names;
}

function gatherArchitectureHits() {
  const packageDirectories = readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(resolve(repoRoot, "packages", entry.name, "package.json")),
    )
    .map((entry) => entry.name)
    .sort();
  const records = packageDirectories.map((directory) => {
    const manifest = JSON.parse(readFile(`packages/${directory}/package.json`));
    const sourceImports = [];
    for (const file of listFiles([`packages/${directory}/src`])) {
      for (const sourceImport of extractInternalPackageImports(readFile(file))) {
        sourceImports.push({ ...sourceImport, file });
      }
    }
    return { directory, manifest, sourceImports };
  });

  const hits = findPackageArchitectureViolations(records);
  hits.push(...findSharedExportTargetViolations(sharedPackage.exports));

  for (const file of listFiles(["packages/client/src", "packages/admin/src"])) {
    if (LOCAL_EXPORTED_HOOK_EXCEPTIONS.has(file)) continue;
    for (const hook of extractExportedHookNames(readFile(file))) {
      hits.push({
        rule: "architecture-exported-consumer-hook",
        file,
        line: hook.line,
        snippet: `${hook.name} must live in packages/shared/src/hooks or be an explicit local exception`,
      });
    }
  }

  return hits;
}

// ---------------- rule scanners ----------------

// Each scanner returns array of { file, line, snippet, rule }.

function scanRule1(files) {
  const hits = [];
  // Match raw setTimeout/setInterval/setImmediate calls.
  // Heuristic: literal token followed by `(`. Skip lines that read `clearTimeout`/`clearInterval`.
  const re = /\b(setTimeout|setInterval)\s*\(/;
  for (const file of files) {
    if (RULE_1_FILE_ALLOWLIST.has(file)) continue;
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (re.test(line)) {
        hits.push({
          rule: "rule-1-raw-timer",
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }
  return hits;
}

function scanRule2(files) {
  const hits = [];
  // Match `.addEventListener(` calls. Allow `{ once: true }` on the same call (multi-line scan).
  const callRe = /\.addEventListener\s*\(/;
  for (const file of files) {
    if (RULE_2_FILE_ALLOWLIST.has(file)) continue;
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (!callRe.test(line)) continue;
      // Look ahead up to 6 lines for `once: true`. addEventListener call args can span lines.
      const window = lines.slice(i, Math.min(i + 6, lines.length)).join("\n");
      if (/once\s*:\s*true/.test(window)) continue;
      hits.push({
        rule: "rule-2-raw-addeventlistener",
        file,
        line: i + 1,
        snippet: line.trim().slice(0, 200),
      });
    }
  }
  return hits;
}

function scanRule5(files) {
  const hits = [];
  // Field/variable named like an Ethereum address but typed as `string` / `string[]`.
  // Anchor on names that unambiguously imply an address. We deliberately omit
  // bare `from` / `to` because those collide with date ranges, route hrefs,
  // and many other generic object shapes; they generate too many false positives.
  // Names included are address-evident on their own:
  //   - any `*Address` / `*address` (case insensitive on the address suffix)
  //   - role-typed actors that are addresses in this codebase: recipient, signer,
  //     spender, operators, delegate, holder, guardian
  const namePart =
    "(?:[a-zA-Z_]*[Aa]ddress|recipient|operators?|signer|spender|delegate|holder|guardian)";
  const re = new RegExp(`\\b${namePart}\\??\\s*:\\s*string(?:\\s*\\|\\s*null)?(?:\\[\\])?\\b`);
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      // Skip type guards & function signatures that take generic `value: string` etc.
      if (/^\s*(if|while|for|switch)\b/.test(line)) continue;
      const match = line.match(re);
      if (!match) continue;
      hits.push({
        rule: "rule-5-address-as-string",
        file,
        line: i + 1,
        snippet: line.trim().slice(0, 200),
      });
    }
  }
  return hits;
}

function scanRule11(files) {
  const hits = [];
  // Static imports, re-exports, side-effect imports, and dynamic imports must
  // resolve through an explicit package export. Source-internal paths are never public.
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    SHARED_IMPORT_PATTERN.lastIndex = 0;
    for (const match of content.matchAll(SHARED_IMPORT_PATTERN)) {
      const importPath = match[1];
      if (DECLARED_SHARED_IMPORTS.has(importPath)) continue;

      const lineNumber = content.slice(0, match.index).split("\n").length;
      const sourceLine = lines[lineNumber - 1] ?? "";
      if (/^\s*(\/\/|\*|\/\*)/.test(sourceLine)) continue;

      hits.push({
        rule: "rule-11-undeclared-shared-import",
        file,
        line: lineNumber,
        snippet: sourceLine.trim().slice(0, 200),
      });
    }
  }
  return hits;
}

function scanRule6(files) {
  const hits = [];
  // Zustand selector returning whole state. Heuristic: `useXxxStore((state) => state)` or `((s) => s)`.
  const re = /use[A-Z]\w*Store\s*\(\s*\(\s*([a-zA-Z_]\w*)\s*\)\s*=>\s*\1\s*\)/;
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (re.test(line)) {
        hits.push({
          rule: "rule-6-zustand-whole-state",
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }
  return hits;
}

function scanRule13(files) {
  const hits = [];
  // Raw Tailwind palette colors that should be semantic tokens.
  // Match `bg-{palette}-{shade}`, `text-{palette}-{shade}`, `border-{palette}-{shade}`.
  // Allow opacity suffix (`/50`) and `dark:` / `hover:` / `focus:` prefixes.
  const palettes = [
    "neutral",
    "gray",
    "slate",
    "zinc",
    "stone",
    "red",
    "orange",
    "amber",
    "yellow",
    "lime",
    "green",
    "emerald",
    "teal",
    "cyan",
    "sky",
    "blue",
    "indigo",
    "violet",
    "purple",
    "fuchsia",
    "pink",
    "rose",
  ];
  const palettePart = palettes.join("|");
  // Property prefixes covered: bg / text / border / ring / from / to / via / divide / outline / placeholder / accent / caret / fill / stroke / decoration / shadow.
  const propPart =
    "bg|text|border|ring|from|to|via|divide|outline|placeholder|accent|caret|fill|stroke|decoration|shadow";
  // Class token boundary: word-start (or after a quote/space/{`/`/`(`).
  const re = new RegExp(
    `(?:^|[\\s"'\\\`\\{\\[\\(])(?:[a-z]+:)?(?:${propPart})-(?:${palettePart})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`,
  );
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments and import lines.
      if (/^\s*(\/\/|\*|\/\*|import\s)/.test(line)) continue;
      if (re.test(line)) {
        hits.push({
          rule: "rule-13-raw-tailwind-color",
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }
  return hits;
}

function scanRule16(files) {
  const hits = [];
  // Inline alert-style div: a `<div ... className=...>` whose classes contain
  // both `border-{warning|error|info|success}` and `bg-{...}-{lighter|light}` markers,
  // OR a div with `rounded-` and `bg-warning-lighter` / `bg-error-lighter` etc.
  // Heuristic: scan for class strings that contain warning/error/info/success token combinations.
  const semanticBg = /\bbg-(warning|error|info|success|danger)-(lighter|light|subtle|soft)\b/;
  const semanticBorder = /\bborder-(warning|error|info|success|danger)(-light|-soft|-strong)?\b/;
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*|import\s)/.test(line)) continue;
      // Require the line to look like JSX element opening (contains `<div` or `className=`).
      if (!/className\s*=/.test(line)) continue;
      // Skip Alert component lines (already correct usage).
      if (/<Alert\b/.test(line)) continue;
      const hasBg = semanticBg.test(line);
      const hasBorder = semanticBorder.test(line);
      if (hasBg && hasBorder) {
        hits.push({
          rule: "rule-16-inline-alert-div",
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }
  return hits;
}

const RULE_SCANNERS = {
  "rule-1-raw-timer": scanRule1,
  "rule-2-raw-addeventlistener": scanRule2,
  "rule-5-address-as-string": scanRule5,
  "rule-6-zustand-whole-state": scanRule6,
  "rule-11-undeclared-shared-import": scanRule11,
  "rule-13-raw-tailwind-color": scanRule13,
  "rule-16-inline-alert-div": scanRule16,
};

// ---------------- baseline ----------------

function writeBaseline(allHits) {
  const grouped = {};
  for (const hit of allHits) {
    if (!grouped[hit.rule]) {
      grouped[hit.rule] = { count: 0, entries: [] };
    }
    grouped[hit.rule].count += 1;
    grouped[hit.rule].entries.push({
      file: hit.file,
      line: hit.line,
      snippet: hit.snippet,
    });
  }
  // Sort entries for stable diffs.
  for (const rule of Object.keys(grouped)) {
    grouped[rule].entries.sort((a, b) =>
      a.file !== b.file ? a.file.localeCompare(b.file) : a.line - b.line,
    );
  }
  const baseline = {
    note:
      "Auto-generated advisory inventory from `bun run lint:rules -- --baseline-write`. Default lint ignores this file and blocks every high-confidence hit. Use the inventory only for dedicated heuristic cleanup. See .claude/rules/ for rule sources.",
    generatedAt: new Date().toISOString(),
    rules: grouped,
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  return baseline;
}

// ---------------- main ----------------

function gatherAllHits({ includeAdvisory = true } = {}) {
  const allHits = gatherArchitectureHits();
  const fileLists = {};
  const enabledRules = includeAdvisory ? Object.keys(SCOPES) : BLOCKING_RULES;

  for (const rule of enabledRules) {
    const scopes = SCOPES[rule];
    const scanner = RULE_SCANNERS[rule];
    if (!scopes || !scanner) {
      throw new Error(`Rule ${rule} is missing scopes or a scanner`);
    }

    const key = JSON.stringify(scopes);
    if (!fileLists[key]) fileLists[key] = listFiles(scopes);
    allHits.push(...scanner(fileLists[key]));
  }

  return allHits;
}

function summarize(hits) {
  const byRule = {};
  for (const hit of hits) {
    byRule[hit.rule] = (byRule[hit.rule] || 0) + 1;
  }
  return byRule;
}

export function main(argv = process.argv.slice(2)) {
  const selectedMode = argv.includes("--baseline-write")
    ? "baseline-write"
    : argv.includes("--report")
      ? "report"
      : "lint";

  if (selectedMode === "report") {
    const hits = gatherAllHits();
    const summary = summarize(hits);
    console.log(JSON.stringify({ summary, total: hits.length, hits }, null, 2));
    return 0;
  }

  if (selectedMode === "baseline-write") {
    const hits = gatherAllHits();
    writeBaseline(hits);
    const summary = summarize(hits);
    console.log("Baseline written:", baselinePath);
    console.log("Per-rule counts:");
    for (const [rule, count] of Object.entries(summary)) {
      console.log(`  ${rule}: ${count}`);
    }
    console.log(`Total: ${hits.length}`);
    return 0;
  }

  const allHits = gatherAllHits({ includeAdvisory: false });

  if (allHits.length > 0) {
    console.error(`\n❌ check-react-patterns: ${allHits.length} blocking violation(s):`);
    for (const hit of allHits) {
      console.error(`  ${hit.rule} ${hit.file}:${hit.line}`);
      console.error(`    ${hit.snippet}`);
    }
    console.error(
      "\nRemediation: use a declared shared export, keep internal package dependencies within the explicit direction policy, move reusable exported hooks to shared, or document a narrow intentional exception in this checker.",
    );
  } else {
    console.log(
      `✅ check-react-patterns: 0 blocking violations across ${BLOCKING_RULES.size} source-pattern rules plus package/export/hook boundary checks.`,
    );
  }

  console.log(
    "Heuristic cleanup rules are quiet in lint mode; use --report for advisory analysis.",
  );

  console.log("\nRule sources:");
  console.log("  .claude/rules/react-patterns.md  (Rules 1, 2, 6)");
  console.log("  .claude/rules/typescript.md      (Rules 5, 11)");
  console.log("  .claude/rules/frontend-design.md (Rules 13, 16)");
  console.log("  scripts/quality/check-react-patterns.js (package/export/hook boundaries)");

  return allHits.length > 0 ? 1 : 0;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) process.exit(main());
