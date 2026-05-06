#!/usr/bin/env node
/**
 * check-react-patterns.js
 *
 * Lint executor for `.claude/rules/react-patterns.md` and
 * `.claude/rules/typescript.md` rules that oxlint cannot express directly.
 *
 * Modeled on `scripts/quality/check-source-structure.js` and
 * `scripts/design/check-vocab.sh`. Regex-based — AST is overkill for v1.
 *
 * Rules enforced (severities controlled by --severity):
 *  - Rule 1   raw setTimeout / setInterval inside hooks (TS/TSX)
 *  - Rule 2   raw addEventListener without `{ once: true }` outside useEventListener
 *  - Rule 5   field/variable named like an Ethereum address typed as `string`
 *  - Rule 6   Zustand selector returning whole state `(state) => state`
 *  - Rule 11  deep `@green-goods/shared/...` imports (use the barrel)
 *  - Rule 13  raw Tailwind palette colors (frontend-design Rule 13)
 *  - Rule 16  inline alert-style divs that should use shared <Alert /> (frontend Rule 16)
 *
 * Modes:
 *   --report          emit JSON of all hits (no exit code), for tier triage
 *   --baseline-write  rewrite scripts/quality/data/lint-rules-baseline.json
 *   default           lint mode: fail on hits not in baseline
 *
 * Severity is per-rule via the SEVERITY map below. `error` exits 1, `warn`
 * prints but exits 0. Baselined hits never fail.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const baselinePath = resolve(repoRoot, "scripts/quality/data/lint-rules-baseline.json");

// Per-rule severity. Tier A = "error" (ship as fail-CI), Tier B = "warn" (baseline + reduce).
//
// Rationale (one-time-violation report on 2026-04-25):
//   rule-1-raw-timer             42 hits → warn  (manageable; baseline + drive to 0)
//   rule-2-raw-addeventlistener  61 hits → warn  (cleanup queue ~60 sites)
//   rule-5-address-as-string    265 hits → warn  (large cleanup; baseline)
//   rule-6-zustand-whole-state    0 hits → error (no current violations; lock the door)
//   rule-11-deep-barrel-import   <pop>   → warn  (counted at first run; baselined)
//   rule-13-raw-tailwind-color   45 hits → warn
//   rule-16-inline-alert-div     23 hits → warn
//
// Promotion path: as the baseline shrinks toward 0 for a rule, flip to "error" in a
// follow-up PR. Goal is zero baseline + zero new violations.
const SEVERITY = {
  "rule-1-raw-timer": "warn",
  "rule-2-raw-addeventlistener": "warn",
  "rule-5-address-as-string": "warn",
  "rule-6-zustand-whole-state": "error",
  "rule-11-deep-barrel-import": "warn",
  "rule-13-raw-tailwind-color": "warn",
  "rule-16-inline-alert-div": "warn",
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
  "rule-11-deep-barrel-import": ["packages/admin/src", "packages/client/src", "packages/agent/src"],
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
  // Deep imports from @green-goods/shared/<subpath>. Always wrong; no nuance.
  // ESM static imports + dynamic imports + re-exports.
  const re = /from\s+['"]@green-goods\/shared\/[^'"]+['"]|import\s*\(\s*['"]@green-goods\/shared\/[^'"]+['"]/;
  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (re.test(line)) {
        hits.push({
          rule: "rule-11-deep-barrel-import",
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
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

// ---------------- baseline ----------------

function loadBaseline() {
  if (!existsSync(baselinePath)) {
    return { rules: {} };
  }
  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function baselineKey(hit) {
  // Stable key: rule + file + snippet (line number drifts across edits).
  return `${hit.rule}::${hit.file}::${hit.snippet}`;
}

function isBaselined(hit, baseline) {
  const ruleEntry = baseline.rules?.[hit.rule];
  if (!ruleEntry) return false;
  const key = baselineKey(hit);
  return ruleEntry.entries.some((e) => `${hit.rule}::${e.file}::${e.snippet}` === key);
}

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
      "Auto-generated by `bun run lint:rules -- --baseline-write`. Existing violations grandfathered; new violations fail. Aim to drive every rule's count toward zero, then remove from this file. See .claude/rules/ for rule sources.",
    generatedAt: new Date().toISOString(),
    rules: grouped,
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  return baseline;
}

// ---------------- main ----------------

const args = process.argv.slice(2);
const mode = args.includes("--baseline-write")
  ? "baseline-write"
  : args.includes("--report")
    ? "report"
    : "lint";

function gatherAllHits() {
  const allHits = [];
  // Each scanner gets the file list for its scope.
  const fileLists = {};
  for (const [rule, scopes] of Object.entries(SCOPES)) {
    const key = JSON.stringify(scopes);
    if (!fileLists[key]) fileLists[key] = listFiles(scopes);
  }
  const rule1Files = fileLists[JSON.stringify(SCOPES["rule-1-raw-timer"])];
  const rule2Files = fileLists[JSON.stringify(SCOPES["rule-2-raw-addeventlistener"])];
  const rule5Files = fileLists[JSON.stringify(SCOPES["rule-5-address-as-string"])];
  const rule6Files = fileLists[JSON.stringify(SCOPES["rule-6-zustand-whole-state"])];
  const rule11Files = fileLists[JSON.stringify(SCOPES["rule-11-deep-barrel-import"])];
  const rule13Files = fileLists[JSON.stringify(SCOPES["rule-13-raw-tailwind-color"])];
  const rule16Files = fileLists[JSON.stringify(SCOPES["rule-16-inline-alert-div"])];
  allHits.push(...scanRule1(rule1Files));
  allHits.push(...scanRule2(rule2Files));
  allHits.push(...scanRule5(rule5Files));
  allHits.push(...scanRule6(rule6Files));
  allHits.push(...scanRule11(rule11Files));
  allHits.push(...scanRule13(rule13Files));
  allHits.push(...scanRule16(rule16Files));
  return allHits;
}

function summarize(hits) {
  const byRule = {};
  for (const hit of hits) {
    byRule[hit.rule] = (byRule[hit.rule] || 0) + 1;
  }
  return byRule;
}

if (mode === "report") {
  const hits = gatherAllHits();
  const summary = summarize(hits);
  console.log(JSON.stringify({ summary, total: hits.length, hits }, null, 2));
  process.exit(0);
}

if (mode === "baseline-write") {
  const hits = gatherAllHits();
  const baseline = writeBaseline(hits);
  const summary = summarize(hits);
  console.log("Baseline written:", baselinePath);
  console.log("Per-rule counts:");
  for (const [rule, count] of Object.entries(summary)) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log(`Total: ${hits.length}`);
  process.exit(0);
}

// Lint mode.
const baseline = loadBaseline();
const allHits = gatherAllHits();
const newHits = allHits.filter((h) => !isBaselined(h, baseline));

const errors = newHits.filter((h) => SEVERITY[h.rule] === "error");
const warnings = newHits.filter((h) => SEVERITY[h.rule] === "warn");

if (errors.length > 0) {
  console.error(`\n❌ check-react-patterns: ${errors.length} new error(s):`);
  for (const e of errors) {
    console.error(`  ${e.rule} ${e.file}:${e.line}`);
    console.error(`    ${e.snippet}`);
  }
}
if (warnings.length > 0) {
  console.warn(`\n⚠️  check-react-patterns: ${warnings.length} new warning(s):`);
  for (const w of warnings) {
    console.warn(`  ${w.rule} ${w.file}:${w.line}`);
    console.warn(`    ${w.snippet}`);
  }
}

const baselineCount = allHits.length - newHits.length;
if (baselineCount > 0) {
  console.log(
    `\nℹ️  ${baselineCount} grandfathered violation(s) in baseline (scripts/quality/data/lint-rules-baseline.json). Drive these to zero in dedicated cleanup PRs.`,
  );
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(
    `✅ check-react-patterns: 0 new violations across ${Object.keys(SEVERITY).length} rules${
      baselineCount ? ` (${baselineCount} baselined)` : ""
    }.`,
  );
}

console.log("\nRule sources:");
console.log("  .claude/rules/react-patterns.md  (Rules 1, 2, 6)");
console.log("  .claude/rules/typescript.md      (Rule 5)");
console.log("  .claude/rules/frontend-design.md (Rules 13, 16)");

process.exit(errors.length > 0 ? 1 : 0);
