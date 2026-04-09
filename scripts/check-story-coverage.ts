/**
 * Story Coverage Checker
 *
 * Scans shared component files plus a curated set of admin shell components and
 * checks whether each has a sibling .stories.tsx file.
 *
 * Excludes: index.ts(x), *.stories.tsx, *.test.tsx, *.service.tsx, and
 * type-only files (files exporting only types/interfaces).
 *
 * Usage: bun run scripts/check-story-coverage.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Glob } from "bun";

const COMPONENTS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "shared",
  "src",
  "components",
);

const ADMIN_COMPONENTS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "admin",
  "src",
  "components",
);

const ADMIN_SYSTEM_COMPONENTS = [
  "Layout/CommandPalette.tsx",
  "Layout/PageHeader.tsx",
  "Layout/PageTransition.tsx",
] as const;

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
  const componentFiles: Array<{ cwd: string; relativePath: string; label: string }> = [];
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

    componentFiles.push({
      cwd: COMPONENTS_DIR,
      relativePath: match,
      label: `shared/${match}`,
    });
  }

  for (const match of ADMIN_SYSTEM_COMPONENTS) {
    const fullPath = join(ADMIN_COMPONENTS_DIR, match);
    if (!existsSync(fullPath)) {
      throw new Error(`Admin system component missing: ${match}`);
    }

    componentFiles.push({
      cwd: ADMIN_COMPONENTS_DIR,
      relativePath: match,
      label: `admin/${match}`,
    });
  }

  // Sort for consistent output
  const normalizedFiles = componentFiles;

  normalizedFiles.sort((a, b) => a.label.localeCompare(b.label));

  // Check each component for a sibling story
  for (const component of normalizedFiles) {
    const dir = dirname(component.relativePath);
    const fileName = basename(component.relativePath, ".tsx");
    const storyPath = join(dir, `${fileName}.stories.tsx`);
    const fullStoryPath = join(component.cwd, storyPath);

    if (existsSync(fullStoryPath)) {
      coveredFiles.push(component.label);
    } else {
      uncoveredFiles.push(component.label);
    }
  }

  // Print report
  const total = normalizedFiles.length;
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
