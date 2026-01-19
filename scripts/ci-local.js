#!/usr/bin/env node
/**
 * scripts/ci-local.js - Run all CI checks locally
 *
 * Usage: node scripts/ci-local.js [options]
 *   --skip-contracts  Skip contracts tests (requires Foundry)
 *   --skip-indexer    Skip indexer tests (requires codegen setup)
 *   --skip-build      Skip build step
 *   --skip-docs       Skip docs build (catches broken links)
 *   --skip-lighthouse Skip Lighthouse performance tests
 *   --only-lint       Only run lint and format checks
 *   --quick           Skip contracts, indexer, build, docs, and lighthouse (fast feedback)
 *   --lighthouse      Run Lighthouse tests (included by default, use --skip-lighthouse to skip)
 *   --generate-indexer  Run indexer codegen if generated files are missing
 *
 * This script mimics what GitHub Actions CI runs.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

// Environment variables matching GitHub Actions CI
const ciEnv = {
  // Common
  CI: "true",
  // Agent tests
  ENCRYPTION_SECRET: "test-secret-for-ci-encryption-32chars",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  VITE_RPC_URL_84532: "http://localhost:8545",
  // Client/Admin builds
  VITE_USE_HASH_ROUTER: "false",
  VITE_CHAIN_ID: "84532",
  VITE_WALLETCONNECT_PROJECT_ID: "test",
  VITE_PIMLICO_API_KEY: "test",
  VITE_ENVIO_INDEXER_URL: "http://localhost:8080",
};

// Configuration
const config = {
  skipContracts: false,
  skipIndexer: false,
  skipBuild: false,
  skipDocs: false,
  skipLighthouse: false,
  onlyLint: false,
  generateIndexer: false,
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
 * Calculate elapsed time in human-readable format
 */
function getElapsedTime(startTime) {
  return ((Date.now() - startTime) / 1000).toFixed(2);
}

/**
 * Run a command and track its result with real-time output
 * @param {string} name - Display name for the step
 * @param {string} command - Command to run
 * @param {string} cwd - Working directory (defaults to projectRoot)
 * @param {Object} env - Additional environment variables
 */
async function runStep(name, command, cwd = projectRoot, env = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`${colors.blue}Running: ${command}${colors.reset}`);

    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit', // Stream output directly to parent process
      env: { ...process.env, ...env }
    });

    child.on('close', (code) => {
      const duration = getElapsedTime(startTime);
      if (code === 0) {
        printSuccess(`${name} passed (${duration}s)`);
        resolve(true);
      } else {
        printError(`${name} failed (exit code: ${code}, ${duration}s)`);
        failures.push(name);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      const duration = getElapsedTime(startTime);
      printError(`${name} failed: ${error.message} (${duration}s)`);
      failures.push(name);
      resolve(false);
    });
  });
}

/**
 * Check if a command exists
 */
async function commandExists(cmd) {
  return new Promise((resolve) => {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    const child = spawn(checkCmd, {
      shell: true,
      stdio: 'ignore'
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Show help message
 */
function showHelp() {
  console.log("Usage: node scripts/ci-local.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --skip-contracts    Skip contracts tests (requires Foundry)");
  console.log("  --skip-indexer      Skip indexer tests (requires codegen setup)");
  console.log("  --skip-build        Skip build step");
  console.log("  --skip-docs         Skip docs build (catches broken links)");
  console.log("  --skip-lighthouse   Skip Lighthouse performance tests");
  console.log("  --only-lint         Only run lint and format checks");
  console.log("  --quick             Skip contracts, indexer, build, docs, and lighthouse (fast feedback)");
  console.log("  --generate-indexer  Run indexer codegen if generated files missing");
  console.log("  --help, -h          Show this help message");
  console.log("");
  console.log("This script runs the same checks as GitHub Actions CI:");
  console.log("  1. Format check (biome)");
  console.log("  2. Lint (oxlint + solhint)");
  console.log("  3. Type checking (TypeScript)");
  console.log("  4. Unit tests (all packages)");
  console.log("  5. Build (all packages)");
  console.log("  6. Docs build (catches broken links)");
  console.log("  7. Lighthouse performance tests (client + admin)");
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
    case "--skip-docs":
      config.skipDocs = true;
      break;
    case "--skip-lighthouse":
      config.skipLighthouse = true;
      break;
    case "--only-lint":
      config.onlyLint = true;
      break;
    case "--quick":
      config.skipContracts = true;
      config.skipIndexer = true;
      config.skipBuild = true;
      config.skipDocs = true;
      config.skipLighthouse = true;
      break;
    case "--generate-indexer":
      config.generateIndexer = true;
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

  // Show configuration
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  Skip Contracts: ${config.skipContracts ? 'Yes' : 'No'}`);
  console.log(`  Skip Indexer: ${config.skipIndexer ? 'Yes' : 'No'}`);
  console.log(`  Skip Build: ${config.skipBuild ? 'Yes' : 'No'}`);
  console.log(`  Skip Docs: ${config.skipDocs ? 'Yes' : 'No'}`);
  console.log(`  Skip Lighthouse: ${config.skipLighthouse ? 'Yes' : 'No'}`);
  console.log(`  Only Lint: ${config.onlyLint ? 'Yes' : 'No'}`);
  console.log(`  Generate Indexer: ${config.generateIndexer ? 'Yes' : 'No'}`);
  console.log("");

  // Pre-flight checks
  if (!config.skipContracts) {
    const hasForge = await commandExists("forge");
    if (!hasForge) {
      printWarning(
        "Foundry not found. Use --skip-contracts or install with: curl -L https://foundry.paradigm.xyz | bash"
      );
      config.skipContracts = true;
    }
  }

  if (!config.skipIndexer) {
    const indexerGeneratedPath = resolve(projectRoot, "packages/indexer/generated/src");
    if (!existsSync(indexerGeneratedPath)) {
      if (config.generateIndexer) {
        printSection("Indexer Code Generation");
        const hasEnvio = await commandExists("envio");
        if (!hasEnvio) {
          printWarning("Envio CLI not found. Installing globally...");
          await runStep("Install Envio", "npm install -g envio");
        }
        await runStep("Indexer codegen", "bun run codegen", resolve(projectRoot, "packages/indexer"));
        await runStep("Indexer setup-generated", "bun run setup-generated", resolve(projectRoot, "packages/indexer"));
      } else {
        printWarning(
          "Indexer generated files not found. Use --skip-indexer, --generate-indexer, or run: cd packages/indexer && bun run codegen && bun run setup-generated"
        );
        config.skipIndexer = true;
      }
    }
  }

  // ============================================================================
  // Phase 1: Format & Lint (matches all workflow lint jobs)
  // ============================================================================
  printSection("Format Check");
  await runStep("Format check", "bun run format:check");

  printSection("Lint");
  await runStep("Lint (all packages)", "bun run lint");

  // Early exit for lint-only mode
  if (config.onlyLint) {
    printHeader("Lint-only checks completed!");
    process.exit(failures.length > 0 ? 1 : 0);
  }

  // ============================================================================
  // Phase 2: Type Checking (matches GH Actions type check steps)
  // ============================================================================
  printSection("Type Checking");

  // Shared package type check (matches shared-tests.yml)
  await runStep("Shared typecheck", "npx tsc --noEmit", resolve(projectRoot, "packages/shared"));

  // Agent package type check (matches agent-tests.yml)
  await runStep("Agent typecheck", "bun run typecheck", resolve(projectRoot, "packages/agent"));

  // ============================================================================
  // Phase 3: Unit Tests (matches all workflow test jobs)
  // ============================================================================
  printSection("Shared Package Tests");
  await runStep("Shared tests", "bun run test", resolve(projectRoot, "packages/shared"), { CI: "true" });

  printSection("Client Tests");
  await runStep("Client tests", "bun run test", resolve(projectRoot, "packages/client"), { CI: "true" });

  printSection("Admin Tests");
  await runStep("Admin tests", "bun run test", resolve(projectRoot, "packages/admin"), { CI: "true" });

  // Indexer tests (matches indexer-tests.yml)
  if (!config.skipIndexer) {
    printSection("Indexer Tests");
    await runStep("Indexer tests", "bun run test", resolve(projectRoot, "packages/indexer"), { CI: "true" });
  } else {
    printSection("Indexer Tests (SKIPPED)");
  }

  // Contracts tests (matches contracts-tests.yml - builds first, then tests)
  if (!config.skipContracts) {
    printSection("Contracts Build & Tests");
    await runStep("Contracts build", "bun run build", resolve(projectRoot, "packages/contracts"));
    await runStep("Contracts tests", "bun run test", resolve(projectRoot, "packages/contracts"), { CI: "true" });
  } else {
    printSection("Contracts Tests (SKIPPED)");
  }

  // Agent tests (matches agent-tests.yml with full env vars)
  printSection("Agent Tests");
  await runStep(
    "Agent tests",
    "bun run test",
    resolve(projectRoot, "packages/agent"),
    {
      CI: "true",
      ENCRYPTION_SECRET: ciEnv.ENCRYPTION_SECRET,
      TELEGRAM_BOT_TOKEN: ciEnv.TELEGRAM_BOT_TOKEN,
      VITE_RPC_URL_84532: ciEnv.VITE_RPC_URL_84532,
    }
  );

  // ============================================================================
  // Phase 4: Build (matches all workflow build jobs with env vars)
  // ============================================================================
  if (!config.skipBuild) {
    printSection("Build All Packages");

    // Build contracts first (dependency for other packages)
    if (!config.skipContracts) {
      // Already built above during tests
      printSuccess("Contracts already built");
    }

    // Build shared (dependency for client/admin)
    await runStep("Shared build", "bun run build", resolve(projectRoot, "packages/shared"));

    // Build indexer
    if (!config.skipIndexer) {
      await runStep("Indexer build", "bun run build", resolve(projectRoot, "packages/indexer"));
    }

    // Build client (matches client-tests.yml lint-and-build job)
    await runStep(
      "Client build",
      "bun run build",
      resolve(projectRoot, "packages/client"),
      {
        VITE_USE_HASH_ROUTER: ciEnv.VITE_USE_HASH_ROUTER,
        VITE_CHAIN_ID: ciEnv.VITE_CHAIN_ID,
        VITE_WALLETCONNECT_PROJECT_ID: ciEnv.VITE_WALLETCONNECT_PROJECT_ID,
        VITE_PIMLICO_API_KEY: ciEnv.VITE_PIMLICO_API_KEY,
        VITE_ENVIO_INDEXER_URL: ciEnv.VITE_ENVIO_INDEXER_URL,
      }
    );

    // Build admin (matches admin-tests.yml lint-and-build job)
    await runStep(
      "Admin build",
      "bun run build",
      resolve(projectRoot, "packages/admin"),
      {
        VITE_CHAIN_ID: ciEnv.VITE_CHAIN_ID,
        VITE_WALLETCONNECT_PROJECT_ID: ciEnv.VITE_WALLETCONNECT_PROJECT_ID,
        VITE_PIMLICO_API_KEY: ciEnv.VITE_PIMLICO_API_KEY,
        VITE_ENVIO_INDEXER_URL: ciEnv.VITE_ENVIO_INDEXER_URL,
      }
    );
  } else {
    printSection("Build (SKIPPED)");
  }

  // ============================================================================
  // Phase 5: Docs Build (catches broken links before deployment)
  // ============================================================================
  if (!config.skipDocs) {
    const docsPath = resolve(projectRoot, "docs");
    if (!existsSync(docsPath)) {
      printSection("Docs Build (SKIPPED - directory not found)");
      printWarning("Docs directory not found at: " + docsPath);
    } else {
      // Check if docs has a build script before attempting to run it
      const docsPackageJsonPath = resolve(docsPath, "package.json");
      let hasBuildScript = false;

      if (existsSync(docsPackageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(docsPackageJsonPath, "utf8"));
          hasBuildScript = packageJson.scripts && packageJson.scripts.build;
        } catch (error) {
          printWarning(`Failed to read/parse ${docsPackageJsonPath}: ${error.message}`);
          // Assume no build script and continue
        }
      } else {
        printSection("Docs Build (SKIPPED - no package.json)");
        printWarning("No package.json found at: " + docsPackageJsonPath);
      }

      if (!hasBuildScript && existsSync(docsPackageJsonPath)) {
        printSection("Docs Build (SKIPPED - no build script)");
        printWarning("No build script found in " + docsPackageJsonPath);
      } else if (hasBuildScript) {
        printSection("Docs Build");
        await runStep(
          "Docs build",
          "bun run build",
          docsPath
        );
      }
    }
  } else {
    printSection("Docs Build (SKIPPED)");
  }

  // ============================================================================
  // Phase 6: Lighthouse Performance Tests (matches lighthouse-ci.yml)
  // ============================================================================
  if (!config.skipLighthouse && !config.skipBuild) {
    // Check if lhci is available
    const hasLhci = await commandExists("lhci");
    if (!hasLhci) {
      printWarning(
        "Lighthouse CI not found. Installing @lhci/cli..."
      );
      await runStep("Install Lighthouse CI", "npm install -g @lhci/cli");
    }

    printSection("Lighthouse CI - Client");
    await runStep(
      "Lighthouse client",
      "npx lhci autorun",
      resolve(projectRoot, "packages/client"),
      { CI: "true" }
    );

    printSection("Lighthouse CI - Admin");
    await runStep(
      "Lighthouse admin",
      "npx lhci autorun",
      resolve(projectRoot, "packages/admin"),
      { CI: "true" }
    );
  } else if (config.skipLighthouse) {
    printSection("Lighthouse (SKIPPED)");
  } else if (config.skipBuild) {
    printSection("Lighthouse (SKIPPED - requires build)");
  }

  // ============================================================================
  // Summary
  // ============================================================================
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
