#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDocsDir = path.resolve(__dirname, "../docs");
const defaultBuildDir = path.resolve(__dirname, "../build");

function normalizeRoute(route) {
  const cleanRoute = String(route).split("#")[0].split("?")[0].trim();
  if (!cleanRoute || cleanRoute === "/") return "/";

  const withLeadingSlash = cleanRoute.startsWith("/") ? cleanRoute : `/${cleanRoute}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function parseFrontmatter(content, filePath) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${filePath} is missing YAML frontmatter`);
  }

  const frontmatter = yaml.load(match[1], {schema: yaml.YAML11_SCHEMA});
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new Error(`${filePath} has invalid YAML frontmatter`);
  }

  return frontmatter;
}

async function walkDocs(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDocs(entryPath)));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function collectLiveSourceRoutes(docsDir) {
  const files = await walkDocs(docsDir);
  const routes = new Set();

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(content, filePath);
    if (frontmatter.draft === true || frontmatter.unlisted === true) continue;

    if (typeof frontmatter.slug !== "string" || frontmatter.slug.trim() === "") {
      throw new Error(`${filePath} is missing a canonical frontmatter slug`);
    }

    const route = normalizeRoute(frontmatter.slug);
    if (routes.has(route)) {
      throw new Error(`Duplicate live source route: ${route}`);
    }
    routes.add(route);
  }

  return routes;
}

function collectIndexedRoutes(payload, indexPath) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`${indexPath} must contain a non-empty array of search buckets`);
  }

  const routes = new Set();
  for (const [bucketIndex, bucket] of payload.entries()) {
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
      throw new Error(`${indexPath} has an invalid search bucket at index ${bucketIndex}`);
    }
    if (!Array.isArray(bucket.documents)) {
      throw new Error(`${indexPath} has an invalid documents array at index ${bucketIndex}`);
    }
    if (!bucket.index || typeof bucket.index !== "object" || Array.isArray(bucket.index)) {
      throw new Error(`${indexPath} has an invalid Lunr index at index ${bucketIndex}`);
    }

    for (const [documentIndex, document] of bucket.documents.entries()) {
      if (!document || typeof document !== "object" || typeof document.u !== "string") {
        throw new Error(
          `${indexPath} has an invalid document at bucket ${bucketIndex}, index ${documentIndex}`,
        );
      }
      routes.add(normalizeRoute(document.u));
    }
  }

  if (routes.size === 0) {
    throw new Error(`${indexPath} contains no documents`);
  }

  return routes;
}

export async function checkSearchIndex({
  docsDir = defaultDocsDir,
  buildDir = defaultBuildDir,
} = {}) {
  const indexPath = path.join(buildDir, "search-index.json");
  const sourceRoutes = await collectLiveSourceRoutes(docsDir);

  let rawIndex;
  try {
    rawIndex = await fs.readFile(indexPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      throw new Error(`${indexPath} is missing`);
    }
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(rawIndex);
  } catch (error) {
    throw new Error(`${indexPath} is not valid JSON`, {cause: error});
  }

  const indexedRoutes = collectIndexedRoutes(payload, indexPath);
  const missingRoutes = [...sourceRoutes]
    .filter((route) => !indexedRoutes.has(route))
    .sort((left, right) => left.localeCompare(right));

  if (missingRoutes.length > 0) {
    const noun = missingRoutes.length === 1 ? "route" : "routes";
    throw new Error(
      `${indexPath} is missing ${missingRoutes.length} live source ${noun}: ${missingRoutes.join(", ")}`,
    );
  }

  return {
    sourceRouteCount: sourceRoutes.size,
    indexedRouteCount: indexedRoutes.size,
    indexPath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const result = await checkSearchIndex();
    process.stdout.write(
      `Search index covers ${result.sourceRouteCount} live source routes (${result.indexedRouteCount} indexed routes).\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
