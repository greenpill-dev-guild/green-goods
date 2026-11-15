#!/usr/bin/env node
// Comment policy for TypeScript, JavaScript and Solidity sources: which comments carry meaning a
// tool or a reader needs, and a codemod that removes the rest. TypeScript and JavaScript comments
// are found with Vite's Oxc parser, so strings, regular expressions, template literals and JSX
// text are never mistaken for them; Solidity comments with a scanner that skips string literals.
//
// Kept: licence headers, functional directives (compiler, linter, bundler, analyzer and repository
// markers), documentation on exported declarations and their members, type annotations in JSDoc,
// all NatSpec (with its @custom tags), reasons (why the code is this way: a consequence, a
// deliberate choice, a constraint an outside dependency forces), and comments that claim a
// constraint (important, temporary, a workaround, a warning against changing it), which
// `--report constraints` lists for the owner's review. Removed: everything else (narration,
// banners, commented-out code). The purge is idempotent, so re-running it on any
// branch resolves its own conflicts. Deployed contract sources (packages/contracts/src) are never
// rewritten.
//
//   node scripts/quality/comment-policy.mjs --write <path...>    purge the files or folders
//   node scripts/quality/comment-policy.mjs --check <path...>    exit 1 when a purge would change them
//   node scripts/quality/comment-policy.mjs --report constraints <path...>   JSON of claimed constraints
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "vite";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|sol)$/;
const DEPLOYED_CONTRACT_SOURCE = /^packages\/contracts\/src\//;

const LICENCE = /SPDX-License-Identifier|@license|@preserve|\bcopyright\b/i;
const DIRECTIVES = [
  /^\s*@ts-(expect-error|ignore|nocheck|check)\b/,
  /^\s*(eslint|oxlint)-(disable|enable)/,
  /^\s*eslint-env\b/,
  /^\s*(biome|prettier)-ignore\b/,
  /^\s*(istanbul|c8|v8) ignore\b/,
  /^\s*@vite-ignore\b/,
  /^\s*webpack[A-Z]\w*:/,
  /[#@]__(PURE|NO_SIDE_EFFECTS)__/,
  /^\s*@jsx(ImportSource|Runtime|Frag)?\b/,
  /^\s*@(vitest|jest)-environment\b/,
  /^\s*(global|exported)\s/,
  /^\s*@refresh\b/,
  /^\/\s*<reference\b/,
  /^\s*TEST-QUALITY:/,
  /^\s*design-guard:\s*allow-/,
];
const SOLIDITY_DIRECTIVES = [/^\s*(solhint|slither)-(disable|enable)/, /^\s*(forge-lint|forge-fmt|forgefmt):/];
// A comment that claims the code around it must stay as it is, for a reason the code cannot show.
const PLATFORM_TERMS = ["safari", "webkit", "ios", "ipados", "android", "chrome", "chromium", "firefox", "brave", "mv3", "manifest v3", "service worker", "indexeddb", "webauthn", "passkey", "vercel", "fly", "github", "cloudflare", "telegram", "whatsapp", "linear", "foundry", "forge", "solc", "via-ir", "via ir", "arbitrum", "gnosis", "celo", "sepolia", "mainnet", "ipfs", "metamask", "safe", "erc-4337", "eip-712", "node", "bun", "browser", "os"];

let dependencyTerms;
/** Lower-case names of every dependency the repository declares, and of each scope and package part. */
export function externalTerms(root = repoRoot) {
  if (dependencyTerms) return dependencyTerms;
  const manifests = execFileSync("git", ["-C", root, "ls-files", "--", "package.json", "*/package.json", "*/*/package.json"], { encoding: "utf8" }).split("\n").filter(Boolean);
  const names = new Set(PLATFORM_TERMS);
  for (const manifest of manifests) {
    const json = JSON.parse(readFileSync(resolve(root, manifest), "utf8"));
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(json[field] ?? {})) {
        if (name.startsWith("@green-goods/")) continue;
        names.add(name.toLowerCase());
        for (const part of name.replace(/^@/, "").split("/")) if (part.length > 2) names.add(part.toLowerCase());
      }
    }
  }
  const escaped = [...names].sort((a, b) => b.length - a.length).map((term) => term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
  dependencyTerms = new RegExp(`(^|[^\\w@/-])(${escaped.join("|")})(?![\\w-])`, "i");
  return dependencyTerms;
}

// A comment that claims the code around it must stay as it is: important, temporary, a workaround,
// a warning against changing it. Each one goes to the owner's review table (`--report
// constraints`), where it is kept, dropped, or encoded as a type, test or lint.
const CLAIM = /\b(important|temporar(y|ily)|workarounds?|work around|hacky?|do not|don't|never|must|should not|shouldn't|may not|has to|have to|keep (this|these|it|them|the)\b|order matters|todo|fixme|xxx|remove (this|once|when|after)|until\b)/i;
// A reason, a consequence or a deliberate choice: why the code is this way rather than another.
// Not narration, so the purge keeps it; a named dependency with one is a dependency constraint.
const REASON = /\b(because|since|so|so that|otherwise|would|without|unless|requires?|required|needs?|demands?|expects?|rejects?|refuses?|breaks?|broke|crash(es|ed)?|fails?|failed|throws?|bugs?|quirks?|only|cannot|can't|won't|doesn't|does not|rather than|instead|on purpose|deliberately|intentionally|by design|the whole point|load-bearing)\b/i;

/**
 * The kind a remaining comment takes: "constraint" for a claim the owner reviews, "dependency" for
 * a reason an outside tool or platform forces, "rationale" for any other reason, else "remove".
 */
function constraintKind(text) {
  if (CLAIM.test(text)) return "constraint";
  if (!REASON.test(text)) return "remove";
  return externalTerms().test(text) ? "dependency" : "rationale";
}
const JSDOC_TYPES = /@(type|param\s*\{|returns?\s*\{|typedef|template|satisfies|import|callback|property\s*\{|enum|deprecated|overload)\b/;

function languageOf(file) {
  if (file.endsWith(".tsx")) return "tsx";
  if (file.endsWith(".jsx")) return "jsx";
  if (/\.(ts|mts|cts)$/.test(file)) return "ts";
  return "js";
}

// Spans of exported declarations: documentation inside one, or right before one, is API documentation.
function exportedSpans(program) {
  const spans = [];
  let previousEnd = 0;
  for (const statement of program.body) {
    if (/^Export(Named|Default|All)Declaration$/.test(statement.type) || statement.type === "TSExportAssignment") {
      spans.push([previousEnd, statement.end]);
    }
    previousEnd = statement.end;
  }
  return spans;
}

export function classifyComment(comment, { exported }) {
  const text = comment.value;
  const doc = comment.type === "Block" && text.startsWith("*");
  if (LICENCE.test(text) || (comment.type === "Block" && text.startsWith("!"))) return "licence";
  if (DIRECTIVES.some((pattern) => pattern.test(text))) return "directive";
  if (doc && (exported || JSDOC_TYPES.test(text))) return "documentation";
  return constraintKind(text);
}

// A directive or licence line applies on its own, so it never joins a run.
const scriptStandalone = (value) => LICENCE.test(value) || DIRECTIVES.some((pattern) => pattern.test(value));

/**
 * Comments as readers see them: a run of line comments on consecutive lines is one comment, unless
 * a line stands alone or `joins` keeps two kinds apart.
 */
export function groupComments(code, comments, { standalone = scriptStandalone, joins = () => true } = {}) {
  const groups = [];
  for (const comment of comments) {
    const last = groups.at(-1);
    const between = last ? code.slice(last.end, comment.start) : null;
    if (last && last.type === "Line" && comment.type === "Line" && /^[ \t]*\n[ \t]*$/.test(between) &&
      !code.slice(lineStart(code, comment.start), comment.start).trim() &&
      !standalone(comment.value) && !standalone(last.lastValue) && joins(last.lastValue, comment.value)) {
      last.end = comment.end;
      last.value += `\n${comment.value}`;
      last.lastValue = comment.value;
    } else groups.push({ type: comment.type, value: comment.value, lastValue: comment.value, start: comment.start, end: comment.end });
  }
  return groups;
}

/** Comments in Solidity source, found lexically: string, unicode and hex literals are skipped. */
export function solidityComments(code) {
  const comments = [];
  for (let index = 0; index < code.length; index++) {
    const char = code[index];
    if (char === '"' || char === "'") {
      for (index++; index < code.length && code[index] !== char && code[index] !== "\n"; index++) {
        if (code[index] === "\\") index++;
      }
    } else if (char === "/" && code[index + 1] === "/") {
      const end = lineEnd(code, index);
      comments.push({ type: "Line", value: code.slice(index + 2, end), start: index, end });
      index = end - 1;
    } else if (char === "/" && code[index + 1] === "*") {
      const close = code.indexOf("*/", index + 2);
      const end = close < 0 ? code.length : close + 2;
      comments.push({ type: "Block", value: code.slice(index + 2, close < 0 ? end : close), start: index, end });
      index = end - 1;
    }
  }
  return comments;
}

const isNatSpec = (comment) => (comment.type === "Line" ? comment.value.startsWith("/") : comment.value.startsWith("*"));

export function classifySolidityComment(comment) {
  const text = comment.value;
  if (/SPDX-License-Identifier/.test(text)) return "licence";
  if (SOLIDITY_DIRECTIVES.some((pattern) => pattern.test(text))) return "directive";
  // NatSpec documents the contract surface and carries tooling tags such as @custom:oz-upgrades.
  if (isNatSpec(comment)) return "documentation";
  return constraintKind(text);
}

function classifySoliditySource(code) {
  const standalone = (value) => /SPDX-License-Identifier/.test(value) || SOLIDITY_DIRECTIVES.some((pattern) => pattern.test(value));
  // A NatSpec line (`///`) and a plain line (`//`) never join: they are different kinds of comment.
  const joins = (previous, next) => previous.startsWith("/") === next.startsWith("/");
  return groupComments(code, solidityComments(code), { standalone, joins }).map((comment) => ({
    ...comment,
    kind: classifySolidityComment(comment),
  }));
}

/** Every comment in a source with its class. */
export function classifySource(code, file) {
  if (file.endsWith(".sol")) return classifySoliditySource(code);
  const { program, comments, errors } = parseSync(file, code, { lang: languageOf(file), sourceType: "module" });
  if (errors.length) throw new Error(`${file}: does not parse (${errors[0].message})`);
  const spans = exportedSpans(program);
  // Oxc also reports a hashbang (`#!/usr/bin/env node`) as a line comment; it is the program's, not a comment.
  const real = comments.filter((comment) => comment.start !== program.hashbang?.start);
  return groupComments(code, real).map((comment) => ({
    ...comment,
    kind: classifyComment(comment, { exported: spans.some(([start, end]) => comment.start >= start && comment.end <= end) }),
  }));
}

function lineStart(code, index) {
  return code.lastIndexOf("\n", index - 1) + 1;
}

function lineEnd(code, index) {
  const end = code.indexOf("\n", index);
  return end < 0 ? code.length : end;
}

// The span a removal takes: a whole line when the comment is alone on it, a JSX container that holds
// only the comment, or the comment and the spaces before it.
function removalSpan(code, comment) {
  const start = lineStart(code, comment.start);
  const end = lineEnd(code, comment.end);
  if (!code.slice(start, comment.start).trim() && !code.slice(comment.end, end).trim()) {
    return [start, Math.min(end + 1, code.length)];
  }
  const before = code.slice(0, comment.start).match(/\{\s*$/);
  const after = code.slice(comment.end).match(/^\s*\}/);
  if (before && after) {
    const open = comment.start - before[0].length;
    const close = comment.end + after[0].length;
    if (!code.slice(lineStart(code, open), open).trim() && !code.slice(close, lineEnd(code, close)).trim()) {
      return [lineStart(code, open), Math.min(lineEnd(code, close) + 1, code.length)];
    }
    return [open, close];
  }
  let from = comment.start;
  while (from > start && /[ \t]/.test(code[from - 1])) from--;
  return [from, comment.end];
}

/** The source with every removable comment taken out, and what was removed. */
export function purgeSource(code, file) {
  const comments = classifySource(code, file);
  const removed = comments.filter((comment) => comment.kind === "remove");
  let output = code;
  for (const comment of [...removed].sort((a, b) => b.start - a.start)) {
    const [from, to] = removalSpan(output, comment);
    output = output.slice(0, from) + output.slice(to);
  }
  output = output.replace(/\n{3,}/g, "\n\n");
  return { code: output, removed, kept: comments.filter((comment) => comment.kind !== "remove") };
}

function sourceFiles(paths) {
  const files = execFileSync("git", ["-C", repoRoot, "ls-files", "-z", "--", ...paths], { encoding: "utf8" }).split("\0");
  return files.filter((file) => SOURCE.test(file) && !/\.d\.[cm]?ts$/.test(file) && !/(^|\/)(generated|vendor|dist|node_modules)\//.test(file));
}

function lineOf(code, index) {
  return code.slice(0, index).split("\n").length;
}

export function main(argv = process.argv.slice(2)) {
  const mode = argv[0];
  const paths = argv.slice(mode === "--report" ? 2 : 1).map((path) => relative(repoRoot, resolve(path)) || ".");
  if (!["--write", "--check", "--report"].includes(mode) || !paths.length) {
    console.error("usage: comment-policy.mjs --write|--check <path...> | --report constraints <path...>");
    return 2;
  }
  const changed = [];
  const constraints = [];
  let dependencies = 0;
  let rationale = 0;
  const skipped = [];
  for (const file of sourceFiles(paths)) {
    if (DEPLOYED_CONTRACT_SOURCE.test(file)) {
      skipped.push(file);
      continue;
    }
    const absolute = resolve(repoRoot, file);
    if (!statSync(absolute, { throwIfNoEntry: false })) continue;
    const code = readFileSync(absolute, "utf8");
    const result = purgeSource(code, file);
    dependencies += result.kept.filter((entry) => entry.kind === "dependency").length;
    rationale += result.kept.filter((entry) => entry.kind === "rationale").length;
    for (const comment of result.kept.filter((entry) => entry.kind === "constraint")) {
      constraints.push({ file, line: lineOf(code, comment.start), text: code.slice(comment.start, comment.end) });
    }
    if (result.code === code) continue;
    changed.push({ file, removed: result.removed.length });
    if (mode === "--write") writeFileSync(absolute, result.code);
  }
  if (mode === "--report") {
    console.log(JSON.stringify({ constraints }, null, 2));
    return 0;
  }
  const total = changed.reduce((sum, entry) => sum + entry.removed, 0);
  console.log(`${mode === "--write" ? "Removed" : "Would remove"} ${total} comment(s) from ${changed.length} file(s); ${constraints.length} claimed constraint(s) kept for review; ${dependencies} dependency constraint(s) and ${rationale} reason(s) kept.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} deployed contract source file(s) under packages/contracts/src.`);
  return mode === "--check" && changed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
