/**
 * Story Coverage Checker
 *
 * Scans packages/shared/src/components/ for .tsx component files and checks
 * whether each has a sibling .stories.tsx file.
 *
 * Excludes: index.ts(x), *.stories.tsx, *.test.tsx, *.service.tsx, and
 * type-only files (files exporting only types/interfaces).
 *
 * Usage: bun run scripts/check-story-coverage.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { Glob } from "bun";

const COMPONENTS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "shared",
  "src",
  "components",
);

// Files to skip entirely
const SKIP_PATTERNS = [
  /^index\.tsx?$/, // barrel exports
  /\.stories\.tsx$/, // story files themselves
  /\.test\.tsx?$/, // test files
  /\.service\.tsx?$/, // service files (e.g., toast.service.tsx)
];

/**
 * Check if a file only exports types/interfaces (no runtime code).
 */
function isTypeOnlyFile(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, imports
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("import ")
    ) {
      continue;
    }

    // Type-only exports
    if (
      trimmed.startsWith("export type ") ||
      trimmed.startsWith("export interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("interface ")
    ) {
      continue;
    }

    // Re-exports of types
    if (trimmed.startsWith("export {") && trimmed.includes("type")) {
      continue;
    }

    // Any other export or statement means it has runtime code
    return false;
  }

  return true;
}

async function main() {
  const glob = new Glob("**/*.tsx");
  const componentFiles: string[] = [];
  const coveredFiles: string[] = [];
  const uncoveredFiles: string[] = [];

  // Collect all .tsx component files
  for await (const match of glob.scan({ cwd: COMPONENTS_DIR })) {
    const fileName = basename(match);

    // Skip excluded patterns
    if (SKIP_PATTERNS.some((pattern) => pattern.test(fileName))) {
      continue;
    }

    const fullPath = join(COMPONENTS_DIR, match);

    // Skip type-only files
    if (isTypeOnlyFile(fullPath)) {
      continue;
    }

    componentFiles.push(match);
  }

  // Sort for consistent output
  componentFiles.sort();

  // Check each component for a sibling story
  for (const componentPath of componentFiles) {
    const dir = dirname(componentPath);
    const fileName = basename(componentPath, ".tsx");
    const storyPath = join(dir, `${fileName}.stories.tsx`);
    const fullStoryPath = join(COMPONENTS_DIR, storyPath);

    if (existsSync(fullStoryPath)) {
      coveredFiles.push(componentPath);
    } else {
      uncoveredFiles.push(componentPath);
    }
  }

  // Print report
  const total = componentFiles.length;
  const covered = coveredFiles.length;
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 100;

  console.log("\n--- Story Coverage Report ---\n");
  console.log(`${covered}/${total} components have stories (${percentage}%)\n`);

  if (coveredFiles.length > 0) {
    console.log("Covered:");
    for (const f of coveredFiles) {
      console.log(`  + ${f}`);
    }
    console.log();
  }

  if (uncoveredFiles.length > 0) {
    console.log("Missing stories:");
    for (const f of uncoveredFiles) {
      console.log(`  - ${f}`);
    }
    console.log();
  }

  if (uncoveredFiles.length > 0) {
    console.log(
      `FAIL: ${uncoveredFiles.length} component(s) missing stories.\n`,
    );
    process.exit(1);
  } else {
    console.log("PASS: All components have stories.\n");
    process.exit(0);
  }
}

main();
