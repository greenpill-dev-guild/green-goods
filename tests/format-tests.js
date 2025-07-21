#!/usr/bin/env node

// Script to format test files manually
const { execSync } = require("child_process");

console.log("🔧 Formatting test files...");

try {
  // Format all files in tests directory
  execSync("npx biome format --write tests/", { stdio: "inherit" });
  console.log("✅ Test files formatted successfully!");
} catch (error) {
  console.error("❌ Error formatting test files:", error.message);
  process.exit(1);
}
