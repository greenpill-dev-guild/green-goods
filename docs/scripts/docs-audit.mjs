#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const docsRoot = path.resolve(repoRoot, "docs/docs");
const referenceRoot = path.resolve(docsRoot, "reference");
const introDocPath = path.resolve(docsRoot, "intro.md");
const glossaryDocPath = path.resolve(docsRoot, "glossary.md");

const isCi = process.argv.includes("--ci");

const canonicalRoots = [
  path.resolve(docsRoot, "gardener"),
  path.resolve(docsRoot, "operator"),
  path.resolve(docsRoot, "evaluator"),
  path.resolve(docsRoot, "developers"),
];

const approvedEndpointLiteralFiles = new Set([
  "docs/docs/developers/reference/api-index.mdx",
]);

const requiredFrontmatter = [
  "audience",
  "owner",
  "last_verified",
  "feature_status",
  "source_of_truth",
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
  "source_of_truth",
];

const allowedFeatureStatus = new Set([
  "Live",
  "Implemented (activation pending indexing)",
  "Implemented (activation pending deployment)",
  "Planned",
]);

const allowedDifficulty = new Set(["quickstart", "standard", "advanced"]);

const placeholderPattern = /\b(TODO|TBD|PLACEHOLDER)\b/i;
const stalePattern = /(coming soon|2024 roadmap|future phase|planned for q\d|to be announced)/i;
const endpointLiteralPattern =
  /https:\/\/indexer\.hyperindex\.xyz\/\S+|https:\/\/(?:arbitrum|celo|sepolia)\.easscan\.org\S*/gi;
const emptyMarkdownLinkPattern = /\[\s*]\([^)]+\)/;
const incompletePhrasePattern = /\bsee the\s+for\b/i;

const warnings = [];

const warn = (filePath, message) => {
  warnings.push({filePath, message});
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

const isExternalHref = (href) =>
  /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href);

const stripHashAndQuery = (href) => href.split("#")[0].split("?")[0];

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
    return {frontmatter: yaml.load(raw) ?? {}, body};
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

const isCanonicalFile = (filePath) => canonicalRoots.some((root) => filePath.startsWith(root));
const isMonitoredDoc = (filePath) =>
  isCanonicalFile(filePath) ||
  filePath.startsWith(referenceRoot) ||
  filePath === introDocPath ||
  filePath === glossaryDocPath;

const isNonReferenceCanonical = (relativePath) => {
  if (!relativePath.startsWith("docs/docs/")) {
    return false;
  }
  if (!isCanonicalFile(path.resolve(repoRoot, relativePath))) {
    return false;
  }
  return !relativePath.startsWith("docs/docs/developers/reference/");
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
      .filter((chunk) => !chunk.startsWith("<"))
      .filter((chunk) => !chunk.includes("NextBestAction"))
      .filter((chunk) => !chunk.includes("AtAGlanceCard"));

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

const allDocs = await walk(docsRoot);
const docFileSet = new Set(allDocs.map((filePath) => path.normalize(filePath)));
const canonicalDocs = [];

for (const filePath of allDocs) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  const raw = await fs.readFile(filePath, "utf8");
  const {frontmatter, body} = parseFrontmatter(raw);
  const canonical = isCanonicalFile(filePath);
  const monitored = isMonitoredDoc(filePath);

  if (canonical) {
    canonicalDocs.push({relativePath, body});
  }

  if (!monitored) {
    continue;
  }

  if (placeholderPattern.test(raw)) {
    warn(relativePath, "Contains placeholder marker (TODO/TBD/PLACEHOLDER).");
  }

  if (stalePattern.test(raw)) {
    warn(relativePath, "Contains stale-language marker (for example 'coming soon' or old roadmap phrasing).");
  }

  if (emptyMarkdownLinkPattern.test(raw)) {
    warn(relativePath, "Contains empty markdown link text.");
  }

  if (incompletePhrasePattern.test(raw)) {
    warn(relativePath, "Contains incomplete phrase pattern (for example 'See the  for').");
  }

  const rawWithoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, "");
  const markdownLinkMatches = rawWithoutCodeBlocks.matchAll(/\[[^\]]*]\(([^)]+)\)/g);
  for (const match of markdownLinkMatches) {
    const href = (match[1] ?? "").trim();
    if (!href) {
      continue;
    }
    if (!resolveDocLink(filePath, href, docFileSet)) {
      warn(relativePath, `Relative markdown link target not found: ${href}`);
    }
  }

  if (!frontmatter || typeof frontmatter !== "object") {
    warn(relativePath, "Missing or invalid YAML frontmatter.");
  } else {
    for (const key of requiredTrustFrontmatter) {
      if (!(key in frontmatter)) {
        warn(relativePath, `Missing required frontmatter field: ${key}`);
      }
    }

    const nonReferenceCanonical = isNonReferenceCanonical(relativePath);

    if (nonReferenceCanonical) {
      for (const key of requiredFrontmatter) {
        if (!(key in frontmatter)) {
          warn(relativePath, `Missing required frontmatter field: ${key}`);
        }
      }
    }

    const featureStatus = frontmatter.feature_status;
    if (featureStatus && !allowedFeatureStatus.has(String(featureStatus))) {
      warn(relativePath, `Invalid feature_status value: ${featureStatus}`);
    }

    const difficulty = frontmatter.difficulty;
    if (difficulty && !allowedDifficulty.has(String(difficulty))) {
      warn(relativePath, `Invalid difficulty value: ${difficulty}`);
    }

    const sourceOfTruth = frontmatter.source_of_truth;
    if (sourceOfTruth) {
      const sourcePaths = Array.isArray(sourceOfTruth) ? sourceOfTruth : [sourceOfTruth];
      for (const sourcePath of sourcePaths) {
        if (typeof sourcePath !== "string") {
          warn(relativePath, "source_of_truth contains a non-string entry.");
          continue;
        }
        if (sourcePath.startsWith("http://") || sourcePath.startsWith("https://")) {
          continue;
        }
        if (!(await fileExists(sourcePath))) {
          warn(relativePath, `source_of_truth path not found: ${sourcePath}`);
        }
      }
    }
  }

  const endpointMatches = raw.match(endpointLiteralPattern) ?? [];
  if (endpointMatches.length > 0 && !approvedEndpointLiteralFiles.has(relativePath)) {
    warn(relativePath, "Contains hardcoded endpoint literal. Use docs/src/data/endpoints.ts or API index reference.");
  }
}

collectDuplicateBlocks(canonicalDocs);

const sortedWarnings = warnings.sort((a, b) => {
  if (a.filePath === b.filePath) {
    return a.message.localeCompare(b.message);
  }
  return a.filePath.localeCompare(b.filePath);
});

if (sortedWarnings.length === 0) {
  console.log("docs-audit: no warnings.");
  process.exit(0);
}

console.log(`docs-audit: ${sortedWarnings.length} warning(s).`);
for (const warning of sortedWarnings) {
  console.log(`- ${warning.filePath}: ${warning.message}`);
}

if (isCi) {
  console.log("docs-audit: CI mode is warn-only; exiting with code 0.");
}

process.exit(0);
