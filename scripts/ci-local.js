#!/usr/bin/env node
/**
 * scripts/ci-local.js - Run all CI checks locally
 *
 * Usage: node scripts/ci-local.js [options]
 *   --skip-contracts  Skip contracts tests (requires Foundry)
 *   --skip-indexer    Skip indexer tests (requires codegen setup)
 *   --skip-build      Skip build step
 *   --only-lint       Only run lint and format checks
 *   --quick           Skip contracts, indexer, and build (fast feedback)
 *
 * This script mimics what GitHub Actions CI runs.
 */

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);

// Get project root (one level up from scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[0;34m",
};

// Configuration
const config = {
  skipContracts: false,
  skipIndexer: false,
  skipBuild: false,
  onlyLint: false,
};

// Track failures
const failures = [];

// ============================================================================
// Helpers
// ============================================================================

function printHeader(message) {
  console.log("");
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  ${message}${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log("");
}

function printSection(message) {
  console.log("");
  console.log(`${colors.yellow}=== ${message} ===${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function printError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

/**
 * Run a command and track its result
 */
async function runStep(name, command, cwd = projectRoot) {
  try {
    await execAsync(command, { cwd, shell: true });
    printSuccess(`${name} passed`);
    return true;
  } catch (error) {
    printError(`${name} failed`);
    failures.push(name);
    return false;
  }
}

/**
 * Check if a command exists
 */
async function commandExists(cmd) {
  try {
    await execAsync(`command -v ${cmd}`, { shell: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log("Usage: node scripts/ci-local.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --skip-contracts  Skip contracts tests (requires Foundry)");
  console.log("  --skip-indexer    Skip indexer tests (requires codegen setup)");
  console.log("  --skip-build      Skip build step");
  console.log("  --only-lint       Only run lint and format checks");
  console.log("  --quick           Skip contracts, indexer, and build (fast feedback)");
  console.log("  --help, -h        Show this help message");
  process.exit(0);
}

// ============================================================================
// Parse Arguments
// ============================================================================

const args = process.argv.slice(2);
for (const arg of args) {
  switch (arg) {
    case "--skip-contracts":
      config.skipContracts = true;
      break;
    case "--skip-indexer":
      config.skipIndexer = true;
      break;
    case "--skip-build":
      config.skipBuild = true;
      break;
    case "--only-lint":
      config.onlyLint = true;
      break;
    case "--quick":
      config.skipContracts = true;
      config.skipIndexer = true;
      config.skipBuild = true;
      break;
    case "--help":
    case "-h":
      showHelp();
      break;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  printHeader("Green Goods CI Local Validation");

  // Format check
  printSection("Format Check");
  await runStep("Format", "bun run format:check");

  // Lint
  printSection("Lint");
  await runStep("Lint", "bun run lint");

  // Early exit for lint-only mode
  if (config.onlyLint) {
    printHeader("Lint-only checks completed!");
    process.exit(0);
  }

  // Shared package tests
  printSection("Shared Package Tests");
  await runStep("Shared tests", "bun run test", resolve(projectRoot, "packages/shared"));

  // Client tests
  printSection("Client Tests");
  await runStep("Client tests", "bun run test", resolve(projectRoot, "packages/client"));

  // Admin tests
  printSection("Admin Tests");
  await runStep("Admin unit tests", "bun run test:unit", resolve(projectRoot, "packages/admin"));

  // Indexer tests
  if (!config.skipIndexer) {
    printSection("Indexer Tests");
    const indexerGeneratedPath = resolve(projectRoot, "packages/indexer/generated/src");
    if (existsSync(indexerGeneratedPath)) {
      await runStep("Indexer tests", "bun run test", resolve(projectRoot, "packages/indexer"));
    } else {
      printWarning(
        "Indexer generated files not found. Run 'cd packages/indexer && bun run codegen && bun run setup-generated' first, or use --skip-indexer"
      );
    }
  } else {
    printSection("Indexer Tests (SKIPPED)");
  }

  // Contracts tests
  if (!config.skipContracts) {
    printSection("Contracts Tests");
    const hasForge = await commandExists("forge");
    if (hasForge) {
      await runStep("Contracts tests", "bun run test", resolve(projectRoot, "packages/contracts"));
    } else {
      printWarning(
        "Foundry not found. Install with 'curl -L https://foundry.paradigm.xyz | bash' or use --skip-contracts"
      );
    }
  } else {
    printSection("Contracts Tests (SKIPPED)");
  }

  // Agent tests
  printSection("Agent Tests");
  await runStep(
    "Agent tests",
    "ENCRYPTION_SECRET='test-secret-for-ci-encryption-32chars' bun run test",
    resolve(projectRoot, "packages/agent")
  );

  // Build all packages
  if (!config.skipBuild) {
    printSection("Build All Packages");
    await runStep("Build", "bun run build");
  } else {
    printSection("Build (SKIPPED)");
  }

  // Summary
  printHeader("CI Validation Summary");

  if (failures.length > 0) {
    console.log(`${colors.red}Some checks failed:${colors.reset}`);
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
    console.log("");
    console.log("Fix the issues above and run again.");
    process.exit(1);
  } else {
    console.log(`${colors.green}All CI checks passed! ✓${colors.reset}`);
    console.log("");
    console.log("Your code is ready for commit/push.");
    process.exit(0);
  }
}

// Run main and handle errors
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
