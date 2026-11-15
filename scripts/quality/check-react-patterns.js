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
 *  - Rule 14  whole reads of `import.meta.env` (typescript Rule 14)
 *  - Rule 13  raw Tailwind palette colors (frontend-design Rule 13)
 *  - Rule 16  inline alert-style divs that should use shared <Alert /> (frontend Rule 16)
 *  - Rule 19  client buttons and controls outside the shared family (frontend Rule 19)
 *  - Architecture: declared internal-package direction and package-level cycles
 *  - Architecture: shared export targets and consumer imports
 *  - Architecture: exported client/admin hooks stay in shared unless explicitly local
 *
 * Modes:
 *   --report           emit JSON for blocking and heuristic advisory rules
 *   --baseline-shrink  lower the ratchet baseline to the counts that remain
 *   default            fail on any blocking hit, and on any ratcheted count above its baseline
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBaseArgs, resolveGitBase } from "../lib/git-guardrails.mjs";

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
  // Grove G0 feasibility spike (.plans/ideas/grove/prototype.md, decision 17): a disposable
  // extension that must not pull product code. It consumes Shared only when a later slice
  // adds a declared export; until then it depends on nothing in the workspace.
  extension: [],
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
  "rule-14-whole-env-read",
  "rule-19-client-shared-controls",
]);

// Rules whose existing hits are debt: counts per rule and file may go down, never up. A new hit
// fails, a count below its baseline fails until --baseline-shrink records it, and the baseline
// itself may not grow over the base branch's copy.
export const RATCHETED_RULES = new Set([
  "rule-1-raw-timer",
  "rule-2-raw-addeventlistener",
  "rule-5-address-as-string",
]);
const RATCHET_REMEDIATION = {
  "rule-1-raw-timer": "use useTimeout, useDelayedInvalidation or useProgressiveInvalidation from @green-goods/shared",
  "rule-2-raw-addeventlistener": "use useEventListener, useWindowEvent or useDocumentEvent from @green-goods/shared, or pass { once: true }",
  "rule-5-address-as-string": "type the value as Address from @green-goods/shared/types/domain",
};

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
  // The walk skips directories named `lib`, and the shared `ENV` module lives in one.
  "rule-14-whole-env-read": [
    "packages/shared/src",
    "packages/shared/src/lib",
    "packages/client/src",
    "packages/admin/src",
  ],
  "rule-13-raw-tailwind-color": ["packages/admin/src", "packages/client/src"],
  "rule-16-inline-alert-div": ["packages/admin/src", "packages/client/src"],
  // Admin keeps its field family and raw-button sweep (frontend-design Rules 15 and 18).
  "rule-19-client-shared-controls": ["packages/client/src"],
};


// File-level allowlist for hooks that legitimately implement timer/event utilities.
// These ARE the utility hooks the rules ask consumers to use.
const RULE_1_FILE_ALLOWLIST = new Set(["packages/shared/src/hooks/utils/useTimeout.ts"]);
const RULE_2_FILE_ALLOWLIST = new Set(["packages/shared/src/hooks/utils/useEventListener.ts"]);

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

// Rule 19: client buttons and controls come from the shared family (DL-025).
// A raw element declares why it is raw; the shared family never carries a shape or
// height class; a link never dresses up as a button; radii stay on the scale.
const RULE_19_RAW_BUTTON_ROLES = new Set(["tab", "switch", "radio"]);
const RULE_19_PRESSABLE_KINDS = new Set(["card", "row", "scrim", "media", "trigger", "fab", "tab"]);
const RULE_19_RAW_INPUT_TYPES = new Set(["file", "radio", "checkbox", "hidden", "range"]);
const RULE_19_FAMILY = new Set(["Button", "IconButton", "Chip"]);
const RULE_19_TAG = /<(button|input|textarea|select|a|Link|Button|IconButton|Chip)(?=[\s/>])/g;
// A class token, variant prefixes included, that sets a radius, a height, or vertical padding.
const RULE_19_FAMILY_SHAPE_CLASS =
  /(?:^|\s)(?:[a-z0-9-]+:)*(?:rounded|h|min-h|size|py)(?:-[\w[\]().%/-]+)?(?=\s|$)/;
const RULE_19_BUTTON_LOOK = /(?:^|\s)rounded-full(?=\s|$)/;
const RULE_19_FILL_OR_BORDER = /(?:^|\s)(?:bg-(?!transparent(?=\s|$))\S+|border(?:-\S+)?)(?=\s|$)/;
const RULE_19_OFF_SCALE_RADIUS =
  /(?:^|[\s"'`])(?:[a-z0-9-]+:)*rounded(?:-[trblse]{1,2})?-(?:sm|3xl|4xl)(?=[\s"'`]|$)/;
const RULE_19_RETIRED_BUTTON_IMPORT =
  /from\s+["'](?:@\/components\/Actions|(?:\.\.?\/)+(?:[\w-]+\/)*Actions)(?:\/Button(?:\/[\w-]+)?)?["']/g;

/** Blank out comments, keeping offsets and newlines, so JSX shown in comments never matches. */
export function stripJsComments(source) {
  let out = "";
  let quote = null;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += next;
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i++;
      }
      i--;
      continue;
    }
    if (ch === "/" && next === "*") {
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function matchJsxBrace(source, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  return source.length - 1;
}

/**
 * Attributes of the JSX opening tag that starts right after its name at `index`.
 * Understands quoted values, `{...}` expressions (arrow functions included), and spreads.
 * Returns null when the text is not a JSX tag (for example a TypeScript generic).
 */
export function parseJsxAttributes(source, index) {
  const attrs = new Map();
  let i = index;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source.startsWith("/>", i) || source[i] === ">") return attrs;
    if (source[i] === "{") {
      i = matchJsxBrace(source, i) + 1;
      continue;
    }
    const name = /^[A-Za-z_][\w:.-]*/.exec(source.slice(i, i + 120))?.[0];
    if (!name) return null;
    i += name.length;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== "=") {
      attrs.set(name, true);
      continue;
    }
    i++;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] === '"' || source[i] === "'") {
      const close = source.indexOf(source[i], i + 1);
      if (close === -1) return null;
      attrs.set(name, source.slice(i + 1, close));
      i = close + 1;
    } else if (source[i] === "{") {
      const close = matchJsxBrace(source, i);
      attrs.set(name, source.slice(i, close + 1));
      i = close + 1;
    } else {
      return null;
    }
  }
  return null;
}

const literalAttr = (value) => (typeof value === "string" && !value.startsWith("{") ? value : null);

/** The quoted fragments of a className value: "a b", {cn("a", on && "b")}, or a template. */
function classNameText(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("{")) return value;
  const fragments = value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g);
  return Array.from(fragments, (m) => m[1] ?? m[2] ?? m[3]).join(" ");
}

export function scanRule19Source(file, source) {
  const hits = [];
  const code = stripJsComments(source);
  const sourceLines = source.split("\n");
  const lineAt = (index) => code.slice(0, index).split("\n").length;
  const hit = (line, reason) =>
    hits.push({
      rule: "rule-19-client-shared-controls",
      file,
      line,
      snippet: `${reason}: ${(sourceLines[line - 1] ?? "").trim().slice(0, 160)}`,
    });

  for (const match of code.matchAll(RULE_19_TAG)) {
    const tag = match[1];
    const attrs = parseJsxAttributes(code, match.index + match[0].length);
    if (!attrs) continue;
    const line = lineAt(match.index);
    const classes = classNameText(attrs.get("className"));

    if (tag === "button") {
      const role = literalAttr(attrs.get("role"));
      const pressable = literalAttr(attrs.get("data-pressable"));
      if (!RULE_19_RAW_BUTTON_ROLES.has(role) && !RULE_19_PRESSABLE_KINDS.has(pressable)) {
        hit(line, "raw <button> without a role or data-pressable; use Button, IconButton, or Chip");
      }
    } else if (tag === "input") {
      const type = literalAttr(attrs.get("type")) ?? "text";
      if (!RULE_19_RAW_INPUT_TYPES.has(type)) {
        hit(line, `raw <input type="${type}">; use TextInput or FormattedAmountInput`);
      }
    } else if (tag === "textarea") {
      hit(line, "raw <textarea>; use Textarea");
    } else if (tag === "select") {
      hit(line, "raw <select>; use NativeSelect");
    } else if (tag === "a" || tag === "Link") {
      if (RULE_19_BUTTON_LOOK.test(classes) && RULE_19_FILL_OR_BORDER.test(classes)) {
        hit(line, `<${tag}> styled as a button; use <Button asChild>`);
      }
    } else if (RULE_19_FAMILY.has(tag)) {
      const shapeClass = RULE_19_FAMILY_SHAPE_CLASS.exec(classes)?.[0].trim();
      if (shapeClass) {
        hit(line, `"${shapeClass}" on <${tag}>; shape and height come from emphasis and size`);
      }
    }
  }

  code.split("\n").forEach((text, index) => {
    const offScale = RULE_19_OFF_SCALE_RADIUS.exec(text)?.[0].replace(/^[\s"'`]/, "");
    if (offScale) hit(index + 1, `off-scale radius "${offScale}"; use the radius scale`);
  });

  for (const match of code.matchAll(RULE_19_RETIRED_BUTTON_IMPORT)) {
    hit(lineAt(match.index), "imports the retired client Button; use the shared Button");
  }

  return hits;
}

function scanRule19(files) {
  return files.flatMap((file) => scanRule19Source(file, readFile(file)));
}

// Rule 14: env keys are read by name. Vite inlines the whole env object into the bundle
// wherever `import.meta.env` is read whole (a default parameter, a cast, a computed key), and
// one value where a key is named. `.KEY`, `?.KEY`, and `!.KEY` are reads by name.
const RULE_14_WHOLE_ENV_READ = /\bimport\.meta\.env\b(?!\s*[!?]?\.\s*[A-Za-z_$])/g;

export function scanRule14Source(file, source) {
  const code = stripJsComments(source);
  const sourceLines = source.split("\n");
  return Array.from(code.matchAll(RULE_14_WHOLE_ENV_READ), (match) => {
    const line = code.slice(0, match.index).split("\n").length;
    return {
      rule: "rule-14-whole-env-read",
      file,
      line,
      snippet: (sourceLines[line - 1] ?? "").trim().slice(0, 200),
    };
  });
}

function scanRule14(files) {
  return files.flatMap((file) => scanRule14Source(file, readFile(file)));
}

const RULE_SCANNERS = {
  "rule-1-raw-timer": scanRule1,
  "rule-2-raw-addeventlistener": scanRule2,
  "rule-5-address-as-string": scanRule5,
  "rule-6-zustand-whole-state": scanRule6,
  "rule-11-undeclared-shared-import": scanRule11,
  "rule-14-whole-env-read": scanRule14,
  "rule-13-raw-tailwind-color": scanRule13,
  "rule-16-inline-alert-div": scanRule16,
  "rule-19-client-shared-controls": scanRule19,
};

// ---------------- ratchet baseline ----------------

const BASELINE_RELATIVE_PATH = relative(repoRoot, baselinePath);

export function countRatchetHits(hits) {
  const counts = {};
  for (const hit of hits) {
    if (!RATCHETED_RULES.has(hit.rule)) continue;
    counts[hit.rule] ??= {};
    counts[hit.rule][hit.file] = (counts[hit.rule][hit.file] ?? 0) + 1;
  }
  return sortCounts(counts);
}

function sortCounts(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((rule) => [
        rule,
        Object.fromEntries(Object.keys(counts[rule]).sort().map((file) => [file, counts[rule][file]])),
      ]),
  );
}

function eachCount(counts, visit) {
  for (const [rule, files] of Object.entries(counts ?? {})) {
    for (const [file, count] of Object.entries(files)) visit(rule, file, count);
  }
}

/** Counts above the baseline (grown, including files it does not list) and below it (stale). */
export function compareRatchet(baselineCounts, counts) {
  const grown = [];
  const stale = [];
  eachCount(counts, (rule, file, now) => {
    const was = baselineCounts?.[rule]?.[file] ?? 0;
    if (now > was) grown.push({ rule, file, was, now });
  });
  eachCount(baselineCounts, (rule, file, was) => {
    const now = counts?.[rule]?.[file] ?? 0;
    if (now < was) stale.push({ rule, file, was, now });
  });
  return { grown, stale };
}

/** Baseline counts above the base branch's copy; nothing when the base has no ratchet baseline. */
export function findRatchetBaselineGrowth(baselineCounts, previousCounts) {
  if (previousCounts === null) return [];
  const grown = [];
  eachCount(baselineCounts, (rule, file, now) => {
    const was = previousCounts[rule]?.[file] ?? 0;
    if (now > was) grown.push({ rule, file, was, now });
  });
  return grown;
}

export function shrinkRatchet(baselineCounts, counts) {
  const { grown } = compareRatchet(baselineCounts, counts);
  if (grown.length) throw new Error(`refusing to shrink: ${grown.length} count(s) grew`);
  const next = {};
  eachCount(baselineCounts, (rule, file, was) => {
    const now = Math.min(was, counts[rule]?.[file] ?? 0);
    if (now > 0) (next[rule] ??= {})[file] = now;
  });
  return sortCounts(next);
}

export function parseRatchetBaseline(source) {
  const document = JSON.parse(source);
  if (document?.version !== 1 || typeof document.counts !== "object") return null;
  return document.counts;
}

function readRatchetBaseline() {
  const counts = parseRatchetBaseline(readFileSync(baselinePath, "utf8"));
  if (counts === null) throw new Error(`${BASELINE_RELATIVE_PATH} is not a version 1 ratchet baseline`);
  return counts;
}

function writeRatchetBaseline(counts) {
  const document = {
    version: 1,
    note: "Shrink-only: per rule and file, the raw timers, raw listeners and address strings still allowed. Counts may go down, never up; record a lower count with `node scripts/quality/check-react-patterns.js --baseline-shrink`.",
    counts,
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(document, null, 2)}\n`);
}

// The base branch's baseline, when the base and that file resolve: the base CI's package workflows
// pass, then origin/develop. A shallow checkout without the base skips this comparison.
function readPreviousRatchetBaseline(argv) {
  const base = resolveGitBase({
    repoRoot,
    explicitBase: parseBaseArgs(argv).base,
    environmentVariables: ["REACT_PATTERNS_BASE_REF", "SOURCE_STRUCTURE_BASE_REF"],
  });
  if (!base) return { base: null, counts: null };
  const git = (args) => {
    try {
      return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };
  const ref = git(["merge-base", "HEAD", base]) || base;
  const source = git(["show", `${ref}:${BASELINE_RELATIVE_PATH}`]);
  if (!source) return { base, counts: null };
  try {
    return { base, counts: parseRatchetBaseline(source) };
  } catch {
    return { base, counts: null };
  }
}

// ---------------- main ----------------

function gatherAllHits({ includeAdvisory = true } = {}) {
  const allHits = gatherArchitectureHits();
  const fileLists = {};
  const enabledRules = includeAdvisory ? Object.keys(SCOPES) : [...BLOCKING_RULES, ...RATCHETED_RULES];

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
  const selectedMode = argv.includes("--baseline-shrink")
    ? "baseline-shrink"
    : argv.includes("--report")
      ? "report"
      : "lint";

  if (selectedMode === "report") {
    const hits = gatherAllHits();
    const summary = summarize(hits);
    console.log(JSON.stringify({ summary, total: hits.length, hits }, null, 2));
    return 0;
  }

  if (selectedMode === "baseline-shrink") {
    const counts = countRatchetHits(gatherAllHits({ includeAdvisory: false }));
    try {
      writeRatchetBaseline(shrinkRatchet(readRatchetBaseline(), counts));
    } catch (error) {
      console.error(`❌ check-react-patterns: ${error.message}. Fix the new hits first; the baseline only shrinks.`);
      return 1;
    }
    console.log(`Ratchet baseline shrunk: ${BASELINE_RELATIVE_PATH}`);
    return 0;
  }

  const scannedHits = gatherAllHits({ includeAdvisory: false });
  const allHits = scannedHits.filter((hit) => !RATCHETED_RULES.has(hit.rule));
  const ratchetFailures = ratchetFailureLines(scannedHits, argv);

  if (ratchetFailures.length > 0) {
    console.error(`\n❌ check-react-patterns: the debt ratchet failed (${BASELINE_RELATIVE_PATH}):`);
    for (const line of ratchetFailures) console.error(`  ${line}`);
  }

  if (allHits.length > 0) {
    console.error(`\n❌ check-react-patterns: ${allHits.length} blocking violation(s):`);
    for (const hit of allHits) {
      console.error(`  ${hit.rule} ${hit.file}:${hit.line}`);
      console.error(`    ${hit.snippet}`);
    }
    console.error(
      "\nRemediation: use a declared shared export, keep internal package dependencies within the explicit direction policy, move reusable exported hooks to shared, or document a narrow intentional exception in this checker.",
    );
    if (allHits.some((hit) => hit.rule === "rule-19-client-shared-controls")) {
      console.error(
        "Rule 19: use Button, IconButton, Chip, or a shared field primitive. A raw <button> that " +
          "is a card, row, scrim, photo, trigger, FAB, or tab declares it with data-pressable " +
          `(${[...RULE_19_PRESSABLE_KINDS].join(", ")}) or a role ` +
          `(${[...RULE_19_RAW_BUTTON_ROLES].join(", ")}).`,
      );
    }
    if (allHits.some((hit) => hit.rule === "rule-14-whole-env-read")) {
      console.error(
        "Rule 14: read env keys by name (import.meta.env.VITE_X). Vite inlines the whole env " +
          "object wherever import.meta.env is read whole; pass an object of named reads instead.",
      );
    }
  } else if (ratchetFailures.length === 0) {
    console.log(
      `✅ check-react-patterns: 0 blocking violations across ${BLOCKING_RULES.size} source-pattern rules plus package/export/hook boundary checks, and no ratcheted count above its baseline (${RATCHETED_RULES.size} rules).`,
    );
  }

  console.log("Other heuristic rules are quiet in lint mode; use --report for advisory analysis.");

  console.log("\nRule sources:");
  console.log("  .claude/rules/react-patterns.md  (Rules 1, 2, 6)");
  console.log("  .claude/rules/typescript.md      (Rules 5, 11, 14)");
  console.log("  .claude/rules/frontend-design.md (Rules 13, 16, 19)");
  console.log("  scripts/quality/check-react-patterns.js (package/export/hook boundaries)");

  return allHits.length > 0 || ratchetFailures.length > 0 ? 1 : 0;
}

function ratchetFailureLines(hits, argv) {
  const counts = countRatchetHits(hits);
  const baseline = readRatchetBaseline();
  const { grown, stale } = compareRatchet(baseline, counts);
  const lines = [];
  for (const item of grown) {
    const where = hits.filter((hit) => hit.rule === item.rule && hit.file === item.file).map((hit) => hit.line).join(", ");
    lines.push(`${item.rule} ${item.file}: ${item.now} hit(s) (lines ${where}), baseline allows ${item.was}; ${RATCHET_REMEDIATION[item.rule]}`);
  }
  if (stale.length) {
    lines.push(`${stale.length} count(s) fell below the baseline; record them with \`node scripts/quality/check-react-patterns.js --baseline-shrink\` and commit the baseline:`);
    for (const item of stale) lines.push(`  ${item.rule} ${item.file}: ${item.was} -> ${item.now}`);
  }
  const previous = readPreviousRatchetBaseline(argv);
  for (const item of findRatchetBaselineGrowth(baseline, previous.counts)) {
    lines.push(`${item.rule} ${item.file}: the baseline allows ${item.now}, above ${item.was} on ${previous.base}; the baseline may not grow`);
  }
  return lines;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) process.exit(main());
