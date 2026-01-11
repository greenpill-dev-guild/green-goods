#!/usr/bin/env tsx

/**
 * Format test files using Biome
 * Run with: bun tests/format-tests.ts
 */
import { execSync } from "node:child_process";

try {
  console.log("📐 Formatting test files...\n");
  execSync("npx biome format --write tests/", { stdio: "inherit" });
  console.log("\n✅ Test files formatted!");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Failed to format test files:", message);
  process.exit(1);
}
