#!/usr/bin/env node
// Comment policy for TypeScript, JavaScript and Solidity sources, and the codemod for its narrow
// first pass. TypeScript and JavaScript comments are found with Vite's Oxc parser, so strings,
// regular expressions, template literals and JSX text are never mistaken for them; Solidity
// comments with a scanner that skips string literals.
//
// The narrow pass removes four kinds: banners, commented-out code, labels (a heading of a few
// words) and notes that only restate the name they sit on. Everything else stays for a triage
// pass that moves each comment into a type, test or lint, or the docs, or keeps or deletes it:
// licence headers, directives (compiler, linter, bundler, analyzer and repository markers),
// documentation on exported declarations and JSDoc types, all NatSpec, claimed constraints,
// reasons, and narration. `--report triage` lists what that pass reads and `--report
// constraints` the claims. The purge is idempotent, leaves rendered JSX text as it was, writes
// nothing when any file fails to parse, and never rewrites deployed contract sources
// (packages/contracts/src).
//
//   node scripts/quality/comment-policy.mjs --write <path...>    purge the files or folders
//   node scripts/quality/comment-policy.mjs --check <path...>    exit 1 when a purge would change them
//   node scripts/quality/comment-policy.mjs --report constraints|triage <path...>   JSON for review
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "vite";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|sol)$/;
const DEPLOYED_CONTRACT_SOURCE = /^packages\/contracts\/src\//;

const LICENCE = /SPDX-License-Identifier|@license|@preserve|\bcopyright\b|\blicen[cs]ed under\b|\b(apache|mit|bsd|isc|mpl|gpl|lgpl|agpl)(-\d(\.\d)?)?\s+licen[cs]e\b|\bapache-2\.0\b/i;
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
  // Read by check-direct-tested-seams.mjs, the Shared test graph and check-staged-modules.mjs.
  /@direct-test-(command|subject)\b/,
  /@shared-graph\b/,
  /Staged — not yet wired into the live checkout\./,
  // A governed test skip, which check-test-quality.sh reads in the lines above `.skip(` or `.only(`.
  /^\s*SKIP:.*#\d+/,
  /^\s*Owner:.*Expiry:/i,
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
const CLAIM = /\b(important|temporar(y|ily)|workarounds?|work around|hacky?|do not|don't|never|must|should not|shouldn't|may not|has to|have to|keep (this|these|it|them|the)\b|order matters|ensures?\b|make sure|(load|import|register|mock|install|initiali[sz]e|set up|call|run)(s|ed|ing)? (before|after|first)\b|todo|fixme|xxx|remove (this|once|when|after)|until\b)/i;
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
// The JSDoc tags TypeScript reads when it checks JavaScript, with their aliases.
const JSDOC_TYPES = /@((type|typedef|template|satisfies|import|callback|enum|deprecated|overload|this|extends|augments|implements|class|constructor|public|private|protected|readonly|override)\b|(param|arg|argument|returns?|property|prop)\s*\{)/;

/** What the narrow pass removes; every other kind waits for the triage pass. */
export const REMOVED_KINDS = new Set(["banner", "code", "label", "restatement"]);

// Rule characters: ASCII punctuation, box drawing, the em and en dashes, middle dots and bullets.
const RULE_CHARS = "-=*#~_+/\\\\|.\\u2500-\\u257f\\u2013\\u2014\\u00b7\\u2022";
const RULE_LINE = new RegExp(`^[${RULE_CHARS}]{3,}$`);
const TITLED_RULE = new RegExp(`^[${RULE_CHARS}]{2,}\\s+\\S.{0,60}?\\s+[${RULE_CHARS}]{2,}$`);

/** A heading of one to three words with no sentence punctuation: `// Helpers`, `// Public API:`. */
function isLabel(text) {
  const line = text.trim();
  return /^[A-Za-z][\w &/'()-]*:?$/.test(line) && line.split(/\s+/).length <= 3;
}

/** Rules of punctuation, alone or around a title (`// ==== Helpers ====`), over one or more lines. */
function isBanner(text) {
  const lines = commentLines(text).map((line) => line.trim()).filter(Boolean);
  const rule = (line) => RULE_LINE.test(line) || TITLED_RULE.test(line);
  return lines.some(rule) && lines.every((line) => rule(line) || isLabel(line));
}

const CODE_HINT = /[;{}]|=>|^\s*<\/?[A-Za-z]|\b(const|let|var|return|import|export|await)\b|[\w)]\(.*\)\s*;?\s*$/m;

/**
 * Code a comment holds instead of running: it parses as statements, an expression or JSX. Prose
 * that happens to parse as a label (`TODO: fix()`, `Note: x()`) is not code.
 */
function isCommentedOutCode(text) {
  const body = commentLines(text).join("\n").trim();
  if (!body || !CODE_HINT.test(body)) return false;
  // An object wrapper only for what ends like a property list (`foo: bar,`): it would read
  // any `Word: text` as a property.
  const candidates = [body, `(${body}\n)`, ...(/,\s*$/.test(body) ? [`({${body}\n})`] : [])];
  return candidates.some((candidate) => {
    const { program, errors } = parseSync("comment.tsx", candidate, { lang: "tsx", sourceType: "module" });
    return !errors.length && program.body.length > 0 && program.body.every((statement) => statement.type !== "LabeledStatement") && !isNotation(program);
  });
}

// One value or a mapping from a name to a value (`key => false`, a template showing a key's format)
// reads as notation in prose, not as code taken out.
function isNotation(program) {
  const unwrap = (node) => (node?.type === "ParenthesizedExpression" ? unwrap(node.expression) : node);
  const only = program.body.length === 1 && program.body[0].type === "ExpressionStatement" ? unwrap(program.body[0].expression) : null;
  const simple = (node) => ["Identifier", "Literal", "StringLiteral", "NumericLiteral", "TemplateLiteral"].includes(unwrap(node)?.type);
  return simple(only) || (only?.type === "ArrowFunctionExpression" && simple(only.body));
}

/** Solidity code in a comment: every line ends a statement or a block, and one assigns or calls. */
function isSolidityCode(text) {
  const lines = commentLines(text).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /[;{}]$/.test(line)) && lines.some((line) => /[=(]/.test(line));
}

const STOP_WORDS = new Set(
  ("a an the this that these those of for to in on at by with from as is are was be been it its and or into via per each new " +
    "current given function method helper handler callback component hook class type interface constant variable value property " +
    "prop field get gets return returns set sets create creates make makes handle handles render renders use uses do does").split(" "),
);
const stem = (word) => word.replace(/ies$/, "y").replace(/(es|s|ed|ing)$/, "");
const wordsOf = (text) =>
  text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** A short note whose every word is in the name it sits on, or a stop word: `// Get the user` on `getUser`. */
function restatesName(text, name) {
  if (!name) return false;
  const nameWords = new Set(wordsOf(name).map(stem));
  const words = wordsOf(text);
  return words.length > 0 && words.length <= 8 && words.filter((word) => !STOP_WORDS.has(word)).every((word) => nameWords.has(stem(word)));
}

const DECLARATIONS = [
  /\b(?:function\*?|class|interface|type|enum|namespace|struct|event|modifier|error|contract|library)\s+([A-Za-z_$][\w$]*)/,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
  /^\s*<([A-Z][\w$.]*)/,
  /^\s*(?:(?:export|default|public|private|protected|static|readonly|async|override|abstract|declare|get|set)\s+)*([A-Za-z_$][\w$]*)\s*[?!]?\s*[(:=]/,
];
const NOT_NAMES = new Set(["if", "for", "while", "switch", "return", "await", "catch", "case", "default", "else", "try", "throw", "require", "assert", "emit"]);

/** The name a comment sits on: the code before it on its line, or else the next line of code past any comments. */
function subjectName(code, comment) {
  const declared = (line) => {
    for (const pattern of DECLARATIONS) {
      const name = line.match(pattern)?.[1];
      if (name) return NOT_NAMES.has(name) ? null : name;
    }
    return null;
  };
  const before = code.slice(lineStart(code, comment.start), comment.start);
  if (before.trim()) return declared(before);
  for (let from = comment.end; from < code.length; ) {
    const end = lineEnd(code, from);
    const line = code.slice(from, end);
    if (line.trim() && !/^\s*(\/\/|\/\*|\*)/.test(line)) return declared(line);
    from = end + 1;
  }
  return null;
}

/** A comment no tool reads: a claim or a reason stays; else one of the removed kinds, or narration. */
function narrowKind(text, name) {
  const kind = constraintKind(text);
  if (kind !== "remove") return kind;
  if (isBanner(text)) return "banner";
  const body = commentLines(text).map((line) => line.trim()).filter(Boolean).join(" ");
  if (isLabel(body)) return "label";
  if (restatesName(body, name)) return "restatement";
  return "narration";
}

// A rule of punctuation stands alone, so a banner never hides inside the note under it.
const isRuleLine = (value) => RULE_LINE.test(value.trim()) || TITLED_RULE.test(value.trim());

function languageOf(file) {
  if (file.endsWith(".tsx")) return "tsx";
  if (file.endsWith(".jsx")) return "jsx";
  if (/\.(ts|mts|cts)$/.test(file)) return "ts";
  return "js";
}

// Spans of exported declarations: documentation inside one, or right before one, is API documentation.
function declaredNames(statement) {
  if (statement.type === "VariableDeclaration") return statement.declarations.map((declaration) => declaration.id?.name).filter(Boolean);
  return statement.id?.name ? [statement.id.name] : [];
}

function exportedSpans(program) {
  // Names a later `export { a, b }` or `export default a` makes public: their declarations are API too.
  const exportedLater = new Set();
  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration" && !statement.declaration && !statement.source) {
      for (const specifier of statement.specifiers) if (specifier.local?.name) exportedLater.add(specifier.local.name);
    }
    if (statement.type === "ExportDefaultDeclaration" && statement.declaration?.type === "Identifier") {
      exportedLater.add(statement.declaration.name);
    }
    if (statement.type === "TSExportAssignment" && statement.expression?.type === "Identifier") exportedLater.add(statement.expression.name);
  }
  const spans = [];
  let previousEnd = 0;
  for (const statement of program.body) {
    const exported = /^Export(Named|Default|All)Declaration$/.test(statement.type) || statement.type === "TSExportAssignment" ||
      declaredNames(statement).some((name) => exportedLater.has(name));
    if (exported) spans.push([previousEnd, statement.end]);
    previousEnd = statement.end;
  }
  return spans;
}

// JSX children that hold only comments (`{/* note */}`): removing the comment removes the braces
// too. One between two runs of text is marked: JSX trims each run on its own, so joining them
// changes what renders (`a{/* c */}` then `b` on the next line renders "ab"; without it, "a b").
function emptyJsxContainers(program) {
  const containers = [];
  const hasText = (node) => node?.type === "JSXText" && /\S/.test(node.value);
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      node.children.forEach((child, index) => {
        if (child.type !== "JSXExpressionContainer" || child.expression?.type !== "JSXEmptyExpression") return;
        const betweenText = hasText(node.children[index - 1]) && hasText(node.children[index + 1]);
        containers.push({ span: [child.start, child.end], betweenText });
      });
    }
    for (const value of Object.values(node)) if (value && typeof value === "object") visit(value);
  };
  visit(program);
  return containers;
}

/** The comment's lines without the leading `*` a block comment's lines carry. */
function commentLines(text) {
  return text.split("\n").map((line) => line.replace(/^\s*\*+\s?/, ""));
}

const isDirective = (text, patterns = DIRECTIVES) =>
  [text, ...commentLines(text)].some((line) => patterns.some((pattern) => pattern.test(line)));

export function classifyComment(comment, { exported, name = null, marksIntent = false }) {
  const text = comment.value;
  const doc = comment.type === "Block" && text.startsWith("*");
  if (LICENCE.test(text) || (comment.type === "Block" && text.startsWith("!"))) return "licence";
  if (isDirective(text)) return "directive";
  if (doc && (exported || JSDOC_TYPES.test(text))) return "documentation";
  const kind = isCommentedOutCode(text) ? "code" : narrowKind(text, name);
  return marksIntent && REMOVED_KINDS.has(kind) ? "narration" : kind;
}

/**
 * A comment the narrow pass keeps whatever it says, since its place carries the meaning: the end of
 * a line of code, where it annotates that line (`chainId: 11155111, // Sepolia`, a test case's
 * `// Missing 0x`), not a heading; or the whole content of a block (`catch { // Ignore errors }`
 * says the swallow is deliberate; without it the empty block reads as a mistake). JSX comment
 * containers are not blocks.
 */
function marksIntent(code, comment, { inJsxContainer = false } = {}) {
  const before = code.slice(lineStart(code, comment.start), comment.start);
  const afterOnLine = code.slice(comment.end, lineEnd(code, comment.end));
  if (before.trim() && !afterOnLine.trim()) return true;
  if (inJsxContainer) return false;
  return /[{[]$/.test(code.slice(0, comment.start).trimEnd()) && /^[}\]]/.test(code.slice(comment.end).trimStart());
}

// A directive or licence line applies on its own, so it never joins a run.
const scriptStandalone = (value) => LICENCE.test(value) || DIRECTIVES.some((pattern) => pattern.test(value)) || isRuleLine(value);

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

export function classifySolidityComment(comment, { name = null, marksIntent = false } = {}) {
  const text = comment.value;
  if (LICENCE.test(text)) return "licence";
  if (isDirective(text, SOLIDITY_DIRECTIVES)) return "directive";
  // NatSpec documents the contract surface and carries tooling tags such as @custom:oz-upgrades.
  if (isNatSpec(comment)) return "documentation";
  const kind = isSolidityCode(text) ? "code" : narrowKind(text, name);
  return marksIntent && REMOVED_KINDS.has(kind) ? "narration" : kind;
}

function classifySoliditySource(code) {
  const standalone = (value) => LICENCE.test(value) || isDirective(value, SOLIDITY_DIRECTIVES) || isRuleLine(value);
  // A NatSpec line (`///`) and a plain line (`//`) never join: they are different kinds of comment.
  const joins = (previous, next) => previous.startsWith("/") === next.startsWith("/");
  return groupComments(code, solidityComments(code), { standalone, joins }).map((comment) => ({
    ...comment,
    kind: classifySolidityComment(comment, { name: subjectName(code, comment), marksIntent: marksIntent(code, comment) }),
  }));
}

// A `.cjs` file may `return` at its top level, which module parsing rejects, and so may a `.js`
// file in a CommonJS package; module syntax fails as CommonJS. A `.js` file may hold JSX. The
// extension's reading goes first.
function parse(file, code) {
  let failure;
  const langs = languageOf(file) === "js" ? ["js", "jsx"] : [languageOf(file)];
  for (const lang of langs) {
    for (const sourceType of /\.c[jt]s$/.test(file) ? ["commonjs", "module"] : ["module", "commonjs"]) {
      const result = parseSync(file, code, { lang, sourceType });
      if (!result.errors.length) return result;
      failure ??= result.errors[0];
    }
  }
  throw new Error(`${file}: does not parse (${failure.message})`);
}

/** Every comment in a source with its class. */
export function classifySource(code, file) {
  if (file.endsWith(".sol")) return classifySoliditySource(code);
  const { program, comments } = parse(file, code);
  const spans = exportedSpans(program);
  const containers = emptyJsxContainers(program);
  // Oxc also reports a hashbang (`#!/usr/bin/env node`) as a line comment; it is the program's, not a comment.
  const real = comments.filter((comment) => comment.start !== program.hashbang?.start);
  return groupComments(code, real).map((comment) => {
    const holder = containers.find(({ span: [start, end] }) => comment.start > start && comment.end < end);
    return {
      ...comment,
      container: holder?.span ?? null,
      betweenText: holder?.betweenText ?? false,
      kind: classifyComment(comment, {
        exported: spans.some(([start, end]) => comment.start >= start && comment.end <= end),
        name: subjectName(code, comment),
        marksIntent: marksIntent(code, comment, { inJsxContainer: Boolean(holder) }),
      }),
    };
  });
}

/**
 * JSX text as React receives it (Babel's whitespace rule): each line trimmed where it meets
 * another line, lines with nothing left dropped, and the rest joined by one space.
 */
function jsxText(value) {
  const lines = value.split(/\r\n|\n|\r/);
  let lastFilled = -1;
  lines.forEach((line, index) => {
    if (/[^ \t]/.test(line)) lastFilled = index;
  });
  let text = "";
  lines.forEach((line, index) => {
    let piece = line.replace(/\t/g, " ");
    if (index > 0) piece = piece.replace(/^ +/, "");
    if (index < lines.length - 1) piece = piece.replace(/ +$/, "");
    if (piece) text += index === lastFilled ? piece : `${piece} `;
  });
  return text;
}

/** Each JSX element's children as rendered: text, or the kind of child; empty containers render nothing. */
function jsxChildren(program) {
  const elements = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      elements.push(
        node.children.flatMap((child) => {
          if (child.type === "JSXText") return jsxText(child.value) ? [JSON.stringify(jsxText(child.value))] : [];
          if (child.type === "JSXExpressionContainer" && child.expression?.type === "JSXEmptyExpression") return [];
          return [child.type];
        }).join(","),
      );
    }
    for (const value of Object.values(node)) if (value && typeof value === "object") visit(value);
  };
  visit(program);
  return elements.join("\n");
}

function lineStart(code, index) {
  return code.lastIndexOf("\n", index - 1) + 1;
}

function lineEnd(code, index) {
  const end = code.indexOf("\n", index);
  return end < 0 ? code.length : end;
}

// What a removal takes and leaves: a whole line when the comment is alone on it, the JSX container
// that holds only comments, or the comment itself, with a space where deleting it would join two
// tokens (`return/* x */value` stays `return value`).
function removal(code, comment) {
  if (comment.container) {
    const [open, close] = comment.container;
    if (!code.slice(lineStart(code, open), open).trim() && !code.slice(close, lineEnd(code, close)).trim()) {
      return { from: lineStart(code, open), to: Math.min(lineEnd(code, close) + 1, code.length), text: "" };
    }
    return { from: open, to: close, text: "" };
  }
  const start = lineStart(code, comment.start);
  const end = lineEnd(code, comment.end);
  if (!code.slice(start, comment.start).trim() && !code.slice(comment.end, end).trim()) {
    return { from: start, to: Math.min(end + 1, code.length), text: "" };
  }
  let from = comment.start;
  while (from > start && /[ \t]/.test(code[from - 1])) from--;
  // A line terminator inside the comment can end a statement (`return/* x\n*/value` returns nothing),
  // so one stays. JavaScript has four: line feed, carriage return, and U+2028 and U+2029.
  if (/[\n\r\u2028\u2029]/.test(code.slice(comment.start, comment.end))) return { from, to: comment.end, text: "\n" };
  const joins = from > 0 && /\S/.test(code[from - 1]) && /\S/.test(code[comment.end] ?? "");
  return { from, to: comment.end, text: joins ? " " : "" };
}

/**
 * The source with every removable comment taken out, and what was removed. A comment in a JSX
 * container between two runs of text stays, since taking the braces out joins the runs; and when
 * removing the file's containers would still change any element's rendered children (a space
 * between a value and a comment container at a line end, say), every container in the file stays.
 */
export function purgeSource(code, file) {
  const comments = classifySource(code, file);
  let result = removeComments(code, comments, false);
  if (/\.[cm]?[jt]sx?$/.test(file) && result.code !== code && jsxChildren(parse(file, code).program) !== jsxChildren(parse(file, result.code).program)) {
    result = removeComments(code, comments, true);
  }
  return result;
}

function removeComments(code, comments, keepContainers) {
  const removable = (comment) => REMOVED_KINDS.has(comment.kind) && !comment.betweenText && !(keepContainers && comment.container);
  const removed = comments.filter(removable);
  // A JSX container goes only when every comment in it goes, and only once.
  const keptContainers = new Set(comments.filter((comment) => !removable(comment) && comment.container).map((comment) => comment.container[0]));
  const removedContainers = new Set();
  let output = code;
  for (const comment of [...removed].sort((a, b) => b.start - a.start)) {
    const container = comment.container && !keptContainers.has(comment.container[0]) ? comment.container : null;
    if (container && removedContainers.has(container[0])) continue;
    if (container) removedContainers.add(container[0]);
    const { from, to, text } = removal(output, { ...comment, container });
    output = output.slice(0, from) + text + output.slice(to);
    // Close the gap a removed line leaves, at that point only: blank lines elsewhere (a template
    // literal's included) are not the codemod's to change.
    while (output[from] === "\n" && (from === 0 || (output[from - 1] === "\n" && output[from - 2] === "\n"))) {
      output = output.slice(0, from) + output.slice(from + 1);
    }
  }
  return { code: output, removed, kept: comments.filter((comment) => !removable(comment)) };
}

/** Source files under the paths: tracked ones and new ones not yet added, never what Git ignores. */
export function sourceFiles(paths, { root = repoRoot, env = process.env } = {}) {
  const listed = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...paths], { encoding: "utf8", env }).split("\0");
  return [...new Set(listed)].filter((file) => SOURCE.test(file) && !/\.d\.[cm]?ts$/.test(file) && !/(^|\/)(generated|vendor|dist|node_modules)\//.test(file));
}

function lineOf(code, index) {
  return code.slice(0, index).split("\n").length;
}

// The kinds the triage pass reads: what no tool needs and the narrow pass leaves.
const TRIAGE_KINDS = new Set(["constraint", "dependency", "rationale", "narration"]);

export function main(argv = process.argv.slice(2), { root = repoRoot, env = process.env } = {}) {
  const mode = argv[0];
  const report = mode === "--report" ? argv[1] : null;
  const paths = argv.slice(report ? 2 : 1).map((path) => relative(root, resolve(path)) || ".");
  if (!["--write", "--check", "--report"].includes(mode) || (mode === "--report" && !["constraints", "triage"].includes(report)) || !paths.length) {
    console.error("usage: comment-policy.mjs --write|--check <path...> | --report constraints|triage <path...>");
    return 2;
  }
  const changed = [];
  const entries = [];
  const removedByKind = {};
  const keptByKind = {};
  const skipped = [];
  const failures = [];
  for (const file of sourceFiles(paths, { root, env })) {
    if (DEPLOYED_CONTRACT_SOURCE.test(file)) {
      skipped.push(file);
      continue;
    }
    const absolute = resolve(root, file);
    if (!statSync(absolute, { throwIfNoEntry: false })) continue;
    const code = readFileSync(absolute, "utf8");
    let result;
    try {
      result = purgeSource(code, file);
    } catch (error) {
      failures.push(error.message);
      continue;
    }
    for (const comment of result.removed) removedByKind[comment.kind] = (removedByKind[comment.kind] ?? 0) + 1;
    for (const comment of result.kept) {
      keptByKind[comment.kind] = (keptByKind[comment.kind] ?? 0) + 1;
      if (report === "constraints" ? comment.kind === "constraint" : TRIAGE_KINDS.has(comment.kind)) {
        entries.push({ file, line: lineOf(code, comment.start), kind: comment.kind, text: code.slice(comment.start, comment.end) });
      }
    }
    if (result.code !== code) changed.push({ file, absolute, code: result.code, removed: result.removed.length });
  }
  // Nothing is written while any file fails to parse, so a run never leaves a half-done purge.
  if (failures.length) {
    for (const failure of failures) console.error(failure);
    console.error(`${failures.length} file(s) do not parse; nothing was ${mode === "--write" ? "written" : "checked"}.`);
    return 1;
  }
  if (report) {
    console.log(JSON.stringify({ [report]: entries }, null, 2));
    return 0;
  }
  if (mode === "--write") for (const entry of changed) writeFileSync(entry.absolute, entry.code);
  const total = changed.reduce((sum, entry) => sum + entry.removed, 0);
  const count = (counts) => Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([kind, n]) => `${n} ${kind}`).join(", ") || "none";
  console.log(`${mode === "--write" ? "Removed" : "Would remove"} ${total} comment(s) from ${changed.length} file(s) (${count(removedByKind)}); kept ${count(keptByKind)}.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} deployed contract source file(s) under packages/contracts/src.`);
  return mode === "--check" && changed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
