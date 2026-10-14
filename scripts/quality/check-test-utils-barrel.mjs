#!/usr/bin/env node
// Shared tests import test-utils leaf modules, not the barrel. The barrel re-exports every
// fixture, fake and Testing Library, so each test file that imports it loads all of them; measured
// over the 55 files that did, leaf imports cut their summed import time by 27–29%. Admin and Client
// keep `@green-goods/shared/testing`, and the barrel's own tests inside test-utils/ may import it.
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const TEST_UTILS = "packages/shared/src/__tests__/test-utils";
const BARREL_ALIAS = "@green-goods/shared/testing";
const IMPORT_SPECIFIER = /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function resolvesToBarrel(file, specifier) {
  if (specifier === BARREL_ALIAS) return true;
  if (!specifier.startsWith(".")) return false;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  return target === TEST_UTILS || target === `${TEST_UTILS}/index` || target === `${TEST_UTILS}/index.ts`;
}

/** The barrel imports in Shared test files outside test-utils/, sorted by file. */
export function testUtilsBarrelImports(files, readSource) {
  return files
    .filter((file) => !file.startsWith(`${TEST_UTILS}/`))
    .sort()
    .flatMap((file) =>
      [...readSource(file).matchAll(IMPORT_SPECIFIER)]
        .map((match) => match[1])
        .filter((specifier) => resolvesToBarrel(file, specifier))
        .map((specifier) => ({ file, specifier })),
    );
}

function main() {
  try {
    const files = globSync("packages/shared/src/**/*.{test,spec}.{ts,tsx}", { cwd: repoRoot }).map((file) =>
      file.split(path.sep).join("/"),
    );
    const found = testUtilsBarrelImports(files, (file) => readFileSync(path.join(repoRoot, file), "utf8"));
    if (found.length > 0) {
      console.error("Shared tests import test-utils leaf modules (render-helpers, query-client, mock-factories, …), not the barrel:");
      for (const { file, specifier } of found) console.error(`- ${file}: "${specifier}"`);
      process.exit(1);
    }
    console.log(`Shared test-utils imports: ${files.length} test files, none through the barrel.`);
  } catch (error) {
    console.error(`Test-utils barrel check could not run: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
