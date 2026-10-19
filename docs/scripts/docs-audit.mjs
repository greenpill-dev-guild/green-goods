#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as yaml from "js-yaml";
import {parse as parseModule, parseExpression} from "@babel/parser";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import {unified} from "unified";
import { auditDeveloperGuides, auditWorkflowCommands, auditRetiredCommandCallers, auditCommandPolicy } from "./developer-guides.mjs";
import { resolveCommand } from "../../packages/contracts/script/cli/operations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootArgumentIndex = process.argv.indexOf("--root");
if (rootArgumentIndex >= 0 && !process.argv[rootArgumentIndex + 1]) {
  throw new Error("docs-audit --root requires a repository path");
}
const repoRoot = rootArgumentIndex >= 0
  ? path.resolve(process.argv[rootArgumentIndex + 1])
  : path.resolve(__dirname, "../..");
const docsRoot = path.resolve(repoRoot, "docs/docs");

// A hand-written page that names a repository path promises the reader a place to open, and a
// renamed file breaks that promise without failing anything. These are the paths checked: a code
// span that starts at a top-level source folder, and, on a package page, the first column of its
// directory table, which is written relative to that package.
const REPO_PATH_ROOTS = /^(?:packages|scripts|docs|tests|\.github|\.claude|\.codex)\//;
const NOT_ONE_PATH = /[*<>{}$…\s]/;
const PACKAGE_PAGE = /^docs\/docs\/builders\/packages\/([a-z]+)\.mdx$/;

// Build output and caches exist only on a machine that produced them; git knows which they are.
function ignoredByGit(candidate) {
  for (const form of [candidate, `${candidate.replace(/\/$/, "")}/`]) {
    try {
      execFileSync("git", ["check-ignore", "-q", form], { cwd: repoRoot, stdio: "ignore" });
      return true;
    } catch {
      // Exit 1 is "not ignored"; outside a repository there is nothing to ask.
    }
  }
  return false;
}

function missingRepoPaths(relativePath, body) {
  const prose = body.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "");
  const missing = [];
  const check = (written, resolved) => {
    const target = resolved.replace(/[#:].*$/, "");
    if (!existsSync(path.join(repoRoot, target)) && !ignoredByGit(target)) missing.push(written);
  };
  for (const [, span] of prose.matchAll(/`([^`\n]+)`/g)) {
    const written = span.trim();
    if (REPO_PATH_ROOTS.test(written) && !NOT_ONE_PATH.test(written)) check(written, written);
  }
  const packageName = PACKAGE_PAGE.exec(relativePath)?.[1];
  if (packageName && existsSync(path.join(repoRoot, "packages", packageName))) {
    let inTable = false;
    for (const line of prose.split("\n")) {
      if (/^\|\s*(?:Directory|Path)\s*\|/.test(line)) inTable = true;
      else if (!line.startsWith("|")) inTable = false;
      else if (inTable) {
        for (const [, span] of (line.split("|")[1] ?? "").matchAll(/`([^`]+)`/g)) {
          const written = span.trim();
          // A cell may also name a path from the repository root, which the first pass covered.
          if (!NOT_ONE_PATH.test(written) && !REPO_PATH_ROOTS.test(written)) check(written, `packages/${packageName}/${written}`);
        }
      }
    }
  }
  return missing;
}
const referenceRoot = path.resolve(docsRoot, "reference");
const introDocPath = path.resolve(docsRoot, "intro.md");
const glossaryDocPath = path.resolve(docsRoot, "glossary.md");
const readmePath = path.resolve(repoRoot, "README.md");
const docusaurusConfigPath = path.resolve(repoRoot, "docs/docusaurus.config.ts");
const sidebarsPath = path.resolve(repoRoot, "docs/sidebars.ts");
const ontologyPath = path.resolve(repoRoot, "packages/shared/src/ontology/green-goods-ontology.json");
const staticRoot = path.resolve(repoRoot, "docs/static");

const isCi = process.argv.includes("--ci");
const isStrictReadme = process.argv.includes("--strict-readme");

const canonicalRoots = [
  path.resolve(docsRoot, "builders"),
  path.resolve(docsRoot, "community"),
];

const approvedEndpointLiteralFiles = new Set([
  "docs/docs/builders/packages/api-index.mdx",
  // The deployments projection links every schema UID to its EAS explorer page on purpose.
  "docs/docs/builders/reference/deployments.mdx",
]);

const requiredFrontmatter = [
  "audience",
  "owner",
  "last_verified",
  "feature_status",
  "goal",
  "difficulty",
  "estimated_time",
  "prereqs",
  "next_steps",
  "persona_context",
];
const requiredTrustFrontmatter = [
  "audience",
  "owner",
  "last_verified",
  "feature_status",
];

const allowedFeatureStatus = new Set([
  "Live",
  "Live (external source)",
  "Complete",
  "In progress",
  "Implemented (activation pending indexing)",
  "Implemented (activation pending deployment)",
  "Planned",
]);

const allowedDifficulty = new Set(["quickstart", "standard", "advanced"]);

const placeholderPattern = /\b(TODO|TBD|PLACEHOLDER)\b/;
const stalePattern = /(coming soon|2024 roadmap|future phase|planned for q\d|to be announced)/i;
const endpointLiteralPattern =
  /https:\/\/indexer\.hyperindex\.xyz\/\S+|https:\/\/(?:arbitrum|celo|sepolia)\.easscan\.org\S*/gi;
const emptyMarkdownLinkPattern = /\[\s*]\([^)]+\)/;
const incompletePhrasePattern = /\bsee the\s+for\b/i;
const broadSourcePathPattern = /^(?:packages\/[^/]+\/src|\.plans|\.claude\/(?:agents|context|skills))$/;
const publicDocAuthorityPattern = /\b(?:canonical(?:\s+(?:source|contract))?|source of truth|active ui contract|single (?:admin )?ui contract|implementation authority|consumer contract)\b/i;
const publicDocPathPattern = /(?:docs\/docs\/(?:builders|community|reference)\/|docs\.greengoods\.app\/(?:builders|community|reference)\/)/i;
const projectSpecificExternalClaimPattern =
  /\b(?:Green Goods (?:uses|relies on|runs|operates|deploys|integrates|adopts)|we (?:use|run|operate|deploy|integrate|adopt)|standing pipeline|production pipeline)\b/i;
const negatedProjectClaimPattern = /\b(?:that Green Goods|does not|not currently|intentionally not made)\b/i;

const readmeRequiredHeadings = [];
const readmeRequiredSnippets = ["ONBOARDING.md", "AGENTS.md", "CONTRIBUTING.md"];

const readmeForbiddenPatterns = [
  {
    pattern: /docs\.greengoods\.app\/welcome\//i,
    message: "Contains stale docs link pattern: docs.greengoods.app/welcome/...",
  },
  {
    pattern: /docs\.greengoods\.app\/developer\//i,
    message: "Contains stale docs link pattern: docs.greengoods.app/developer/...",
  },
  {
    pattern: /\.claude\/skills\/dependency-management\/SKILL\.md/i,
    message: "Contains outdated dependency-management skill path.",
  },
];

const warnings = [];
const errors = [];

const warn = (filePath, message) => {
  warnings.push({filePath, message});
};
const fail = (filePath, message) => {
  errors.push({filePath, message});
};

const walk = async (dir) => {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      files.push(fullPath);
    }
  }
  return files;
};

const walkAllFiles = async (dir, ignoredDirectories = new Set()) => {
  let entries;
  try {
    entries = await fs.readdir(dir, {withFileTypes: true});
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkAllFiles(fullPath, ignoredDirectories)));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
};

const isExternalHref = (href) =>
  /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href);
const isExternalSourceOfTruth = (sourcePath) => /^https?:\/\//i.test(sourcePath);

const stripHashAndQuery = (href) => href.split("#")[0].split("?")[0];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeDocSlug = (slug) => {
  const cleanSlug = stripHashAndQuery(String(slug).trim());
  if (!cleanSlug || cleanSlug === "/") {
    return "/";
  }
  const withLeadingSlash = cleanSlug.startsWith("/") ? cleanSlug : `/${cleanSlug}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
};
const isDocsSiteHref = (href) => {
  try {
    const url = new URL(href);
    return url.hostname === "docs.greengoods.app";
  } catch {
    return false;
  }
};
const collectMarkdownHrefs = (markdown) => {
  const rawWithoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "");
  return [...rawWithoutCodeBlocks.matchAll(/\[[^\]]*]\(([^)]+)\)/g)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
};

const stripMdxTags = (value) => {
  let result = "";
  let insideTag = false;
  for (const character of value) {
    if (character === "<") {
      insideTag = true;
      continue;
    }
    if (character === ">" && insideTag) {
      insideTag = false;
      continue;
    }
    if (!insideTag) result += character;
  }
  return result;
};

const headingSlug = (value) =>
  stripMdxTags(value)
    .replace(/\{#[^}]+\}\s*$/, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");

const collectDocumentAnchors = (body) => {
  const anchors = new Set();
  for (const match of body.matchAll(/\{#([A-Za-z][\w:.-]*)\}/g)) anchors.add(match[1]);
  for (const match of body.matchAll(/\bid=["']([^"']+)["']/g)) anchors.add(match[1]);
  for (const match of body.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    const slug = headingSlug(match[1]);
    if (slug) anchors.add(slug);
  }
  return anchors;
};

const redirectTarget = (rawTarget) => {
  const [pathAndQuery, rawFragment] = String(rawTarget).split("#", 2);
  let fragment = rawFragment ?? null;
  try {
    fragment = fragment === null ? null : decodeURIComponent(fragment);
  } catch {
    // Keep malformed fragments literal so they fail the anchor lookup below.
  }
  return { slug: normalizeDocSlug(pathAndQuery), fragment };
};

const resolveDocLink = (sourceFilePath, href, docFileSet) => {
  const cleanHref = stripHashAndQuery(href.trim().replace(/^<|>$/g, ""));
  if (!cleanHref) {
    return true;
  }
  if (cleanHref.startsWith("/") || cleanHref.startsWith("#") || isExternalHref(cleanHref)) {
    return true;
  }
  if (cleanHref.includes("{") || cleanHref.includes("}")) {
    return true;
  }

  const resolved = path.resolve(path.dirname(sourceFilePath), cleanHref);
  const ext = path.extname(resolved);
  const candidates = ext
    ? [resolved]
    : [`${resolved}.md`, `${resolved}.mdx`, path.join(resolved, "index.md"), path.join(resolved, "index.mdx")];

  return candidates.some((candidate) => docFileSet.has(path.normalize(candidate)));
};

const parseFrontmatter = (content) => {
  if (!content.startsWith("---\n")) {
    return {frontmatter: null, body: content};
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return {frontmatter: null, body: content};
  }
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  try {
    return {
      frontmatter: yaml.load(raw, {schema: yaml.YAML11_SCHEMA}) ?? {},
      body,
    };
  } catch {
    return {frontmatter: null, body};
  }
};

const fileExists = async (relativePath) => {
  const abs = path.resolve(repoRoot, relativePath);
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
};

const normalizeSourcePathForAudit = (sourcePath) =>
  sourcePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");

const isWeakSourceOfTruth = (sourcePath, relativePath) => {
  const normalizedSourcePath = normalizeSourcePathForAudit(sourcePath);
  const normalizedRelativePath = normalizeSourcePathForAudit(relativePath);

  if (normalizedSourcePath === normalizedRelativePath) {
    return "source_of_truth cannot cite the document itself.";
  }
  if (broadSourcePathPattern.test(normalizedSourcePath)) {
    return `source_of_truth path is too broad: ${sourcePath}`;
  }
  return null;
};

const makesProjectSpecificExternalClaim = (body) =>
  body
    .split("\n")
    .some(
      (line) =>
        projectSpecificExternalClaimPattern.test(line) &&
        !negatedProjectClaimPattern.test(line),
    );

const auditReadme = async (docSlugSet) => {
  const relativePath = "README.md";
  let raw;

  try {
    raw = await fs.readFile(readmePath, "utf8");
  } catch {
    warn(relativePath, "README.md not found.");
    return;
  }

  for (const heading of readmeRequiredHeadings) {
    const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m");
    if (!headingPattern.test(raw)) {
      warn(relativePath, `Missing required README heading: ${heading}`);
    }
  }

  for (const snippet of readmeRequiredSnippets) {
    if (!raw.includes(snippet)) {
      warn(relativePath, `Missing required README snippet or link: ${snippet}`);
    }
  }

  for (const {pattern, message} of readmeForbiddenPatterns) {
    if (pattern.test(raw)) {
      warn(relativePath, message);
    }
  }

  for (const href of collectMarkdownHrefs(raw)) {
    const cleanHref = stripHashAndQuery(href.trim().replace(/^<|>$/g, ""));
    if (!cleanHref || cleanHref.startsWith("#")) {
      continue;
    }

    if (isDocsSiteHref(cleanHref)) {
      const url = new URL(cleanHref);
      const docSlug = normalizeDocSlug(url.pathname);
      if (!docSlugSet.has(docSlug)) {
        fail(relativePath, `Docs link target not found in local docs slugs: ${cleanHref}`);
      }
      continue;
    }

    if (isExternalHref(cleanHref) || cleanHref.startsWith("/")) {
      continue;
    }

    const resolved = path.resolve(path.dirname(readmePath), cleanHref);
    try {
      await fs.access(resolved);
    } catch {
      fail(relativePath, `Relative README link target not found: ${href}`);
    }
  }
};

const isCanonicalFile = (filePath) => canonicalRoots.some((root) => filePath.startsWith(root));
const isMonitoredDoc = (filePath) =>
  isCanonicalFile(filePath) ||
  filePath.startsWith(referenceRoot) ||
  filePath === introDocPath ||
  filePath === glossaryDocPath;

const isGuideLikeDoc = (relativePath) =>
  relativePath.startsWith("docs/docs/community/gardener-guide/") ||
  relativePath.startsWith("docs/docs/community/steward-guide/") ||
  relativePath.startsWith("docs/docs/community/funder-guide/") ||
  relativePath.startsWith("docs/docs/community/evaluator-guide/") ||
  relativePath.startsWith("docs/docs/community/community-member-guide/") ||
  relativePath === "docs/docs/builders/getting-started.mdx";

const requiresSourceOfTruth = (frontmatter, canonical, relativePath) => {
  if (!canonical || !frontmatter || typeof frontmatter !== "object") {
    return false;
  }
  if (frontmatter.unlisted === true) {
    return false;
  }
  if (relativePath.startsWith("docs/docs/reference/")) {
    return false;
  }

  const status = String(frontmatter.feature_status ?? "");
  return (
    status === "Live" ||
    status === "Live (external source)" ||
    status === "Complete" ||
    status === "In progress" ||
    status === "Implemented (activation pending indexing)" ||
    status === "Implemented (activation pending deployment)"
  );
};

const isNonReferenceCanonical = (relativePath) => {
  if (!relativePath.startsWith("docs/docs/")) {
    return false;
  }
  if (!isCanonicalFile(path.resolve(repoRoot, relativePath))) {
    return false;
  }
  return !relativePath.startsWith("docs/docs/reference/");
};

const normalizeBlock = (text) =>
  text
    .toLowerCase()
    .replace(/`[^`]+`/g, "`code`")
    .replace(/\s+/g, " ")
    .trim();

const collectDuplicateBlocks = (documents) => {
  const blockMap = new Map();

  for (const doc of documents) {
    const paragraphs = doc.body
      .split(/\n\s*\n/g)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length >= 180)
      .filter((chunk) => !chunk.startsWith("```"))
      .filter((chunk) => !chunk.startsWith(":::"))
      .filter((chunk) => !chunk.startsWith("<"))
      .filter((chunk) => !chunk.includes("NextBestAction"));

    for (const paragraph of paragraphs) {
      const normalized = normalizeBlock(paragraph);
      if (normalized.length < 180) {
        continue;
      }
      const current = blockMap.get(normalized) ?? [];
      current.push(doc.relativePath);
      blockMap.set(normalized, current);
    }
  }

  for (const [block, files] of blockMap.entries()) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length <= 1) {
      continue;
    }
    if (block.includes("keep momentum by moving to the next high-value step")) {
      continue;
    }
    const sample = block.slice(0, 120);
    warn(uniqueFiles[0], `Possible duplicated prose block across ${uniqueFiles.length} files: "${sample}..."`);
  }
};

let ontology;
try {
  ontology = JSON.parse(await fs.readFile(ontologyPath, "utf8"));
} catch (error) {
  fail("packages/shared/src/ontology/green-goods-ontology.json", `Missing or invalid ontology for docs audience validation: ${error.message}`);
  ontology = {personas: []};
}
const allowedAudiences = new Set(["all", "developer", ...ontology.personas.map((persona) => persona.id)]);

// English copy uses US spelling (DESIGN.md § Voice & Copy). The UK forms come from the vocabulary
// sidecar the catalog check reads. Pages, guides and docs components are parsed the way the docs
// build and GitHub read them, and only what a reader sees is checked. A generated page is read too
// and fixed at its source.
const vocabularyPath = "scripts/data/banned-vocabulary.json";
let usSpelling;
try {
  usSpelling = JSON.parse(await fs.readFile(path.resolve(repoRoot, vocabularyPath), "utf8")).us_spelling ?? {};
} catch (error) {
  fail(vocabularyPath, `Missing or invalid vocabulary sidecar for the US-spelling rule: ${error.message}`);
  usSpelling = {};
}
const ukForms = new Map(Object.entries(usSpelling.terms ?? {}));
const ukFormPattern = new RegExp(`\\b(${[...ukForms.keys()].map(escapeRegExp).join("|") || "(?!)"})\\b`, "gi");
const exemptPhrases = usSpelling.exempt_phrases ?? [];
const readableAttributes = ["alt", "title", "aria-label", "aria-description", "placeholder", "label"];
const renderedFrontmatterKeys = ["title", "sidebar_label", "description"];
// A URL in text, such as an autolinked https://… address, is a name.
const urlInText = /(?:https?:\/\/|www\.)[^\s)\]>"'`]+/g;
const blankKeepingLines = (text) => text.replace(/[^\n]/g, " ");

// The ontology's enum members (Cancelled, CANCELLED) are identifiers that a generated page prints
// without code marks: in table cells that list only members, and inside sentences.
const enumNames = new Set();
const collectEnumNames = (node, key) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (["members", "from", "to"].includes(key) && typeof item === "string") enumNames.add(item);
      collectEnumNames(item, key);
    }
  } else if (node && typeof node === "object") {
    for (const [childKey, child] of Object.entries(node)) collectEnumNames(child, childKey);
  }
};
collectEnumNames(ontology);
// A member that starts a sentence or a cell of prose is copy, as in "Cancelled requests stay listed".
const isEnumName = (identifiers, segment, index, word) => {
  if (!identifiers.has(word)) return false;
  if (segment.split(/[\s,·]+/).filter(Boolean).every((token) => identifiers.has(token))) return true;
  const lead = segment.slice(0, index).trimEnd();
  return lead !== "" && !/[.!?]["'’”)\]]*$/.test(lead);
};

// Collects UK forms in pieces of copy. A piece sits in a segment, the paragraph, heading or table
// cell it belongs to, at an offset; the segment is where a sentence starts and a phrase can span.
const spellingCollector = (identifiers = new Set()) => {
  const found = [];
  const check = (piece, line, segment = piece, offset = 0) => {
    let visible = segment.replace(urlInText, blankKeepingLines);
    for (const phrase of exemptPhrases) visible = visible.split(phrase).join(" ".repeat(phrase.length));
    for (const {0: word, index} of piece.matchAll(ukFormPattern)) {
      const at = offset + index;
      if (visible.slice(at, at + word.length) !== word || isEnumName(identifiers, segment, at, word)) continue;
      found.push({line: line + (piece.slice(0, index).match(/\n/g)?.length ?? 0), word, us: ukForms.get(word.toLowerCase())});
    }
  };
  return {found, check};
};

// The strings a JavaScript expression renders: string literals, template text and JSX text. A
// literal that is compared against, an object key, a member name, a type, an argument passed to a
// call and the value of a JSX attribute a reader does not see are names; a callback passed to a call
// is still read, since it can render.
const comparisons = new Set(["===", "!==", "==", "!="]);
const syntaxKeys = new Set(["loc", "start", "end", "range", "extra", "leadingComments", "trailingComments", "innerComments", "typeAnnotation", "typeParameters", "typeArguments", "returnType"]);
const jsxName = (name) => (name?.type === "JSXNamespacedName" ? `${name.namespace.name}:${name.name.name}` : name?.name);
const isFunction = (node) => node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
const renderedStrings = (node, emit) => {
  if (Array.isArray(node)) {
    for (const item of node) renderedStrings(item, emit);
    return;
  }
  if (!node || typeof node.type !== "string") return;
  switch (node.type) {
    case "StringLiteral":
    case "JSXText":
      emit(node.value, node.loc.start.line);
      return;
    case "TemplateLiteral":
      for (const quasi of node.quasis) emit(quasi.value.cooked ?? quasi.value.raw, quasi.loc.start.line);
      renderedStrings(node.expressions, emit);
      return;
    case "JSXAttribute":
      if (readableAttributes.includes(jsxName(node.name))) renderedStrings(node.value, emit);
      return;
    case "ObjectProperty":
      renderedStrings(node.value, emit);
      return;
    case "MemberExpression":
    case "OptionalMemberExpression":
      renderedStrings(node.object, emit);
      return;
    case "SwitchCase":
      renderedStrings(node.consequent, emit);
      return;
    case "BinaryExpression":
      if (!comparisons.has(node.operator)) break;
      for (const side of [node.left, node.right]) {
        if (side.type !== "StringLiteral" && side.type !== "TemplateLiteral") renderedStrings(side, emit);
      }
      return;
    case "CallExpression":
    case "OptionalCallExpression":
    case "NewExpression":
      renderedStrings(node.callee, emit);
      for (const argument of node.arguments) {
        if (isFunction(argument)) renderedStrings(argument.body, emit);
        else componentCopy(argument, emit);
      }
      return;
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
      renderedStrings(node.expression, emit);
      return;
    case "TaggedTemplateExpression":
    case "ImportDeclaration":
    case "ExportAllDeclaration":
    case "Directive":
      return;
  }
  if (node.type.startsWith("TS")) return;
  for (const [key, value] of Object.entries(node)) if (!syntaxKeys.has(key)) renderedStrings(value, emit);
};

// In a docs component, copy is what its JSX shows and the data it renders: JSX text, readable
// attributes, what a JSX expression renders, the value of a copy-named property such as label or
// description, the value setAttribute gives a readable attribute, and the text a set…Label or
// set…Text call sets. Ids, keys, class names, CSS values, and event and element names are names.
const copyKeys = new Set([...readableAttributes, "body", "caption", "description", "heading", "help", "hint", "message", "note", "subtitle", "summary", "text", "tooltip"]);
const copySetter = /^set\w*(?:Label|Text|Title|Message|Description)$/;
const componentCopy = (node, emit) => {
  if (Array.isArray(node)) {
    for (const item of node) componentCopy(item, emit);
    return;
  }
  if (!node || typeof node.type !== "string") return;
  switch (node.type) {
    case "JSXText":
      emit(node.value, node.loc.start.line);
      return;
    case "JSXAttribute":
      if (readableAttributes.includes(jsxName(node.name))) renderedStrings(node.value, emit);
      return;
    case "JSXExpressionContainer":
      renderedStrings(node.expression, emit);
      return;
    case "ObjectProperty": {
      const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
      if (!node.computed && copyKeys.has(key)) renderedStrings(node.value, emit);
      else componentCopy(node.value, emit);
      return;
    }
    case "CallExpression":
    case "OptionalCallExpression": {
      const callee = node.callee.type.endsWith("MemberExpression") ? node.callee.property.name : node.callee.name;
      const [first, second] = node.arguments;
      if (callee === "setAttribute" && first?.type === "StringLiteral" && readableAttributes.includes(first.value)) {
        renderedStrings(second, emit);
      } else if (copySetter.test(callee ?? "")) {
        renderedStrings(first, emit);
      }
      componentCopy(node.callee, emit);
      componentCopy(node.arguments, emit);
      return;
    }
    case "ImportDeclaration":
    case "ExportAllDeclaration":
    case "TaggedTemplateExpression":
      return;
  }
  if (node.type.startsWith("TS") && !["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"].includes(node.type)) return;
  for (const [key, value] of Object.entries(node)) if (!syntaxKeys.has(key)) componentCopy(value, emit);
};

// An MDX expression, such as {done ? "Closed" : "Open"}, renders its strings. One that holds only a
// comment, {/* … */}, renders nothing.
const expressionStrings = (source, line, emit) => {
  let expression;
  try {
    expression = parseExpression(source, {plugins: ["jsx"]});
  } catch {
    return;
  }
  renderedStrings(expression, (text, at) => emit(text, line + at - 1));
};
// Raw HTML in a CommonMark guide: comments and code elements are not copy, a tag is markup read only
// for its readable attributes, and the text between tags is copy.
const readableHtmlAttribute = new RegExp(`(?<![\\w:.-])(?:${readableAttributes.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gd");
const htmlText = (html) =>
  html.replace(/<!--[\s\S]*?--!?>|<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, blankKeepingLines).replace(/<[^>]*>/g, (tag) => {
    const kept = blankKeepingLines(tag).split("");
    for (const match of tag.matchAll(readableHtmlAttribute)) {
      const [start, end] = match.indices.slice(1).find(Boolean);
      for (let at = start; at < end; at += 1) kept[at] = tag[at];
    }
    return kept.join("");
  });

// The docs build parses a page as MDX with the plugins @docusaurus/mdx-loader uses, after it reads
// HTML comments and {#id} heading ids, which are not MDX; GitHub renders a guide as CommonMark with
// GFM. Both are blanked first, keeping line numbers.
const mdxPage = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm).use(remarkDirective).use(remarkMdx);
const commonMarkGuide = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
const notMdx = /<!--[\s\S]*?--!?>|\{#[^\s{}]+\}/g;
const phrasing = new Set(["text", "emphasis", "strong", "delete", "inlineCode", "break", "link", "linkReference", "image", "imageReference", "footnoteReference", "html", "mdxTextExpression", "mdxJsxTextElement", "textDirective"]);
const codeElements = new Set(["code", "pre"]);

// commonMark is true for the guides outside the docs site; the site parses every page as MDX.
const ukSpellingsIn = (text, {identifiers = new Set(), commonMark = false} = {}) => {
  const {found, check} = spellingCollector(identifiers);
  const tree = (commonMark ? commonMarkGuide : mdxPage).parse(text.replace(notMdx, blankKeepingLines));
  const lineOf = (node) => node.position?.start.line ?? 1;
  const readAttributes = (element) => {
    for (const attribute of element.attributes ?? []) {
      if (attribute.type !== "mdxJsxAttribute" || !readableAttributes.includes(attribute.name)) continue;
      const line = attribute.position?.start.line ?? lineOf(element);
      if (typeof attribute.value === "string") check(attribute.value, line);
      else if (attribute.value?.type === "mdxJsxAttributeValueExpression") expressionStrings(attribute.value.value, line, check);
    }
  };
  // A segment's text is read in order, with code and markup standing in as a word, so a sentence
  // starts where the reader sees one; titles, alt text and expressions are read on their own.
  const readSegment = (block) => {
    const pieces = [];
    const flatten = (node) => {
      if (node.type === "text") {
        pieces.push({text: node.value, line: lineOf(node), copy: true});
        return;
      }
      if (node.type === "link" || node.type === "image") {
        if (node.title) check(node.title, lineOf(node));
        if (node.type === "image" && node.alt) check(node.alt, lineOf(node));
      }
      if (node.type === "html") check(htmlText(node.value), lineOf(node));
      if (node.type === "mdxTextExpression") expressionStrings(node.value, lineOf(node), check);
      if (node.type === "mdxJsxTextElement") readAttributes(node);
      const hidden = ["inlineCode", "image", "imageReference", "footnoteReference", "html", "mdxTextExpression"].includes(node.type) ||
        (node.type === "mdxJsxTextElement" && codeElements.has(node.name));
      if (hidden) pieces.push({text: " x ", copy: false});
      else if (node.type === "break") pieces.push({text: "\n", copy: false});
      else for (const child of node.children ?? []) flatten(child);
    };
    for (const child of block.children) flatten(child);
    const segment = pieces.map((piece) => piece.text).join("");
    let offset = 0;
    for (const piece of pieces) {
      if (piece.copy) check(piece.text, piece.line, segment, offset);
      offset += piece.text.length;
    }
  };
  const readBlock = (node) => {
    switch (node.type) {
      case "code":
      case "mdxjsEsm":
      case "yaml":
        return;
      case "html":
        check(htmlText(node.value), lineOf(node));
        return;
      case "mdxFlowExpression":
        expressionStrings(node.value, lineOf(node), check);
        return;
      case "definition":
        if (node.title) check(node.title, lineOf(node));
        return;
      case "mdxJsxFlowElement":
        readAttributes(node);
        if (codeElements.has(node.name)) return;
    }
    if (node.children?.some((child) => phrasing.has(child.type))) readSegment(node);
    else for (const child of node.children ?? []) readBlock(child);
  };
  // Rendered frontmatter, parsed so a folded or literal block value is read whole.
  const {frontmatter} = tree.children[0]?.type === "yaml" ? parseFrontmatter(text) : {frontmatter: null};
  const lines = text.split("\n");
  for (const key of renderedFrontmatterKeys) {
    if (typeof frontmatter?.[key] === "string") {
      check(frontmatter[key], lines.findIndex((line) => line.startsWith(`${key}:`)) + 1);
    }
  }
  readBlock(tree);
  return found.sort((left, right) => left.line - right.line);
};

const failUkSpellings = (relativePath, text, {generated = false, commonMark = false} = {}) => {
  const where = generated ? " Fix it in the source this page is generated from." : "";
  let found;
  try {
    found = ukSpellingsIn(text, {identifiers: generated ? enumNames : undefined, commonMark});
  } catch (error) {
    // The docs build rejects a page it cannot parse, so the build reports the syntax error.
    warn(relativePath, `Skipped the US-spelling check, since the page does not parse: ${error.message}`);
    return;
  }
  for (const {line, word, us} of found) {
    fail(relativePath, `UK spelling on line ${line}: "${word}"; English copy uses US spelling ("${us}"), see DESIGN.md § Voice & Copy.${where}`);
  }
};

// Copy outside the docs site that readers still meet: release notes and the design guidance.
const usSpellingGuides = async () => {
  const optionalWalk = (relativeDir) => walk(path.resolve(repoRoot, relativeDir)).catch(() => []);
  const packageDesigns = [];
  for (const entry of await fs.readdir(path.resolve(repoRoot, "packages"), {withFileTypes: true}).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    for (const name of await fs.readdir(path.resolve(repoRoot, "packages", entry.name)).catch(() => [])) {
      if (/^DESIGN.*\.md$/.test(name)) packageDesigns.push(path.resolve(repoRoot, "packages", entry.name, name));
    }
  }
  return [
    ...["DESIGN.md", "docs/DESIGN.md"].map((relativePath) => path.resolve(repoRoot, relativePath)).filter(existsSync),
    ...packageDesigns,
    ...(await optionalWalk("docs/releases")),
    ...(await optionalWalk(".claude/skills/design")),
  ];
};

for (const filePath of await usSpellingGuides()) {
  failUkSpellings(path.relative(repoRoot, filePath).replace(/\\/g, "/"), await fs.readFile(filePath, "utf8"), {commonMark: true});
}

// The docs site's components and the data they render, parsed as TypeScript and JSX; their tests
// render nothing.
const docsComponents = (await walkAllFiles(path.resolve(repoRoot, "docs/src"))).filter(
  (filePath) => /\.(?:jsx?|tsx?)$/.test(filePath) && !/\.test\.|[\\/]__tests__[\\/]/.test(filePath),
);
for (const filePath of docsComponents) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  const {found, check} = spellingCollector();
  try {
    const plugins = filePath.endsWith(".ts") ? ["typescript"] : filePath.endsWith(".tsx") ? ["typescript", "jsx"] : ["jsx"];
    componentCopy(parseModule(await fs.readFile(filePath, "utf8"), {sourceType: "module", plugins}).program, check);
  } catch (error) {
    warn(relativePath, `Skipped the US-spelling check, since the file does not parse: ${error.message}`);
    continue;
  }
  for (const {line, word, us} of found) {
    fail(relativePath, `UK spelling on line ${line}: "${word}"; English copy uses US spelling ("${us}"), see DESIGN.md § Voice & Copy.`);
  }
}

const allDocs = await walk(docsRoot);
const docFileSet = new Set(allDocs.map((filePath) => path.normalize(filePath)));
const docSlugSet = new Set();
const docAnchorsBySlug = new Map();
const docSlugByFile = new Map();
const docIdSet = new Set();
const canonicalDocs = [];
const unlistedDocTargets = [];
const auditedDocuments = [];

for (const filePath of allDocs) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  const raw = await fs.readFile(filePath, "utf8");
  const {frontmatter, body} = parseFrontmatter(raw);
  const canonical = isCanonicalFile(filePath);
  const monitored = isMonitoredDoc(filePath);
  const unlisted = frontmatter && typeof frontmatter === "object" && frontmatter.unlisted === true;
  const docId = relativePath.replace(/^docs\/docs\//, "").replace(/\.(md|mdx)$/, "");
  docIdSet.add(docId);
  let docSlug = null;

  if (frontmatter && typeof frontmatter === "object" && typeof frontmatter.slug === "string") {
    docSlug = normalizeDocSlug(frontmatter.slug);
    docSlugSet.add(docSlug);
    docAnchorsBySlug.set(docSlug, collectDocumentAnchors(body));
    docSlugByFile.set(path.normalize(filePath), docSlug);
  }

  auditedDocuments.push({filePath, relativePath, frontmatter, body, slug: docSlug});

  failUkSpellings(relativePath, raw, {generated: frontmatter?.generated === true});

  if (unlisted) {
    fail(relativePath, "Public docs must not set unlisted: true.");
    unlistedDocTargets.push({
      docId,
      relativePath,
      slug: docSlug,
    });
  }

  if (canonical && !unlisted) {
    canonicalDocs.push({relativePath, body});
  }

  if (!monitored) {
    continue;
  }

  if (!unlisted && placeholderPattern.test(raw)) {
    warn(relativePath, "Contains placeholder marker (TODO/TBD/PLACEHOLDER).");
  }

  if (!unlisted && stalePattern.test(raw)) {
    warn(relativePath, "Contains stale-language marker (for example 'coming soon' or old roadmap phrasing).");
  }

  if (emptyMarkdownLinkPattern.test(raw)) {
    warn(relativePath, "Contains empty markdown link text.");
  }

  if (incompletePhrasePattern.test(raw)) {
    warn(relativePath, "Contains incomplete phrase pattern (for example 'See the  for').");
  }

  for (const href of collectMarkdownHrefs(raw)) {
    if (!href) {
      continue;
    }
    if (!resolveDocLink(filePath, href, docFileSet)) {
      fail(relativePath, `Relative markdown link target not found: ${href}`);
    }
  }

  if (!frontmatter || typeof frontmatter !== "object") {
    fail(relativePath, "Missing or invalid YAML frontmatter.");
  } else {
    const generated = frontmatter.generated === true;
    const trustFields = generated
      ? requiredTrustFrontmatter.filter((key) => key !== "last_verified")
      : requiredTrustFrontmatter;
    for (const key of trustFields) {
      if (!(key in frontmatter)) {
        fail(relativePath, `Missing required frontmatter field: ${key}`);
      }
    }

    if (generated) {
      if ("last_verified" in frontmatter) {
        fail(relativePath, "Generated pages must not use last_verified as freshness evidence.");
      }
      if (typeof frontmatter.generator !== "string" || !frontmatter.generator) {
        fail(relativePath, "Generated page is missing an exact generator path.");
      } else if (!(await fileExists(frontmatter.generator))) {
        fail(relativePath, `Generated-page generator path not found: ${frontmatter.generator}`);
      }
      if (!/^sha256:[a-f0-9]{64}$/.test(String(frontmatter.source_digest ?? ""))) {
        fail(relativePath, "Generated page has a missing or malformed source_digest.");
      }
      if (!Array.isArray(frontmatter.generated_from) || frontmatter.generated_from.length === 0) {
        fail(relativePath, "Generated page must declare a non-empty generated_from list.");
      } else {
        for (const sourcePath of frontmatter.generated_from) {
          if (typeof sourcePath !== "string" || !(await fileExists(sourcePath))) {
            fail(relativePath, `generated_from path not found: ${String(sourcePath)}`);
          }
        }
      }
      const declaredAuthority = Array.isArray(frontmatter.source_of_truth)
        ? [...frontmatter.source_of_truth].sort()
        : [];
      const generatedAuthority = Array.isArray(frontmatter.generated_from)
        ? [...frontmatter.generated_from].sort()
        : [];
      if (JSON.stringify(declaredAuthority) !== JSON.stringify(generatedAuthority)) {
        fail(relativePath, "Generated page source_of_truth must exactly match generated_from.");
      }
    }

    const nonReferenceCanonical = isNonReferenceCanonical(relativePath);

    if (nonReferenceCanonical && isGuideLikeDoc(relativePath)) {
      for (const key of requiredFrontmatter) {
        if (!(key in frontmatter)) {
          fail(relativePath, `Missing required frontmatter field: ${key}`);
        }
      }
    }

    const featureStatus = frontmatter.feature_status;
    if (featureStatus && !allowedFeatureStatus.has(String(featureStatus))) {
      fail(relativePath, `Invalid feature_status value: ${featureStatus}`);
    }

    const difficulty = frontmatter.difficulty;
    if (difficulty && !allowedDifficulty.has(String(difficulty))) {
      fail(relativePath, `Invalid difficulty value: ${difficulty}`);
    }

    const audience = frontmatter.audience;
    if (typeof audience !== "string" || !allowedAudiences.has(audience)) {
      fail(relativePath, `Invalid audience identifier: ${String(audience)}. Use an ontology persona, all, or developer.`);
    }

    if (requiresSourceOfTruth(frontmatter, canonical, relativePath) && !("source_of_truth" in frontmatter)) {
      fail(relativePath, "Missing required frontmatter field: source_of_truth");
    }

    const sourceOfTruth = frontmatter.source_of_truth;
    if (sourceOfTruth) {
      const sourcePaths = Array.isArray(sourceOfTruth) ? sourceOfTruth : [sourceOfTruth];
      for (const sourcePath of sourcePaths) {
        if (typeof sourcePath !== "string") {
          fail(relativePath, "source_of_truth contains a non-string entry.");
          continue;
        }
        if (isExternalSourceOfTruth(sourcePath)) {
          continue;
        }
        const weakSourceMessage = isWeakSourceOfTruth(sourcePath, relativePath);
        if (weakSourceMessage) {
          fail(relativePath, weakSourceMessage);
          continue;
        }
        if (!(await fileExists(sourcePath))) {
          fail(relativePath, `source_of_truth path not found: ${sourcePath}`);
        }
      }

      const hasOnlyExternalSources = sourcePaths.every(
        (sourcePath) => typeof sourcePath === "string" && isExternalSourceOfTruth(sourcePath),
      );
      if (
        hasOnlyExternalSources &&
        featureStatus !== "Live (external source)" &&
        requiresSourceOfTruth(frontmatter, canonical, relativePath)
      ) {
        fail(relativePath, "source_of_truth needs at least one local source for repo-backed Live or Implemented claims.");
      }
      if (
        hasOnlyExternalSources &&
        featureStatus === "Live (external source)" &&
        makesProjectSpecificExternalClaim(body)
      ) {
        warn(relativePath, "Live external page makes project-specific usage claims without a local source_of_truth.");
      }
    }
  }

  if (frontmatter?.generated !== true) {
    for (const written of missingRepoPaths(relativePath, body)) fail(relativePath, `Repository path not found: ${written}`);
  }

  const endpointMatches = raw.match(endpointLiteralPattern) ?? [];
  if (endpointMatches.length > 0 && !approvedEndpointLiteralFiles.has(relativePath)) {
    warn(relativePath, "Contains hardcoded endpoint literal. Project it from code/configuration or link to the generated API index.");
  }
}

const auditUnlistedPublicReferences = async () => {
  const publicSurfaces = [
    {
      absPath: sidebarsPath,
      label: "sidebar",
      relativePath: "docs/sidebars.ts",
      targetFor: ({docId}) => [docId],
    },
    {
      absPath: docusaurusConfigPath,
      label: "redirect/config",
      relativePath: "docs/docusaurus.config.ts",
      targetFor: ({slug}) => (slug ? [slug] : []),
    },
  ];

  for (const surface of publicSurfaces) {
    let raw;
    try {
      raw = await fs.readFile(surface.absPath, "utf8");
    } catch {
      continue;
    }

    for (const target of unlistedDocTargets) {
      for (const publicTarget of surface.targetFor(target)) {
        if (!raw.includes(publicTarget)) {
          continue;
        }
        fail(
          surface.relativePath,
          `Public ${surface.label} references unlisted doc ${target.relativePath}: ${publicTarget}`,
        );
      }
    }
  }
};

const auditSidebarAndRedirectTargets = async () => {
  const sidebar = await fs.readFile(sidebarsPath, "utf8");
  for (const match of sidebar.matchAll(/["']((?:builders|community|reference)\/[^"']+)["']/g)) {
    const target = match[1];
    if (!docIdSet.has(target)) fail("docs/sidebars.ts", `Sidebar target not found: ${target}`);
  }

  const config = await fs.readFile(docusaurusConfigPath, "utf8");
  for (const match of config.matchAll(/\bto:\s*["']([^"']+)["']/g)) {
    const target = redirectTarget(match[1]);
    if (!docSlugSet.has(target.slug)) {
      fail("docs/docusaurus.config.ts", `Redirect target not found: ${match[1]}`);
      continue;
    }
    if (target.fragment && !docAnchorsBySlug.get(target.slug)?.has(target.fragment)) {
      fail("docs/docusaurus.config.ts", `Redirect fragment not found: ${match[1]}`);
    }
  }
};

const auditNavigationReachability = async () => {
  const sidebar = await fs.readFile(sidebarsPath, "utf8");
  const sidebarIds = new Set(
    [...sidebar.matchAll(/["']((?:builders|community|reference)\/[^"']+)["']/g)].map((match) => match[1]),
  );
  for (const docId of docIdSet) {
    if (!docId.startsWith("builders/") && !docId.startsWith("community/")) continue;
    if (!sidebarIds.has(docId)) {
      fail("docs/sidebars.ts", `Public page is unreachable from navigation: ${docId}`);
    }
  }
};

const decodeFragment = (fragment) => {
  if (!fragment) return null;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

const auditDocumentAnchors = () => {
  for (const document of auditedDocuments) {
    for (const rawHref of collectMarkdownHrefs(document.body)) {
      const href = rawHref.trim().replace(/^<|>$/g, "");
      if (!href || isExternalHref(href) && !isDocsSiteHref(href)) continue;

      let targetSlug = null;
      let fragment = null;
      if (isDocsSiteHref(href)) {
        const url = new URL(href);
        targetSlug = normalizeDocSlug(url.pathname);
        fragment = decodeFragment(url.hash.slice(1));
      } else if (href.startsWith("#")) {
        targetSlug = document.slug;
        fragment = decodeFragment(href.slice(1));
      } else if (href.startsWith("/")) {
        const [pathname, rawFragment] = href.split("#", 2);
        if (/^\/(?:img|assets)\//.test(pathname)) continue;
        targetSlug = normalizeDocSlug(pathname);
        fragment = decodeFragment(rawFragment);
        if (!docSlugSet.has(targetSlug)) {
          fail(document.relativePath, `Internal docs route target not found: ${href}`);
          continue;
        }
      } else {
        const [relativeTarget, rawFragment] = href.split("#", 2);
        const cleanTarget = relativeTarget.split("?")[0];
        const resolved = path.resolve(path.dirname(document.filePath), cleanTarget);
        const candidates = path.extname(resolved)
          ? [resolved]
          : [`${resolved}.md`, `${resolved}.mdx`, path.join(resolved, "index.md"), path.join(resolved, "index.mdx")];
        const targetFile = candidates.map((candidate) => path.normalize(candidate)).find((candidate) => docFileSet.has(candidate));
        if (!targetFile) continue;
        targetSlug = docSlugByFile.get(targetFile) ?? null;
        fragment = decodeFragment(rawFragment);
      }

      if (fragment && targetSlug && !docAnchorsBySlug.get(targetSlug)?.has(fragment)) {
        fail(document.relativePath, `Markdown link fragment not found: ${href}`);
      }
    }
  }
};

const auditStaticAssets = async () => {
  const assets = await walkAllFiles(staticRoot);
  if (assets.length === 0) return;
  const sourceFiles = await walkAllFiles(path.resolve(repoRoot, "docs"), new Set(["static", "build", "node_modules", ".docusaurus"]));
  let sourceCorpus = "";
  for (const sourceFile of sourceFiles) {
    try {
      sourceCorpus += `\n${await fs.readFile(sourceFile, "utf8")}`;
    } catch {
      // Binary source artifacts are not consumer declarations.
    }
  }
  for (const asset of assets) {
    const relativeAsset = path.relative(staticRoot, asset).replace(/\\/g, "/");
    if (relativeAsset === "llms.txt") continue;
    if (!sourceCorpus.includes(relativeAsset)) {
      fail(`docs/static/${relativeAsset}`, "Public asset has no source consumer.");
    }
  }
};

const auditInternalAuthorityEdges = async () => {
  const candidates = [
    path.resolve(repoRoot, "AGENTS.md"),
    path.resolve(repoRoot, "CLAUDE.md"),
    path.resolve(repoRoot, "scripts/README.md"),
    ...(await walkAllFiles(path.resolve(repoRoot, ".claude/context"), new Set(["worktrees"]))),
    ...(await walkAllFiles(path.resolve(repoRoot, ".claude/skills"), new Set(["worktrees"]))),
    ...(await walkAllFiles(
      path.resolve(repoRoot, "packages"),
      new Set(["build", "coverage", "dist", "node_modules", "storybook-static", ".turbo"]),
    )),
    ...(await walkAllFiles(path.resolve(repoRoot, "docs/routines"))),
  ];
  for (const candidate of candidates) {
    if (!/\.(?:md|mdx)$/.test(candidate)) continue;
    let raw;
    try {
      raw = await fs.readFile(candidate, "utf8");
    } catch {
      continue;
    }
    for (const [index, line] of raw.split("\n").entries()) {
      if (!publicDocPathPattern.test(line) || !publicDocAuthorityPattern.test(line)) continue;
      fail(
        path.relative(repoRoot, candidate).replace(/\\/g, "/"),
        `Implementation authority points downstream into public docs at line ${index + 1}.`,
      );
    }
  }
};

collectDuplicateBlocks(canonicalDocs);
await auditUnlistedPublicReferences();
await auditSidebarAndRedirectTargets();
await auditNavigationReachability();
auditDocumentAnchors();
await auditStaticAssets();
await auditInternalAuthorityEdges();
await auditReadme(docSlugSet);
errors.push(...await auditDeveloperGuides(repoRoot, undefined, { resolveContracts: resolveCommand }));
errors.push(...await auditWorkflowCommands(repoRoot));
errors.push(...await auditRetiredCommandCallers(repoRoot));
errors.push(...await auditCommandPolicy(repoRoot));

const sortedWarnings = warnings.sort((a, b) => {
  if (a.filePath === b.filePath) {
    return a.message.localeCompare(b.message);
  }
  return a.filePath.localeCompare(b.filePath);
});
const sortedErrors = errors.sort((a, b) => {
  if (a.filePath === b.filePath) return a.message.localeCompare(b.message);
  return a.filePath.localeCompare(b.filePath);
});

if (sortedErrors.length > 0) {
  console.error(`docs-audit: ${sortedErrors.length} hard error(s).`);
  for (const error of sortedErrors) console.error(`- ${error.filePath}: ${error.message}`);
}

if (sortedWarnings.length === 0 && sortedErrors.length === 0) {
  console.log("docs-audit: no errors or warnings.");
  process.exit(0);
}

if (sortedWarnings.length > 0) {
  console.log(`docs-audit: ${sortedWarnings.length} advisory warning(s).`);
  for (const warning of sortedWarnings) {
    console.log(`- ${warning.filePath}: ${warning.message}`);
  }
}

const readmeWarnings = sortedWarnings.filter((warning) => warning.filePath === "README.md");

if (isStrictReadme) {
  if (sortedErrors.length > 0 || readmeWarnings.length > 0) {
    console.log(`docs-audit: strict README mode failed with ${readmeWarnings.length} README warning(s).`);
    process.exit(1);
  }

  console.log("docs-audit: strict README mode passed; non-README warnings remain warn-only.");
  process.exit(0);
}

if (isCi) {
  console.log("docs-audit: CI blocks hard authority errors; editorial warnings remain advisory.");
}

process.exit(sortedErrors.length > 0 ? 1 : 0);
