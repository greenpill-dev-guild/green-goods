#!/usr/bin/env node

/**
 * Green Goods Setup Script
 *
 * Checks dependencies, installs packages, and configures environment
 */

import fs from "fs";
import { execSync } from "child_process";

// Simple color helpers
const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset}  ${msg}`),
  warning: (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset}  ${msg}`),
};

function checkCommand(cmd, name) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    log.error(`${name} not found`);
    return false;
  }
}

function installBun() {
  log.info("Installing bun...\n");
  const isWindows = process.platform === "win32";

  try {
    if (isWindows) {
      execSync('powershell -c "irm bun.sh/install.ps1 | iex"', {
        stdio: "inherit",
      });
    } else {
      execSync("curl -fsSL https://bun.sh/install | bash", { stdio: "inherit" });
    }

    // Add to PATH for current session
    if (!isWindows) {
      process.env.PATH = `${process.env.HOME}/.bun/bin:${process.env.PATH}`;
    }

    log.success("Bun installed successfully\n");
    return true;
  } catch (err) {
    log.error("Failed to install bun automatically");
    console.log(`${c.dim}Install manually: https://bun.sh${c.reset}\n`);
    return false;
  }
}

function checkVersion(cmd, minVersion, name) {
  try {
    const version = execSync(`${cmd} --version`, { encoding: "utf8" }).trim();
    const match = version.match(/(\d+)/);
    if (match && parseInt(match[1]) >= minVersion) {
      log.success(`${name} ${version.split("\n")[0]}`);
      return true;
    }
    log.error(`${name} version ${minVersion}+ required`);
    return false;
  } catch {
    log.error(`${name} not found`);
    return false;
  }
}

function checkDocker() {
  try {
    execSync("docker ps", { stdio: "ignore" });
    const version = execSync("docker --version", { encoding: "utf8" }).trim();
    log.success(version);
    return true;
  } catch {
    log.error("Docker not running or not installed");
    return false;
  }
}

console.log(`\n${c.green}🌱 Green Goods Setup${c.reset}\n`);

// Check dependencies
log.info("Checking dependencies...\n");
const hasNode = checkVersion("node", 22, "Node.js");
let hasBun = checkVersion("bun", 1, "bun");
const hasGit = checkCommand("git", "Git");
const hasDocker = checkDocker();
const hasForge = checkCommand("forge", "Foundry");

console.log("");

if (!hasNode || !hasGit) {
  log.error("Missing required dependencies. Install them and try again.\n");
  console.log(`${c.dim}Required:${c.reset}
  • Node.js 22+: https://nodejs.org
  • Git: https://git-scm.com\n`);
  process.exit(1);
}

if (!hasBun) {
  log.warning("Bun not found. Attempting to install...\n");
  hasBun = installBun();
  if (!hasBun) {
    log.error("Bun installation failed. Please install manually.\n");
    console.log(`${c.dim}Install: https://bun.sh${c.reset}\n`);
    process.exit(1);
  }
}

if (!hasDocker) {
  log.warning("Docker not running. Required for indexer development.");
}

if (!hasForge) {
  log.warning("Foundry not found. Required for contract development.");
  console.log(
    `${c.dim}Install: curl -L https://foundry.paradigm.xyz | bash && foundryup${c.reset}\n`
  );
}

// Install dependencies
if (!fs.existsSync("node_modules")) {
  log.info("Installing dependencies...\n");
  try {
    execSync("bun install", { stdio: "inherit" });
    log.success("Dependencies installed\n");
  } catch {
    log.error("Failed to install dependencies\n");
    process.exit(1);
  }
} else {
  log.success("Dependencies already installed\n");
}

// Setup environment
if (!fs.existsSync(".env")) {
  if (fs.existsSync(".env.schema")) {
    try {
      const generatedEnv = execSync("APP_ENV=development bunx varlock load --path .env.schema --format env --compact", {
        encoding: "utf8",
      });
      fs.writeFileSync(".env", `${generatedEnv.trim()}\n`);
      log.success("Created .env from .env.schema defaults\n");

      console.log(`${c.cyan}Recommended secret setup:${c.reset}
  • 1Password CLI: https://developer.1password.com/docs/cli/get-started/
  • Standard local setup: sign in to \`op\`, keep OP_ENABLE_ENVIRONMENT_LOAD=false, and add root-only \`*_OP_REF=op://...\` entries
  • CI/service-account setup: set OP_ENVIRONMENT and OP_ENABLE_ENVIRONMENT_LOAD=true for bulk loading
  • Keep .env for non-secret defaults and local overrides

See .env.schema for the full environment contract.\n`);
    } catch (error) {
      log.error("Failed to generate .env from .env.schema\n");
      if (error instanceof Error && error.message) {
        console.log(`${c.dim}${error.message}${c.reset}\n`);
      }
      process.exit(1);
    }
  } else {
    log.warning("No .env.schema found\n");
  }
} else {
  log.success("Environment already configured\n");
}

// Next steps
console.log(`${c.green}✓ Setup complete!${c.reset}\n`);
console.log(`${c.cyan}Next steps:${c.reset}
  1. Set APP_ENV in .env, then either add \`*_OP_REF=op://...\` entries for local secrets or configure OP_ENVIRONMENT + OP_ENABLE_ENVIRONMENT_LOAD=true for service-account/bulk loading
  2. Start services: bun dev
  3. Run tests: bun run test

${c.dim}Individual packages:${c.reset}
  • bun dev:client    - React PWA (port 3001)
  • bun dev:indexer   - Blockchain indexer (port 8081)
  • bun dev:contracts - Local blockchain (Anvil)
`);
