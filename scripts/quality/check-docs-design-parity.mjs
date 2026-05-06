#!/usr/bin/env node
/**
 * check-docs-design-parity.mjs
 *
 * Asserts that role-accent and section-accent CSS variables in
 * `docs/src/css/custom.css` match the canonical values declared in
 * `docs/DESIGN.md` front matter (light + dark).
 *
 * The docs site uses its own dialect tokens that don't flow through the
 * shared `theme.css` projection, so `check:design-tokens` cannot catch
 * docs drift. This script closes that gap.
 *
 * Exits 1 on any mismatch; prints aligned variable / source / drift list.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import yaml from "js-yaml";

const REPO_ROOT = process.cwd();
const DESIGN_PATH = join(REPO_ROOT, "docs/DESIGN.md");
const CSS_PATH = join(REPO_ROOT, "docs/src/css/custom.css");

const LIGHT_BINDINGS = [
  { cssVar: "--docs-role-gardener", source: "roleAccents.gardener" },
  { cssVar: "--docs-role-operator", source: "roleAccents.operator" },
  { cssVar: "--docs-role-assessment", source: "roleAccents.assessment" },
  { cssVar: "--docs-role-funder", source: "roleAccents.funder" },
  { cssVar: "--docs-role-builder", source: "roleAccents.builder" },
  { cssVar: "--docs-accent-community", source: "colors.community-accent" },
  { cssVar: "--docs-accent-builders", source: "colors.builder-accent" },
];

const DARK_BINDINGS = [
  { cssVar: "--docs-accent-community", source: "darkColors.community-accent" },
  { cssVar: "--docs-accent-builders", source: "darkColors.builder-accent" },
  { cssVar: "--docs-role-gardener", source: "darkColors.community-accent" },
  { cssVar: "--docs-role-builder", source: "darkColors.builder-accent" },
];

function readFrontMatter(path) {
  const source = readFileSync(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match) {
    throw new Error(`Missing YAML front matter in ${path}`);
  }
  return yaml.load(match[1]);
}

function pluck(record, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => acc?.[key], record);
}

function normalizeHex(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith("#")) return undefined;
  return trimmed;
}

function extractBlock(css, selectorRegex) {
  const match = selectorRegex.exec(css);
  if (!match) return null;
  return match[1];
}

function extractVar(block, name) {
  if (!block) return undefined;
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  const match = re.exec(block);
  if (!match) return undefined;
  return normalizeHex(match[1]);
}

function check({ scope, block, bindings, designSpec }) {
  const drifts = [];
  for (const { cssVar, source } of bindings) {
    const designValue = normalizeHex(pluck(designSpec, source));
    const cssValue = extractVar(block, cssVar);
    if (!designValue) {
      drifts.push({
        scope,
        cssVar,
        source,
        kind: "missing-design",
        designValue: pluck(designSpec, source),
        cssValue,
      });
      continue;
    }
    if (!cssValue) {
      drifts.push({
        scope,
        cssVar,
        source,
        kind: "missing-css",
        designValue,
        cssValue,
      });
      continue;
    }
    if (designValue !== cssValue) {
      drifts.push({
        scope,
        cssVar,
        source,
        kind: "mismatch",
        designValue,
        cssValue,
      });
    }
  }
  return drifts;
}

function main() {
  const designSpec = readFrontMatter(DESIGN_PATH);
  const css = readFileSync(CSS_PATH, "utf8");
  const lightBlock = extractBlock(css, /:root\s*\{([\s\S]*?)\n\}/);
  const darkBlock = extractBlock(
    css,
    /\[data-theme=["']dark["']\]\s*\{([\s\S]*?)\n\}/,
  );

  if (!lightBlock) {
    console.error(`❌ Could not locate :root { ... } block in ${CSS_PATH}`);
    process.exit(2);
  }
  if (!darkBlock) {
    console.error(`❌ Could not locate [data-theme="dark"] { ... } block in ${CSS_PATH}`);
    process.exit(2);
  }

  const drifts = [
    ...check({ scope: "light", block: lightBlock, bindings: LIGHT_BINDINGS, designSpec }),
    ...check({ scope: "dark", block: darkBlock, bindings: DARK_BINDINGS, designSpec }),
  ];

  if (drifts.length > 0) {
    console.error("❌ Docs design parity drift detected:");
    for (const drift of drifts) {
      console.error(
        `  [${drift.scope}] ${drift.cssVar} (${drift.source}): ${drift.kind} — design=${drift.designValue ?? "(absent)"} css=${drift.cssValue ?? "(absent)"}`,
      );
    }
    console.error(
      `\nReconcile values between docs/DESIGN.md and docs/src/css/custom.css, then re-run.`,
    );
    process.exit(1);
  }

  console.log(
    `✅ check-docs-design-parity: ${LIGHT_BINDINGS.length + DARK_BINDINGS.length} bindings aligned across light + dark.`,
  );
}

main();
