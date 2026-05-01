#!/usr/bin/env node

/**
 * Green Goods Setup Script
 *
 * Checks dependencies, installs packages, and configures environment
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, execSync, spawnSync } from "child_process";

// `--cloud` skips human-onboarding steps (Docker check, .env generation via
// the 1Password CLI) and runs faster on repeat invocations. Intended for
// Claude Code on the web and other ephemeral cloud environments where bun is
// preinstalled and secrets are injected by the platform, not resolved from op.
const isCloud = process.argv.includes("--cloud");

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
  const probe = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  const result = spawnSync(probe, { shell: true, stdio: "ignore" });
  if (result.status !== 0) {
    log.error(`${name} not found`);
    return false;
  }
  return true;
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
    const bunBin = isWindows
      ? `${process.env.USERPROFILE || ""}\\.bun\\bin`
      : `${process.env.HOME}/.bun/bin`;
    process.env.PATH = `${bunBin}:${process.env.PATH}`;

    log.success("Bun installed successfully\n");
    return true;
  } catch (err) {
    log.error("Failed to install bun automatically");
    console.log(`${c.dim}Install manually: https://bun.sh${c.reset}\n`);
    return false;
  }
}

function installFoundry() {
  log.info("Installing Foundry...\n");

  if (process.platform === "win32") {
    log.error("Automatic Foundry install is not supported on Windows");
    console.log(`${c.dim}Install via WSL: curl -L https://foundry.paradigm.xyz | bash && foundryup${c.reset}\n`);
    return false;
  }

  const arch = os.arch();
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const archMap = { x64: "amd64", arm64: "arm64" };
  const assetArch = archMap[arch];
  if (!assetArch) {
    log.error(`Unsupported architecture: ${arch}`);
    return false;
  }

  const asset = `foundry_stable_${platform}_${assetArch}.tar.gz`;
  const url = `https://github.com/foundry-rs/foundry/releases/download/stable/${asset}`;
  const home = os.homedir();
  const binDir = path.join(home, ".foundry", "bin");
  const tmpFile = path.join(os.tmpdir(), `foundry-${Date.now()}.tar.gz`);

  try {
    fs.mkdirSync(binDir, { recursive: true });
    execSync(`curl -fsSL --retry 3 --retry-delay 2 -o "${tmpFile}" "${url}"`, { stdio: "inherit" });
    execSync(`tar -xzf "${tmpFile}" -C "${binDir}"`, { stdio: "inherit" });
    fs.rmSync(tmpFile, { force: true });

    process.env.PATH = `${binDir}:${process.env.PATH}`;

    // Persist for future shells. Prefer symlinking into a writable system bin
    // dir on PATH — this works for every shell (including non-interactive
    // husky hooks, where ~/.bashrc skips its body via `[ -z "$PS1" ] && return`).
    // Fall back to a PATH export in ~/.bashrc/~/.zshrc if no system dir is writable.
    const binaries = ["forge", "cast", "anvil", "chisel"];
    const candidateDirs = ["/usr/local/bin", path.join(home, ".local", "bin")];
    let symlinked = false;
    for (const dir of candidateDirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        for (const name of binaries) {
          const target = path.join(binDir, name);
          const link = path.join(dir, name);
          try { fs.unlinkSync(link); } catch {}
          fs.symlinkSync(target, link);
        }
        symlinked = true;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!symlinked) {
      const pathLine = `export PATH="${binDir}:$PATH"`;
      const rcFiles = [path.join(home, ".bashrc")];
      if (platform === "darwin") rcFiles.push(path.join(home, ".zshrc"));
      for (const rc of rcFiles) {
        try {
          const existing = fs.existsSync(rc) ? fs.readFileSync(rc, "utf8") : "";
          if (!existing.includes(pathLine)) {
            fs.appendFileSync(rc, `\n${pathLine}\n`);
          }
        } catch {
          // best-effort — user can add the line manually
        }
      }
    }

    log.success("Foundry installed successfully\n");
    return true;
  } catch (err) {
    log.error("Failed to install Foundry automatically");
    console.log(`${c.dim}Install manually: curl -L https://foundry.paradigm.xyz | bash && foundryup${c.reset}\n`);
    fs.rmSync(tmpFile, { force: true });
    return false;
  }
}

function checkVersion(cmd, minVersion, name) {
  try {
    const version = execFileSync(cmd, ["--version"], { encoding: "utf8" }).trim();
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
    execFileSync("docker", ["ps"], { stdio: "ignore" });
    const version = execFileSync("docker", ["--version"], { encoding: "utf8" }).trim();
    log.success(version);
    return true;
  } catch {
    log.error("Docker not running or not installed");
    return false;
  }
}

console.log(`\n${c.green}🌱 Green Goods Setup${c.reset}${isCloud ? `${c.dim} (cloud)${c.reset}` : ""}\n`);

// Check dependencies
log.info("Checking dependencies...\n");
const hasNode = checkVersion("node", 22, "Node.js");
let hasBun = checkVersion("bun", 1, "bun");
const hasGit = checkCommand("git", "Git");
const hasDocker = isCloud ? false : checkDocker();
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
  if (isCloud) {
    log.error("Bun missing in cloud environment — expected to be preinstalled.\n");
    process.exit(1);
  }
  log.warning("Bun not found. Attempting to install...\n");
  hasBun = installBun();
  if (!hasBun) {
    log.error("Bun installation failed. Please install manually.\n");
    console.log(`${c.dim}Install: https://bun.sh${c.reset}\n`);
    process.exit(1);
  }
}

if (!isCloud && !hasDocker) {
  log.warning("Docker not running. Required for indexer development.");
}

let foundryInstalled = hasForge;
if (!hasForge) {
  log.warning("Foundry not found. Attempting to install...\n");
  foundryInstalled = installFoundry();
  if (!foundryInstalled) {
    if (isCloud) {
      log.error("Foundry install failed — pre-push hooks will fail until resolved.\n");
      process.exit(1);
    }
    log.warning("Continuing without Foundry — contract scripts and pre-push hooks will fail until installed.\n");
  }
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

// Setup environment — skipped in cloud since secrets are injected directly by
// the platform and the 1Password CLI is unavailable.
if (isCloud) {
  log.info("Skipping .env generation in cloud mode (secrets are injected by the platform)\n");
} else if (!fs.existsSync(".env")) {
  if (fs.existsSync(".env.schema")) {
    try {
      const generatedEnv = execSync("APP_ENV=development bunx varlock load --path .env.schema --format env --compact", {
        encoding: "utf8",
      });
      fs.writeFileSync(".env", `${generatedEnv.trim()}\n`);
      log.success("Created .env from .env.schema defaults\n");

      console.log(`${c.cyan}Recommended secret setup:${c.reset}
  • Baseline web dev: no shared secrets or 1Password required; leave \`*_OP_REF\`, OP_ENVIRONMENT, and OP_SERVICE_ACCOUNT_TOKEN blank
  • Personal local credentials: set direct values in root \`.env\`
  • Shared team/deploy/upload secrets: use 1Password \`*_OP_REF=op://...\` entries and sign in to \`op\`
  • CI/service-account setup: set OP_ENVIRONMENT and OP_ENABLE_ENVIRONMENT_LOAD=true for bulk loading

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
if (!isCloud) {
  console.log(`${c.cyan}Next steps:${c.reset}
  1. Keep the generated .env defaults for baseline web dev. Add direct personal values only when needed; use 1Password OP refs for shared team/deploy/upload secrets.
     • WalletConnect shared secret: \`WALLETCONNECT_PROJECT_ID_OP_REF=op://<vault>/<item>/credential\`
  2. Check role readiness: bun run dev:doctor -- --profile web
  3. Start frontend services: bun run dev:web
     • Full stack with Docker/indexer/agent: bun run dev
  4. Smoke frontend services: bun run dev:smoke:web
  5. Run tests: bun run test

${c.dim}Individual packages:${c.reset}
  • bun run dev:client    - React PWA (port 3001)
  • bun run dev:indexer   - Blockchain indexer (port 8080)
  • bun run dev:contracts - Local blockchain (Anvil)
`);
}
