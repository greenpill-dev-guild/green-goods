#!/usr/bin/env node
/**
 * scripts/upload-sourcemaps.js - Upload source maps to PostHog locally
 *
 * This script mirrors what .github/workflows/upload-sourcemaps.yml does,
 * allowing you to test sourcemap uploads locally before pushing to CI.
 *
 * Usage: node scripts/upload-sourcemaps.js [options]
 *   --app <client|admin|both>  Which app to upload (default: both)
 *   --skip-build               Skip build step (use existing dist)
 *   --dry-run                  Show what would be done without uploading
 *   --keep-maps                Don't delete source maps after upload
 *   --version <version>        Override version (default: git commit SHA)
 *   --env <staging|production> Environment (default: staging)
 *   --help, -h                 Show this help message
 *
 * Required environment variables:
 *   POSTHOG_CLI_TOKEN          API token with error-tracking:write scope
 *
 * Optional environment variables:
 *   POSTHOG_HOST               PostHog host (default: https://us.posthog.com)
 *
 * @see https://posthog.com/docs/error-tracking/upload-source-maps/cli
 */

import { spawn, execSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get project root
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
  dim: "\x1b[2m",
};

// App configurations (mirrors the GitHub Actions matrix)
const appConfigs = {
  client: {
    title: "Client",
    build: "build:client",
    dist: "packages/client/dist",
    project: "green-goods-client",
    envId: "163591",
    packageJson: "packages/client/package.json",
  },
  admin: {
    title: "Admin",
    build: "build:admin",
    dist: "packages/admin/dist",
    project: "green-goods-admin",
    envId: "262122",
    packageJson: "packages/admin/package.json",
  },
};

// Configuration
const config = {
  apps: ["client", "admin"],
  skipBuild: false,
  dryRun: false,
  keepMaps: false,
  version: null,
  env: "staging",
};

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

function printInfo(message) {
  console.log(`${colors.dim}ℹ ${message}${colors.reset}`);
}

/**
 * Run a command with real-time output
 * Note: Uses shell mode for complex commands (same pattern as ci-local.js)
 * Commands executed are controlled strings, not user input
 */
async function runCommand(command, options = {}) {
  const { cwd = projectRoot, env = {}, silent = false } = options;

  return new Promise((resolve, reject) => {
    if (!silent) {
      console.log(`${colors.dim}$ ${command}${colors.reset}`);
    }

    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: silent ? "pipe" : "inherit",
      env: { ...process.env, ...env },
    });

    let stdout = "";
    let stderr = "";

    if (silent) {
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
    }

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Get git commit SHA
 */
function getGitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Get app version from package.json
 */
async function getAppVersion(packageJsonPath) {
  try {
    const content = await readFile(resolve(projectRoot, packageJsonPath), "utf-8");
    const pkg = JSON.parse(content);
    return pkg.version;
  } catch {
    return "unknown";
  }
}

/**
 * Check if a file is a JavaScript source map
 * Used by both countSourceMaps and deleteSourceMaps for consistency
 */
function isJsSourceMap(filename) {
  return filename.endsWith(".js.map");
}

/**
 * Count source map files in directory
 */
function countSourceMaps(dir) {
  const fullPath = resolve(projectRoot, dir);
  if (!existsSync(fullPath)) return 0;

  let count = 0;
  const walkDir = (currentPath) => {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walkDir(entryPath);
      } else if (isJsSourceMap(entry.name)) {
        count++;
      }
    }
  };
  walkDir(fullPath);
  return count;
}

/**
 * Delete source map files from directory
 */
function deleteSourceMaps(dir) {
  const fullPath = resolve(projectRoot, dir);
  if (!existsSync(fullPath)) return 0;

  let deleted = 0;
  const walkDir = (currentPath) => {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walkDir(entryPath);
      } else if (isJsSourceMap(entry.name)) {
        unlinkSync(entryPath);
        deleted++;
      }
    }
  };
  walkDir(fullPath);
  return deleted;
}

/**
 * Check if PostHog CLI is installed
 * Also adds ~/.posthog to PATH if it exists (where the installer puts it)
 */
async function checkPosthogCli() {
  // Add ~/.posthog to PATH if it exists (installer default location)
  const posthogDir = join(process.env.HOME || "", ".posthog");
  if (existsSync(posthogDir) && !process.env.PATH?.includes(posthogDir)) {
    process.env.PATH = `${posthogDir}:${process.env.PATH}`;
  }

  try {
    await runCommand("posthog-cli --version", { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install PostHog CLI
 *
 * Security note: This function tries npm first (safer) before falling back to
 * the curl|sh installer. The curl|sh method pipes remote code to shell, which
 * requires explicit opt-in via CI or ALLOW_REMOTE_INSTALL environment variables.
 */
async function installPosthogCli() {
  printInfo("Installing PostHog CLI...");

  // Try npm first (safer)
  try {
    await runCommand("npm install -g @posthog/cli");
    return true;
  } catch {
    printWarning("npm install failed");
  }

  // Fallback to curl installer with warning
  printWarning("Attempting curl|sh installer. This pipes remote code to shell.");
  printInfo("For security-sensitive environments, install manually:");
  printInfo("  npm install -g @posthog/cli");

  // Only proceed in CI or with explicit opt-in
  if (!process.env.CI && !process.env.ALLOW_REMOTE_INSTALL) {
    printError("Set ALLOW_REMOTE_INSTALL=1 or CI=1 to allow curl installer");
    return false;
  }

  try {
    await runCommand(
      'curl --proto "=https" --tlsv1.2 -LsSf https://github.com/PostHog/posthog/releases/latest/download/posthog-cli-installer.sh | sh'
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log("Usage: node scripts/upload-sourcemaps.js [options]");
  console.log("");
  console.log("Upload source maps to PostHog for error tracking.");
  console.log("");
  console.log("Options:");
  console.log("  --app <app>        Which app to upload: client, admin, or both (default: both)");
  console.log("  --skip-build       Skip build step, use existing dist folder");
  console.log("  --dry-run          Show what would be done without actually uploading");
  console.log("  --keep-maps        Don't delete source maps after upload");
  console.log("  --version <ver>    Override version (default: git commit SHA)");
  console.log("  --env <env>        Environment: staging or production (default: staging)");
  console.log("  --help, -h         Show this help message");
  console.log("");
  console.log("Environment variables:");
  console.log("  POSTHOG_CLI_TOKEN       Required: API token with error-tracking:write scope");
  console.log("  POSTHOG_HOST            Optional: PostHog host (default: https://us.posthog.com)");
  console.log("");
  console.log("Hardcoded environment IDs:");
  console.log("  Client: 163591");
  console.log("  Admin:  262122");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/upload-sourcemaps.js                    # Upload both apps");
  console.log("  node scripts/upload-sourcemaps.js --app client       # Upload client only");
  console.log("  node scripts/upload-sourcemaps.js --skip-build       # Use existing build");
  console.log("  node scripts/upload-sourcemaps.js --dry-run          # Test without uploading");
  console.log("");
  console.log("Setup:");
  console.log("  1. Go to PostHog Settings > Personal API Keys");
  console.log("  2. Create a key with 'error-tracking:write' scope");
  console.log("  3. Add to your .env file:");
  console.log("     POSTHOG_CLI_TOKEN=phx_...");
  console.log("");
  process.exit(0);
}

// ============================================================================
// Parse Arguments
// ============================================================================

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "--app":
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        printError("Missing value for --app");
        process.exit(1);
      }
      const app = args[++i];
      if (app === "both") {
        config.apps = ["client", "admin"];
      } else if (app === "client" || app === "admin") {
        config.apps = [app];
      } else {
        printError(`Invalid app: ${app}. Must be client, admin, or both`);
        process.exit(1);
      }
      break;
    case "--skip-build":
      config.skipBuild = true;
      break;
    case "--dry-run":
      config.dryRun = true;
      break;
    case "--keep-maps":
      config.keepMaps = true;
      break;
    case "--version":
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        printError("Missing value for --version");
        process.exit(1);
      }
      config.version = args[++i];
      break;
    case "--env":
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        printError("Missing value for --env");
        process.exit(1);
      }
      const env = args[++i];
      if (env === "staging" || env === "production") {
        config.env = env;
      } else {
        printError(`Invalid environment: ${env}. Must be staging or production`);
        process.exit(1);
      }
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

async function uploadSourceMapsForApp(appName) {
  const appConfig = appConfigs[appName];
  const distPath = resolve(projectRoot, appConfig.dist);

  printSection(`${appConfig.title} Source Maps`);

  // Use hardcoded environment ID for each app
  const envId = appConfig.envId;

  // Get version
  const version = config.version || getGitSha();
  if (!version) {
    printError("Could not determine version. Use --version flag or ensure you're in a git repo");
    return false;
  }

  // Get app version for display
  const appVersion = await getAppVersion(appConfig.packageJson);

  printInfo(`Project: ${appConfig.project}`);
  printInfo(`Env ID: ${envId}`);
  printInfo(`Version: ${version}`);
  printInfo(`App Version: ${appVersion}`);
  printInfo(`Environment: ${config.env}`);
  printInfo(`Dist: ${appConfig.dist}`);

  // Check for source maps
  const mapCount = countSourceMaps(appConfig.dist);
  if (mapCount === 0) {
    printError(`No source maps found in ${appConfig.dist}`);
    printInfo("Make sure your build has sourcemap: true enabled");
    return false;
  }
  printSuccess(`Found ${mapCount} source map files`);

  if (config.dryRun) {
    printWarning("DRY RUN - Would upload source maps with:");
    console.log(`  posthog-cli sourcemap inject --directory ${appConfig.dist} --project ${appConfig.project} --version ${version}`);
    console.log(`  posthog-cli sourcemap upload --directory ${appConfig.dist}${config.keepMaps ? "" : " --delete-after"}`);
    return true;
  }

  // Build environment for CLI commands
  const cliEnv = {
    POSTHOG_CLI_TOKEN: process.env.POSTHOG_CLI_TOKEN,
    POSTHOG_CLI_HOST: process.env.POSTHOG_HOST || "https://us.posthog.com",
  };
  // Only include env ID if provided
  if (envId) {
    cliEnv.POSTHOG_CLI_ENV_ID = envId;
  }

  // Step 1: Inject source map metadata
  printInfo("Injecting source map metadata...");
  try {
    await runCommand(
      `posthog-cli sourcemap inject --directory "${appConfig.dist}" --project "${appConfig.project}" --version "${version}"`,
      { env: cliEnv }
    );
    printSuccess("Metadata injected");
  } catch (error) {
    printError(`Failed to inject metadata: ${error.message}`);
    return false;
  }

  // Step 2: Upload source maps
  printInfo("Uploading source maps to PostHog...");
  try {
    const deleteFlag = config.keepMaps ? "" : " --delete-after";
    await runCommand(`posthog-cli sourcemap upload --directory "${appConfig.dist}"${deleteFlag}`, {
      env: cliEnv,
    });
    printSuccess("Source maps uploaded");
  } catch (error) {
    printError(`Failed to upload source maps: ${error.message}`);
    return false;
  }

  // Verify cleanup (if not keeping maps)
  if (!config.keepMaps) {
    const remainingMaps = countSourceMaps(appConfig.dist);
    if (remainingMaps > 0) {
      printWarning(`${remainingMaps} .js.map files still present, cleaning up...`);
      const deleted = deleteSourceMaps(appConfig.dist);
      printInfo(`Deleted ${deleted} remaining source map files`);
    } else {
      printSuccess("Source maps cleaned up");
    }
  }

  return true;
}

async function main() {
  printHeader("PostHog Source Map Upload");

  // Show configuration
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  Apps: ${config.apps.join(", ")}`);
  console.log(`  Skip Build: ${config.skipBuild ? "Yes" : "No"}`);
  console.log(`  Dry Run: ${config.dryRun ? "Yes" : "No"}`);
  console.log(`  Keep Maps: ${config.keepMaps ? "Yes" : "No"}`);
  console.log(`  Environment: ${config.env}`);
  console.log(`  Version: ${config.version || "(auto-detect from git)"}`);
  console.log("");

  // Check required environment variables
  if (!process.env.POSTHOG_CLI_TOKEN) {
    printError("Missing POSTHOG_CLI_TOKEN environment variable");
    printInfo("Get your API token from: PostHog Settings > Personal API Keys");
    printInfo("Make sure it has 'error-tracking:write' scope");
    process.exit(1);
  }

  // Check for PostHog CLI
  const hasPosthogCli = await checkPosthogCli();
  if (!hasPosthogCli) {
    printWarning("PostHog CLI not found");
    if (config.dryRun) {
      printInfo("Would install PostHog CLI");
    } else {
      const installed = await installPosthogCli();
      if (!installed) {
        printError("Failed to install PostHog CLI");
        printInfo("Try installing manually: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/PostHog/posthog/releases/latest/download/posthog-cli-installer.sh | sh");
        process.exit(1);
      }
      printSuccess("PostHog CLI installed");
    }
  } else {
    printSuccess("PostHog CLI found");
  }

  // Build step
  if (!config.skipBuild) {
    printSection("Building Apps");

    const chainId = config.env === "production" ? "42161" : "84532";

    // Build shared first (dependency)
    printInfo("Building shared package...");
    await runCommand("bun run build", { cwd: resolve(projectRoot, "packages/shared") });
    printSuccess("Shared package built");

    // Build each app
    for (const appName of config.apps) {
      const appConfig = appConfigs[appName];
      printInfo(`Building ${appConfig.title}...`);

      const buildEnv = {
        NODE_ENV: "production",
        VITE_USE_HASH_ROUTER: "false",
        VITE_CHAIN_ID: chainId,
        VITE_POSTHOG_HOST: "https://app.posthog.com",
      };

      try {
        await runCommand(`bun run ${appConfig.build}`, { env: buildEnv });
        printSuccess(`${appConfig.title} built`);
      } catch (error) {
        printError(`Failed to build ${appConfig.title}: ${error.message}`);
        process.exit(1);
      }
    }
  } else {
    printInfo("Skipping build (using existing dist folders)");
  }

  // Upload source maps for each app
  const results = [];
  for (const appName of config.apps) {
    const success = await uploadSourceMapsForApp(appName);
    results.push({ app: appName, success });
  }

  // Summary
  printHeader("Upload Summary");

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  for (const result of results) {
    const status = result.success ? `${colors.green}✓ Success${colors.reset}` : `${colors.red}✗ Failed${colors.reset}`;
    console.log(`  ${appConfigs[result.app].title}: ${status}`);
  }
  console.log("");

  if (failCount > 0) {
    printError(`${failCount} upload(s) failed`);
    process.exit(1);
  }

  printSuccess(`All ${successCount} upload(s) completed successfully!`);

  if (config.dryRun) {
    console.log("");
    printInfo("This was a dry run. No source maps were actually uploaded.");
    printInfo("Run without --dry-run to upload for real.");
  }

  process.exit(0);
}

// Run main and handle errors
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
