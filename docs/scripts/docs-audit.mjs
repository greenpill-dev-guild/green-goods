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
  const seen = new Set();
  const check = (piece, line, segment = piece, offset = 0) => {
    let visible = segment.replace(urlInText, blankKeepingLines);
    for (const phrase of exemptPhrases) visible = visible.split(phrase).join(" ".repeat(phrase.length));
    for (const {0: word, index} of piece.matchAll(ukFormPattern)) {
      const at = offset + index;
      if (visible.slice(at, at + word.length) !== word || isEnumName(identifiers, segment, at, word)) continue;
      const foundLine = line + (piece.slice(0, index).match(/\n/g)?.length ?? 0);
      const key = [foundLine, word, offset + index, segment].join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({line: foundLine, word, us: ukForms.get(word.toLowerCase())});
    }
  };
  return {found, check};
};

// The strings a JavaScript expression renders: string literals, template text and JSX text. A
// literal that is compared against, an object key, a member name, a type and an argument passed to
// a call are names. An object renders only its copy-named properties, a JSX attribute a reader does
// not see is read only for copy-shaped data, a callback renders what it returns, and an identifier
// renders what its binding holds.
const comparisons = new Set(["===", "!==", "==", "!="]);
const syntaxKeys = new Set(["loc", "start", "end", "range", "extra", "leadingComments", "trailingComments", "innerComments", "typeAnnotation", "typeParameters", "typeArguments", "returnType"]);
const jsxName = (name) => (name?.type === "JSXNamespacedName" ? `${name.namespace.name}:${name.name.name}` : name?.name);
const isFunction = (node) => node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
const ownsReturns = (node) => isFunction(node) || ["FunctionDeclaration", "ObjectMethod", "ClassMethod", "ClassPrivateMethod"].includes(node.type);
const propertyKey = (property) => (property.key.type === "Identifier" ? property.key.name : property.key.value);
// Copy-named properties hold copy, in component data, JSON data and the props a page passes.
const copyKeys = new Set([...readableAttributes, "body", "caption", "description", "display", "heading", "help", "hint", "message", "note", "subtitle", "summary", "tagline", "text", "tooltip", "copyright"]);
const calleeName = (call) =>
  call?.type === "CallExpression" ? (call.callee.type === "MemberExpression" ? call.callee.property.name : call.callee.name) : undefined;
// The docs modules, by absolute path, parsed once; the module scan below fills it.
const parsedModules = new Map();
// An import's target among the docs modules: an @site/ or relative path, with or without its
// extension or index file. A package import has none.
const moduleSuffixes = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
const resolveImport = (fromFile, source) => {
  const base = source.startsWith("@site/")
    ? path.resolve(repoRoot, "docs", source.slice("@site/".length))
    : source.startsWith(".") && fromFile
      ? path.resolve(path.dirname(fromFile), source)
      : null;
  return base ? (moduleSuffixes.map((suffix) => base + suffix).find((candidate) => parsedModules.has(candidate)) ?? null) : null;
};
// A module's simple bindings, by name: const and let initializers, function declarations, the
// initial value of a useState pair, a local function's parameters as each call passes them, a
// component's props, which stand for whatever a page passes, and what it imports from another docs
// module. Shadowed names share an entry, so a rendered name reads every value it may hold.
const collectBindings = (program, filePath) => {
  const bindings = new Map();
  const bind = (name, value) => value && bindings.set(name, [...(bindings.get(name) ?? []), value]);
  const functions = new Map();
  const walkTree = (node, visit) => {
    if (Array.isArray(node)) {
      for (const item of node) walkTree(item, visit);
      return;
    }
    if (!node || typeof node.type !== "string") return;
    visit(node);
    for (const [key, value] of Object.entries(node)) if (!syntaxKeys.has(key)) walkTree(value, visit);
  };
  const propsOf = (component, fn) => {
    const [first] = fn.params;
    // A component that keeps its props whole reads one as props.question.
    if (first?.type === "Identifier" && isComponentName(component)) bind(first.name, {type: "PropsObject", component});
    for (const property of first?.type === "ObjectPattern" ? first.properties : []) {
      if (property.type !== "ObjectProperty" || property.key.type !== "Identifier") continue;
      const local = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
      if (local.type !== "Identifier") continue;
      bind(local.name, {type: "PropReference", component, prop: property.key.name});
      if (property.value.type === "AssignmentPattern") bind(local.name, property.value.right);
    }
  };
  // A destructured local takes the matching element or property of its initializer, or the whole
  // initializer when that is not a literal array or object.
  const destructure = (pattern, value) => {
    if (!pattern || !value) return;
    if (pattern.type === "Identifier") bind(pattern.name, value);
    if (pattern.type === "AssignmentPattern") {
      destructure(pattern.left, value);
      destructure(pattern.left, pattern.right);
    }
    if (pattern.type === "ArrayPattern") {
      pattern.elements.forEach((element, index) =>
        destructure(element, value.type === "ArrayExpression" ? value.elements[index] : value),
      );
    }
    if (pattern.type === "ObjectPattern") {
      for (const property of pattern.properties) {
        if (property.type !== "ObjectProperty") continue;
        const match = value.type === "ObjectExpression"
          ? value.properties.find((candidate) => candidate.type === "ObjectProperty" && propertyKey(candidate) === propertyKey(property))
          : null;
        const member = value.type === "Identifier"
          ? {type: "MemberOf", object: value, key: property.computed ? undefined : propertyKey(property)}
          : value;
        destructure(property.value, match ? match.value : member);
      }
    }
  };
  for (const statement of program.body) {
    const file = statement.type === "ImportDeclaration" ? resolveImport(filePath, statement.source.value) : null;
    for (const specifier of file ? statement.specifiers : []) {
      const name = specifier.type === "ImportDefaultSpecifier" ? "default" : (specifier.imported?.name ?? specifier.imported?.value);
      if (name) bind(specifier.local.name, {type: "ImportedBinding", file, name});
    }
  }
  walkTree(program, (node) => {
    if (node.type === "FunctionDeclaration" && node.id) {
      functions.set(node.id.name, node);
      bind(node.id.name, node);
    }
    if (node.type !== "VariableDeclarator" || !node.init) return;
    if (node.id.type === "Identifier" && isFunction(node.init)) functions.set(node.id.name, node.init);
    const [state] = node.id.type === "ArrayPattern" ? node.id.elements : [];
    if (state?.type === "Identifier" && calleeName(node.init) === "useState") bind(state.name, node.init.arguments[0]);
    else destructure(node.id, node.init);
  });
  for (const [name, fn] of functions) propsOf(name, fn);
  walkTree(program, (node) => {
    const fn = node.type === "CallExpression" && node.callee.type === "Identifier" ? functions.get(node.callee.name) : undefined;
    fn?.params.forEach((param, index) => {
      const local = param.type === "AssignmentPattern" ? param.left : param;
      if (local.type === "Identifier") bind(local.name, node.arguments[index] ?? param.right);
    });
  });
  return bindings;
};
// What a docs module exports, by name: its declarations' values, and re-exports, which point on to
// the module they come from.
const moduleExports = (program, bindings, filePath) => {
  const exported = new Map();
  const add = (name, values) => exported.set(name, [...(exported.get(name) ?? []), ...values]);
  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration") {
      const {declaration} = statement;
      for (const declarator of declaration?.type === "VariableDeclaration" ? declaration.declarations : []) {
        if (declarator.id.type === "Identifier") add(declarator.id.name, bindings.get(declarator.id.name) ?? []);
      }
      if (declaration?.type === "FunctionDeclaration" && declaration.id) add(declaration.id.name, [declaration]);
      const from = statement.source ? resolveImport(filePath, statement.source.value) : null;
      for (const specifier of statement.specifiers ?? []) {
        const name = specifier.exported?.name ?? specifier.exported?.value;
        const local = specifier.local?.name ?? specifier.local?.value;
        if (name && local) add(name, from ? [{type: "ImportedBinding", file: from, name: local}] : (bindings.get(local) ?? []));
      }
    }
    if (statement.type === "ExportDefaultDeclaration") {
      const {declaration} = statement;
      add("default", declaration.type === "Identifier" ? (bindings.get(declaration.name) ?? []) : [declaration]);
    }
  }
  return exported;
};
// The component each docs module exports by default, by name.
const defaultExportNames = new Map();
// Local names a module gives imported components: Answer for {QuickAnswer as Answer}, or Card for
// the default export of a module whose default is Panel.
const importAliases = (program, filePath) => {
  const aliases = new Map();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const specifier of statement.specifiers) {
      const imported = specifier.type === "ImportDefaultSpecifier"
        ? defaultExportNames.get(resolveImport(filePath, statement.source.value))
        : (specifier.imported?.name ?? specifier.imported?.value);
      if (imported) aliases.set(specifier.local.name, imported);
    }
  }
  return aliases;
};
const isComponentName = (name) => /^[A-Z]/.test(name ?? "");
// The props each docs component renders, by component name, as its source shows them; a page or a
// component that passes one of these props passes copy.
const renderedProps = new Map();
const renderedPropCount = () => [...renderedProps.values()].reduce((count, props) => count + props.size, 0);
let renderedPropsVersion = 0;
const recordProp = (component, prop) => {
  const props = renderedProps.get(component) ?? new Set();
  renderedProps.set(component, props);
  if (!props.has(prop)) renderedPropsVersion += 1;
  props.add(prop);
};
// The exports another module renders, by module, so the module that defines them reads them as copy.
const renderedExports = new Map();
const renderedExportCount = () => [...renderedExports.values()].reduce((count, names) => count + names.size, 0);
// DOM properties a reader sees, so element.textContent = label renders label.
const domCopyProperties = new Set(["textContent", "innerText", "title", "alt", "placeholder", "label", "ariaLabel", "ariaDescription"]);
// Readers for one module: renderedStrings and componentCopy, resolving names through its bindings
// and the components it imports under other names through its aliases.
// dataKeys are the extra fields a JSON file's importers render, read like copy-named properties.
const copyReaders = (bindings = new Map(), aliases = new Map(), dataKeys = new Set()) => {
  // A bound value can be reached through many names and calls, so what it renders is worked out once.
  const resolving = new Set();
  const resolved = new Map();
  let resolvedVersion = renderedPropsVersion;
  // The fields this module renders from its objects, such as color.name, for the JSON it imports.
  const renderedMembers = new Set();
  const isCopyProperty = (property) =>
    !property.computed && (copyKeys.has(propertyKey(property)) || dataKeys.has(propertyKey(property)));
  const objectsOf = (expression) =>
    expression?.type === "ObjectExpression"
      ? [expression]
      : expression?.type === "Identifier"
        ? (bindings.get(expression.name) ?? []).filter((value) => value.type === "ObjectExpression")
        : [];
  // Static HTML a component injects renders like raw HTML in a guide.
  const innerHtmlStrings = (expression, emit) => {
    for (const property of objectsOf(expression).flatMap((object) => object.properties)) {
      if (property.type === "ObjectProperty" && propertyKey(property) === "__html") {
        renderedStrings(property.value, (text, line) => emit(htmlText(text), line));
      }
    }
  };
  // A prop is copy when it is a readable attribute or one the component renders.
  const isRenderedProp = (element, name) => readableAttributes.includes(name) || renderedProps.get(element)?.has(name);
  // A spread passes each property as a prop, so {...{question: "…"}} passes question.
  const spreadStrings = (expression, emit, element) => {
    for (const property of objectsOf(expression).flatMap((object) => object.properties)) {
      if (property.type === "ObjectProperty" && !property.computed && isRenderedProp(element, propertyKey(property))) {
        renderedStrings(property.value, emit);
      } else {
        componentCopy(property, emit);
      }
    }
  };
  const attributeStrings = (attribute, emit, element) => {
    const name = jsxName(attribute.name);
    if (name === "dangerouslySetInnerHTML") innerHtmlStrings(attribute.value?.expression, emit);
    else if (isRenderedProp(element, name)) renderedStrings(attribute.value, emit);
    else if (attribute.value?.type === "JSXExpressionContainer") componentCopy(attribute.value.expression, emit);
  };
  // A JSX element's attributes are read for the element they sit on; a code element's children are code.
  const elementStrings = (node, emit, read) => {
    if (node.type === "JSXOpeningElement") {
      const element = aliases.get(jsxName(node.name)) ?? jsxName(node.name);
      for (const attribute of node.attributes) {
        if (attribute.type === "JSXAttribute") attributeStrings(attribute, emit, element);
        else if (attribute.type === "JSXSpreadAttribute") spreadStrings(attribute.argument, emit, element);
      }
      return true;
    }
    if (node.type === "JSXElement" && codeElements.has(jsxName(node.openingElement.name))) {
      read(node.openingElement, emit);
      return true;
    }
    return false;
  };
  // A callback renders an arrow's expression body, or what its block body returns; the rest of the
  // block is read like any component code.
  const callbackStrings = (callback, emit) =>
    callback.body.type === "BlockStatement" ? componentCopy(callback.body, emit, true) : renderedStrings(callback.body, emit);
  const renderedStrings = (node, emit) => {
    if (Array.isArray(node)) {
      for (const item of node) renderedStrings(item, emit);
      return;
    }
    if (!node || typeof node.type !== "string") return;
    if (elementStrings(node, emit, renderedStrings)) return;
    switch (node.type) {
      case "PropReference":
        recordProp(node.component, node.prop);
        return;
      case "PropsObject":
        return;
      // An export of another docs module, read as copy where that module defines it.
      case "ImportedBinding": {
        const names = renderedExports.get(node.file) ?? new Set();
        renderedExports.set(node.file, names.add(node.name));
        return;
      }
      case "FunctionDeclaration":
        callbackStrings(node, emit);
        return;
      case "StringLiteral":
      case "JSXText":
        emit(node.value, node.loc.start.line);
        return;
      case "TemplateLiteral":
        for (const quasi of node.quasis) emit(quasi.value.cooked ?? quasi.value.raw, quasi.loc.start.line);
        renderedStrings(node.expressions, emit);
        return;
      case "JSXAttribute":
        attributeStrings(node, emit);
        return;
      case "ObjectProperty":
        if (isCopyProperty(node)) renderedStrings(node.value, emit);
        else componentCopy(node.value, emit);
        return;
      case "Identifier":
        if (resolvedVersion !== renderedPropsVersion) {
          resolved.clear();
          resolvedVersion = renderedPropsVersion;
        }
        for (const value of bindings.get(node.name) ?? []) {
          if (resolving.has(value)) continue;
          let strings = resolved.get(value);
          if (!strings) {
            // Each string once: a value reached along many paths would otherwise repeat its strings
            // at every level and grow without bound.
            const unique = new Map();
            resolving.add(value);
            renderedStrings(value, (text, line) => unique.set(`${line}\u0000${text}`, [text, line]));
            resolving.delete(value);
            strings = [...unique.values()];
            resolved.set(value, strings);
          }
          for (const [text, line] of strings) emit(text, line);
        }
        return;
      case "MemberOf":
      case "MemberExpression":
      case "OptionalMemberExpression": {
        const key = node.type === "MemberOf" ? node.key : !node.computed && node.property.type === "Identifier" ? node.property.name : undefined;
        if (key) renderedMembers.add(key);
        // props.question renders the question prop of the component props belongs to.
        for (const value of key && node.object.type === "Identifier" ? (bindings.get(node.object.name) ?? []) : []) {
          if (value.type === "PropsObject") recordProp(value.component, key);
        }
        renderedStrings(node.object, emit);
        return;
      }
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
          if (isFunction(argument)) callbackStrings(argument, emit);
          // A named callback renders what it returns too, as in rows.map(rowLabel).
          else if (argument.type === "Identifier" && bindings.get(argument.name)?.some((value) => ownsReturns(value))) {
            renderedStrings(argument, emit);
          } else componentCopy(argument, emit);
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
    if (isFunction(node)) {
      callbackStrings(node, emit);
      return;
    }
    for (const [key, value] of Object.entries(node)) if (!syntaxKeys.has(key)) renderedStrings(value, emit);
  };

  // In a docs component, copy is what its JSX shows and the data it renders: JSX text, readable
  // attributes, what a JSX expression renders, the value of a copy-named property such as label or
  // description, the value setAttribute gives a readable attribute, and the text a set…Label or
  // set…Text call sets. Ids, keys, class names, CSS values, and event and element names are names.
  // returnsRender is true inside a callback a JSX expression renders: its returns render, while a
  // function nested in it returns for itself.
  const copySetter = /^set\w*(?:Label|Text|Title|Message|Description)$/;
  const componentCopy = (node, emit, returnsRender = false) => {
    if (Array.isArray(node)) {
      for (const item of node) componentCopy(item, emit, returnsRender);
      return;
    }
    if (!node || typeof node.type !== "string") return;
    // In a component or callback body, JSX renders only once it is returned or reached through a
    // rendered binding, so JSX built and left aside is not copy.
    if (returnsRender && (node.type === "JSXElement" || node.type === "JSXFragment")) return;
    if (elementStrings(node, emit, componentCopy)) return;
    switch (node.type) {
      case "JSXText":
        emit(node.value, node.loc.start.line);
        return;
      case "AssignmentExpression":
        if (node.left.type === "MemberExpression" && !node.left.computed && domCopyProperties.has(node.left.property.name)) {
          renderedStrings(node.right, emit);
          return;
        }
        break;
      case "JSXAttribute":
        attributeStrings(node, emit);
        return;
      case "JSXExpressionContainer":
        renderedStrings(node.expression, emit);
        return;
      case "ReturnStatement":
        if (!returnsRender) break;
        renderedStrings(node.argument, emit);
        return;
      // A component, by React's capitalized name or as a module's default export, renders its returns.
      case "FunctionDeclaration":
        if (!isComponentName(node.id?.name)) break;
        callbackStrings(node, emit);
        return;
      case "VariableDeclarator":
        if (node.id.type !== "Identifier" || !isComponentName(node.id.name) || !isFunction(node.init)) break;
        callbackStrings(node.init, emit);
        return;
      case "ExportDefaultDeclaration":
        if (node.declaration.type !== "FunctionDeclaration" && !isFunction(node.declaration)) break;
        callbackStrings(node.declaration, emit);
        return;
      case "ObjectProperty":
        if (isCopyProperty(node)) renderedStrings(node.value, emit);
        else componentCopy(node.value, emit, returnsRender);
        return;
      case "CallExpression":
      case "OptionalCallExpression": {
        const callee = node.callee.type.endsWith("MemberExpression") ? node.callee.property.name : node.callee.name;
        const [first, second] = node.arguments;
        if (callee === "setAttribute" && first?.type === "StringLiteral" && readableAttributes.includes(first.value)) {
          renderedStrings(second, emit);
        } else if (copySetter.test(callee ?? "")) {
          renderedStrings(first, emit);
        }
        componentCopy(node.callee, emit, returnsRender);
        componentCopy(node.arguments, emit, returnsRender);
        return;
      }
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "TaggedTemplateExpression":
        return;
    }
    if (node.type.startsWith("TS") && !["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"].includes(node.type)) return;
    const nested = ownsReturns(node) ? false : returnsRender;
    for (const [key, value] of Object.entries(node)) if (!syntaxKeys.has(key)) componentCopy(value, emit, nested);
  };
  return {renderedStrings, componentCopy, renderedMembers, spreadStrings, innerHtmlStrings};
};

// An MDX expression, such as {done ? "Closed" : "Open"}, renders its strings, and the value of a
// prop is read like component data. One that holds only a comment, {/* … */}, renders nothing.
// It is parsed at its own line, so a literal reports where it stands; Babel takes a start line only
// with a start column and index.
const startingAt = (line) => ({startLine: line, startColumn: 0, startIndex: 0});
const expressionStrings = (source, line, emit, read) => {
  let expression;
  try {
    expression = parseExpression(source, {plugins: ["jsx"], ...startingAt(line)});
  } catch {
    return;
  }
  read(expression, emit);
};
// Raw HTML in a CommonMark guide: comments and code elements are not copy, a tag is markup read only
// for its readable attributes, and the text between tags is copy.
// A tag's attributes are read in order, so a quoted value can hold ">" or "alt=" and stays one value,
// and a value can go unquoted. HTML attribute names ignore case, so ALT is alt.
const htmlAttribute = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/dg;
const htmlText = (html) =>
  html.replace(/<!--[\s\S]*?--!?>|<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, blankKeepingLines).replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, (tag) => {
    const kept = blankKeepingLines(tag).split("");
    for (const match of tag.matchAll(htmlAttribute)) {
      const value = match.indices.slice(2).find(Boolean);
      if (!value || !readableAttributes.includes(match[1].toLowerCase())) continue;
      for (let at = value[0]; at < value[1]; at += 1) kept[at] = tag[at];
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
const codeElements = new Set(["code", "pre", "CodeBlock"]);

// commonMark is true for the guides outside the docs site; the site parses every page as MDX.
const ukSpellingsIn = (text, {identifiers = new Set(), commonMark = false, filePath} = {}) => {
  const {found, check} = spellingCollector(identifiers);
  const tree = (commonMark ? commonMarkGuide : mdxPage).parse(text.replace(notMdx, blankKeepingLines));
  const lineOf = (node) => node.position?.start.line ?? 1;
  // A page's ESM imports components, sometimes under other names, and declares constants it renders;
  // parsed at their own lines, they give the page's expressions their bindings.
  const pageAliases = new Map();
  const pageBindings = new Map();
  for (const node of tree.children) {
    if (node.type !== "mdxjsEsm") continue;
    try {
      const {program} = parseModule(node.value, {sourceType: "module", plugins: ["jsx"], ...startingAt(lineOf(node))});
      for (const [local, imported] of importAliases(program, filePath)) pageAliases.set(local, imported);
      for (const [name, values] of collectBindings(program, filePath)) {
        pageBindings.set(name, [...(pageBindings.get(name) ?? []), ...values]);
      }
    } catch {
      // The docs build reports an import it cannot parse.
    }
  }
  const page = copyReaders(pageBindings, pageAliases);
  const readAttributes = (element) => {
    const component = pageAliases.get(element.name) ?? element.name;
    for (const attribute of element.attributes ?? []) {
      const line = attribute.position?.start.line ?? lineOf(element);
      // A spread, {...{question: "…"}}, passes each property as a prop; MDX gives its value without braces.
      if (attribute.type === "mdxJsxExpressionAttribute") {
        const spread = attribute.value.trim().replace(/^\.\.\./, "");
        expressionStrings(spread, line, check, (value, emit) => page.spreadStrings(value, emit, component));
        continue;
      }
      if (attribute.type !== "mdxJsxAttribute") continue;
      const expression = attribute.value?.type === "mdxJsxAttributeValueExpression" ? attribute.value.value : null;
      if (attribute.name === "dangerouslySetInnerHTML") {
        if (expression !== null) expressionStrings(expression, line, check, page.innerHtmlStrings);
        continue;
      }
      // A readable attribute is copy, and so is a prop the component renders, such as a question.
      if (readableAttributes.includes(attribute.name) || renderedProps.get(component)?.has(attribute.name)) {
        if (typeof attribute.value === "string") check(attribute.value, line);
        else if (expression !== null) expressionStrings(expression, line, check, page.renderedStrings);
      } else if (expression !== null) {
        // Data a component renders, such as items={[{label: "…"}]}, is read for its copy-named fields.
        expressionStrings(expression, line, check, page.componentCopy);
      }
    }
  };
  // A segment's text is read in order, with code and markup standing in as a word, so a sentence
  // starts where the reader sees one; titles, alt text and expressions are read on their own.
  const readSegment = (block) => {
    const pieces = [];
    // Inline raw HTML arrives tag by tag, so the text of a code element sits between its tags.
    let insideCode = 0;
    const flatten = (node) => {
      if (node.type === "text") {
        pieces.push(insideCode > 0 ? {text: " x ", copy: false} : {text: node.value, line: lineOf(node), copy: true});
        return;
      }
      if (node.type === "html" && /^<(?:code|pre)\b[^>]*(?<!\/)>$/i.test(node.value)) insideCode += 1;
      if (node.type === "html" && /^<\/(?:code|pre)\s*>$/i.test(node.value)) insideCode = Math.max(0, insideCode - 1);
      if ((node.type === "link" || node.type === "image") && node.title) check(node.title, lineOf(node));
      if ((node.type === "image" || node.type === "imageReference") && node.alt) check(node.alt, lineOf(node));
      if (node.type === "html") check(htmlText(node.value), lineOf(node));
      if (node.type === "mdxTextExpression") expressionStrings(node.value, lineOf(node), check, page.renderedStrings);
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
        expressionStrings(node.value, lineOf(node), check, page.renderedStrings);
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

const reportUkSpellings = (relativePath, found, where = "") => {
  for (const {line, word, us} of found) {
    fail(relativePath, `UK spelling on line ${line}: "${word}"; English copy uses US spelling ("${us}"), see DESIGN.md § Voice & Copy.${where}`);
  }
};
const failUkSpellings = (relativePath, text, {generated = false, commonMark = false} = {}) => {
  let found;
  try {
    found = ukSpellingsIn(text, {identifiers: generated ? enumNames : undefined, commonMark, filePath: path.resolve(repoRoot, relativePath)});
  } catch (error) {
    // The docs build rejects a page it cannot parse, so the build reports the syntax error.
    warn(relativePath, `Skipped the US-spelling check, since the page does not parse: ${error.message}`);
    return;
  }
  reportUkSpellings(relativePath, found, generated ? " Fix it in the source this page is generated from." : "");
};

// Copy outside the docs site that readers still meet: release notes, the design guidance and the
// onboarding guide.
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
    ...["DESIGN.md", "docs/DESIGN.md", "ONBOARDING.md"].map((relativePath) => path.resolve(repoRoot, relativePath)).filter(existsSync),
    ...packageDesigns,
    ...(await optionalWalk("docs/releases")),
    ...(await optionalWalk(".claude/skills/design")),
  ];
};

const guideFiles = await usSpellingGuides();
for (const filePath of guideFiles) {
  failUkSpellings(path.relative(repoRoot, filePath).replace(/\\/g, "/"), await fs.readFile(filePath, "utf8"), {commonMark: true});
}

// The docs site's components and modules, parsed as TypeScript and JSX, and the JSON data they
// render, read like component data. Tests render nothing. A generated data file is read at its
// source when this audit reads that source, and otherwise read itself, its errors naming the source.
const relativeToRepo = (filePath) => path.relative(repoRoot, filePath).replace(/\\/g, "/");
const docsSourceFiles = [
  ...(await walkAllFiles(path.resolve(repoRoot, "docs/src"))).filter(
    (filePath) => /\.(?:jsx?|tsx?|json)$/.test(filePath) && !/\.(?:test|spec)\.|[\\/]__tests__[\\/]/.test(filePath),
  ),
  // The site title, tagline, navbar and footer labels, and the sidebar's labels are copy too.
  ...[docusaurusConfigPath, sidebarsPath].filter(existsSync),
];
const auditedSources = new Set([...guideFiles, ...docsSourceFiles.filter((filePath) => !filePath.endsWith(".json"))].map(relativeToRepo));
for (const filePath of docsSourceFiles.filter((file) => !file.endsWith(".json"))) {
  const plugins = filePath.endsWith(".ts") ? ["typescript"] : filePath.endsWith(".tsx") ? ["typescript", "jsx"] : ["jsx"];
  try {
    parsedModules.set(filePath, {program: parseModule(await fs.readFile(filePath, "utf8"), {sourceType: "module", plugins}).program});
  } catch (error) {
    warn(relativeToRepo(filePath), `Skipped the US-spelling check, since the file does not parse: ${error.message}`);
  }
}
for (const [filePath, {program}] of parsedModules) {
  const declaration = program.body.find((statement) => statement.type === "ExportDefaultDeclaration")?.declaration;
  const name = declaration?.type === "Identifier" ? declaration.name : declaration?.id?.name;
  if (name) defaultExportNames.set(filePath, name);
}
for (const [filePath, parsed] of parsedModules) {
  const bindings = collectBindings(parsed.program, filePath);
  const aliases = importAliases(parsed.program, filePath);
  Object.assign(parsed, {bindings, aliases, readers: copyReaders(bindings, aliases), exports: moduleExports(parsed.program, bindings, filePath)});
}
// The exports another module renders, read where they are defined.
const renderedExportValues = (filePath, parsed) =>
  [...(renderedExports.get(filePath) ?? [])].flatMap((name) => parsed.exports.get(name) ?? []);
// Learn, to a fixed point, the props each component renders and the exports other modules render.
const learnRenderedCopy = () => {
  for (let learned = -1; learned !== renderedPropCount() + renderedExportCount(); ) {
    learned = renderedPropCount() + renderedExportCount();
    for (const [filePath, parsed] of parsedModules) {
      parsed.readers.componentCopy(parsed.program, () => {});
      parsed.readers.renderedStrings(renderedExportValues(filePath, parsed), () => {});
    }
  }
};
learnRenderedCopy();
// Data, a JSON file or the exports of a module that others render, is read for its copy-named fields
// and for the fields its importers render, such as a palette's name and role.
const renderedDataFields = new Map();
for (const [filePath, {program, readers}] of parsedModules) {
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
    const source = statement.source.value;
    const target = !source.endsWith(".json")
      ? resolveImport(filePath, source)
      : source.startsWith("@site/")
        ? path.resolve(repoRoot, "docs", source.slice("@site/".length))
        : path.resolve(path.dirname(filePath), source);
    if (target) renderedDataFields.set(target, new Set([...(renderedDataFields.get(target) ?? []), ...readers.renderedMembers]));
  }
}
for (const filePath of docsSourceFiles) {
  const relativePath = relativeToRepo(filePath);
  const source = await fs.readFile(filePath, "utf8");
  const {found, check} = spellingCollector();
  let generated = false;
  try {
    if (filePath.endsWith(".json")) {
      const data = parseExpression(source);
      const envelope = new Map(
        (data.type === "ObjectExpression" ? data.properties : []).map((property) => [propertyKey(property), property.value]),
      );
      generated = envelope.has("$generated");
      if (generated && auditedSources.has(envelope.get("source")?.value)) continue;
      copyReaders(new Map(), new Map(), renderedDataFields.get(filePath)).componentCopy(data, check);
    } else {
      const parsed = parsedModules.get(filePath);
      if (!parsed) continue;
      parsed.readers.componentCopy(parsed.program, check);
      parsed.exportScan = {readers: copyReaders(parsed.bindings, parsed.aliases, renderedDataFields.get(filePath)), found, check};
      parsed.exportScan.readers.renderedStrings(renderedExportValues(filePath, parsed), check);
    }
  } catch (error) {
    warn(relativePath, `Skipped the US-spelling check, since the file does not parse: ${error.message}`);
    continue;
  }
  reportUkSpellings(relativePath, found, generated ? " Fix it in the source this file is generated from." : "");
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

// A page can render another module's export as well, such as a list of labels: it is read where that
// module defines it, and only what the module scan above has not reported yet is reported.
learnRenderedCopy();
for (const [filePath, parsed] of parsedModules) {
  if (!parsed.exportScan) continue;
  const {readers, found, check} = parsed.exportScan;
  const reported = found.length;
  readers.renderedStrings(renderedExportValues(filePath, parsed), check);
  reportUkSpellings(relativeToRepo(filePath), found.slice(reported));
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
    // The redirect plugin also supports external destinations for retired source material.
    if (/^https?:/.test(match[1])) {
      try {
        const url = new URL(match[1]);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe URL");
      } catch {
        fail("docs/docusaurus.config.ts", `Invalid external redirect target: ${match[1]}`);
      }
      continue;
    }
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
