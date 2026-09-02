import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const GENERATOR_PATH = "scripts/docs/generate.mjs";
export const SCOPES = ["package", "integration", "ontology", "workflow", "qa", "agentic"];

export function normalizeText(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n*$/, "\n");
}

export function sourceDigest(root, sources) {
  const hash = createHash("sha256");
  for (const source of [...new Set(sources)].sort()) {
    const absolute = path.join(root, source);
    if (!existsSync(absolute)) throw new Error(`Missing generated authority source: ${source}`);
    hash.update(source);
    hash.update("\0");
    hash.update(normalizeText(readFileSync(absolute, "utf8")));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function generatedFrontmatter({ title, slug, audience = "developer", featureStatus = "Live", sources, digest, extra = [] }) {
  return [
    "---",
    `title: ${title}`,
    `slug: ${slug}`,
    `audience: ${audience}`,
    "owner: docs",
    `feature_status: ${featureStatus}`,
    "generated: true",
    `generator: ${GENERATOR_PATH}`,
    "generated_from:",
    ...sources.map((source) => `  - ${source}`),
    `source_digest: \"${digest}\"`,
    "source_of_truth:",
    ...sources.map((source) => `  - ${source}`),
    ...extra,
    "---",
    "",
    `<!-- GENERATED FILE: do not edit. Run \`bun run docs:generate\` or \`bun run docs:generate -- --scope <scope>\`. -->`,
    "",
  ].join("\n");
}

export function parseGeneratorArgs(argv) {
  let check = false;
  let scope = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") check = true;
    else if (arg === "--scope") scope = argv[++index];
    else throw new Error(`Unknown docs generator argument: ${arg}`);
  }
  if (scope && !SCOPES.includes(scope)) {
    throw new Error(`Unknown docs generator scope: ${scope}. Expected one of ${SCOPES.join(", ")}.`);
  }
  return { check, scope };
}

function generatorOwnedFiles(root) {
  const docsRoot = path.join(root, "docs/docs");
  const found = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.mdx?$/.test(entry.name)) {
        const text = readFileSync(absolute, "utf8");
        if (/^generated:\s*true\s*$/m.test(text) && new RegExp(`^generator:\\s*${GENERATOR_PATH.replaceAll("/", "\\/")}\\s*$`, "m").test(text)) {
          found.push(path.relative(root, absolute));
        }
      }
    }
  };
  visit(docsRoot);
  return found.sort();
}

export function renderProjection(root, projection) {
  const sources = [...new Set(projection.sources)].sort();
  const digest = sourceDigest(root, sources);
  const content = projection.render({ root, sources, digest });
  return normalizeText(content);
}

export function syncProjections({ root, projections, scope = null, check = false }) {
  const selected = scope ? projections.filter((projection) => projection.scope === scope) : projections;
  const problems = [];
  for (const projection of selected) {
    const rendered = renderProjection(root, projection);
    const absolute = path.join(root, projection.output);
    const current = existsSync(absolute) ? normalizeText(readFileSync(absolute, "utf8")) : null;
    if (current !== rendered) {
      if (check) problems.push(`${current === null ? "missing" : "stale"}: ${projection.output}`);
      else {
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, rendered);
      }
    }
  }

  if (!scope) {
    const expected = new Set(projections.map((projection) => projection.output));
    for (const output of generatorOwnedFiles(root)) {
      if (!expected.has(output)) problems.push(`extra: ${output}`);
    }
  }
  return problems;
}
