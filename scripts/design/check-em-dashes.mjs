#!/usr/bin/env node
// check-em-dashes.mjs
// Rejects the em dash (U+2014) in product copy and authored docs pages (DESIGN.md § Voice & Copy):
// a sentence that wants one is restructured with a period, colon, comma, or parentheses.
//
// Reads every message value in the i18n catalogs and every docs/docs page. A page named
// *.generated.mdx, or generated from the ontology (its generated_from frontmatter lists an
// ontology source), keeps the ontology's punctuation and is skipped. Fenced code and inline code
// spans are code, not copy. In docs pages an HTML entity for the em dash counts as one.
//
// Runs as `bun run check --only em-dashes` from the repo root.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");

export const CATALOGS = ["en", "es", "pt"].map((locale) => `packages/shared/src/i18n/${locale}.json`);
export const DOCS_ROOT = "docs/docs";
const ONTOLOGY_SOURCE = "packages/shared/src/ontology/";
const EM_DASH = "—";
const DOCS_EM_DASH = /—|&mdash;|&#8212;|&#x2014;/i;
const FENCE = /^\s*(`{3,}|~{3,})/;
// A run of backticks, then anything up to the same run: one inline code span.
const INLINE_CODE = /(`+)(?:(?!\1)[\s\S])*?\1/g;

function excerpt(text, at) {
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** One failure per catalog message whose value carries an em dash, named by its key. */
export function catalogHits(relativePath, text) {
  return Object.entries(JSON.parse(text))
    .filter(([, value]) => typeof value === "string" && value.includes(EM_DASH))
    .map(([key, value]) => `${relativePath}: ${key}: ${excerpt(value, value.indexOf(EM_DASH))}`);
}

/** One failure per docs line whose prose (outside code) carries an em dash or its entity. */
export function docsHits(relativePath, text) {
  const hits = [];
  let fence;
  text.split("\n").forEach((line, index) => {
    const marker = line.match(FENCE)?.[1];
    if (marker && !fence) {
      fence = marker;
      return;
    }
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return;
    }
    const prose = line.replace(INLINE_CODE, "");
    const at = prose.search(DOCS_EM_DASH);
    if (at >= 0) hits.push(`${relativePath}:${index + 1}: ${excerpt(prose, at)}`);
  });
  return hits;
}

/** True when the page's generated_from frontmatter names an ontology source. */
export function projectsOntology(text) {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  const sources = frontmatter.match(/^generated_from:\n((?:[ \t]+- .*\n?)+)/m)?.[1] ?? "";
  return sources.split("\n").some((line) => line.trim().startsWith(`- ${ONTOLOGY_SOURCE}`));
}

function docsPages(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return docsPages(entryPath);
      return /\.mdx?$/.test(entry.name) ? [entryPath] : [];
    })
    .sort();
}

export function scanRepository(root) {
  const failures = [];
  for (const relativePath of CATALOGS) {
    failures.push(...catalogHits(relativePath, fs.readFileSync(path.join(root, relativePath), "utf8")));
  }
  let pages = 0;
  let skipped = 0;
  for (const file of docsPages(path.join(root, DOCS_ROOT))) {
    const relativePath = path.relative(root, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    if (relativePath.endsWith(".generated.mdx") || projectsOntology(text)) {
      skipped += 1;
      continue;
    }
    pages += 1;
    failures.push(...docsHits(relativePath, text));
  }
  return { failures, pages, skipped };
}

function main() {
  try {
    if (process.argv.length > 2) throw new Error(`unknown argument: ${process.argv[2]}`);
    const { failures, pages, skipped } = scanRepository(repoRoot);
    if (failures.length > 0) {
      console.error(`check-em-dashes: ${failures.length} em dash(es) in product copy or docs pages:`);
      for (const failure of failures) console.error(`- ${failure}`);
      console.error(
        "Restructure each sentence with a period, colon, comma, or parentheses, never a hyphen or a spaced en dash.",
      );
      console.error(
        "A generated page changes at the source its generated_from frontmatter names; then run node scripts/docs/generate.mjs.",
      );
      console.error("The rule: DESIGN.md § Voice & Copy.");
      process.exit(1);
    }
    console.log(
      `check-em-dashes: no em dashes in ${CATALOGS.length} i18n catalogs or ${pages} docs pages (${skipped} generated from the ontology skipped).`,
    );
  } catch (error) {
    console.error(`check-em-dashes: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
