#!/usr/bin/env node

/**
 * Green Goods Setup Script
 *
 * Checks dependencies, installs packages, and configures environment
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { commandExists, commandVersion, majorVersion } from "../lib/dev-shared.js";

// `--cloud` skips human-onboarding steps (Docker check, .env generation via
// the 1Password CLI). Intended for Claude Code on the web and other ephemeral
// cloud environments where bun is preinstalled and secrets are injected by the
// platform, not resolved from op.
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
  if (commandExists(cmd)) return true;
  log.error(`${name} not found`);
  return false;
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
    // Only consider system dirs that already exist — `mkdirSync(..., { recursive: true })`
    // would otherwise materialise a stray /opt/homebrew/bin on Intel/Linux. Apple
    // Silicon Homebrew lives at /opt/homebrew; Intel/macOS legacy and most Linuxes
    // expose /usr/local/bin. ~/.local/bin is a per-user fallback we always create.
    const isAppleSilicon = process.platform === "darwin" && os.arch() === "arm64";
    const userLocalBin = path.join(home, ".local", "bin");
    const candidateDirs = [
      ...(isAppleSilicon && fs.existsSync("/opt/homebrew/bin") ? ["/opt/homebrew/bin"] : []),
      ...(fs.existsSync("/usr/local/bin") ? ["/usr/local/bin"] : []),
      userLocalBin,
    ];
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
      // Default macOS shell is zsh; .zprofile is sourced for login shells
      // (including the first Terminal tab), .zshrc only for interactive shells.
      // Append to both so subsequent shells pick up Foundry without a manual
      // sourcing step.
      const rcFiles = [path.join(home, ".bashrc")];
      if (platform === "darwin") {
        rcFiles.push(path.join(home, ".zshrc"));
        rcFiles.push(path.join(home, ".zprofile"));
      }
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
  const version = commandVersion(cmd);
  if (!version) {
    log.error(`${name} not found`);
    return false;
  }
  const major = majorVersion(version);
  if (major !== null && major >= minVersion) {
    log.success(`${name} ${version.split("\n")[0]}`);
    return true;
  }
  log.error(`${name} version ${minVersion}+ required`);
  return false;
}

function checkDocker() {
  try {
    execSync("docker ps", { stdio: "ignore" });
    const version = commandVersion("docker");
    log.success(version || "Docker available");
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

// Install dependencies — always run so lockfile drift after `git pull`
// doesn't leave the developer with an inconsistent node_modules. `bun install`
// is idempotent and fast on a warm cache.
log.info("Installing dependencies (idempotent)...\n");
try {
  execSync("bun install", { stdio: "inherit" });
  log.success("Dependencies installed\n");
} catch {
  log.error("Failed to install dependencies\n");
  process.exit(1);
}

// Setup environment — skipped in cloud since secrets are injected directly by
// the platform.
if (isCloud) {
  log.info("Skipping .env generation in cloud mode (secrets are injected by the platform)\n");
} else if (fs.existsSync(".env")) {
  log.success("Environment already configured\n");
} else if (fs.existsSync(".env.template")) {
  log.info(".env.template found — run `bun run env:sync` to materialize .env via `op inject`\n");
} else if (fs.existsSync(".env.schema")) {
  log.info("No .env yet. Bootstrap:");
  console.log(`  1. ${c.cyan}bun run env:template:init${c.reset}  -- generate .env.template from .env.schema`);
  console.log(`  2. Edit .env.template, replacing op://YOUR_VAULT/... with real 1Password refs`);
  console.log(`  3. ${c.cyan}bun run env:sync${c.reset}            -- materialize .env via \`op inject\``);
  console.log(`  Or for personal local-only credentials, copy .env.schema to .env and fill values directly.\n`);
} else {
  log.warning("No .env.schema found\n");
}

// Next steps
console.log(`${c.green}✓ Setup complete!${c.reset}\n`);
if (!isCloud) {
  console.log(`${c.cyan}Next steps:${c.reset}
  1. Materialize .env from 1Password: bun run env:sync
     (First time? Run \`bun run env:template:init\` first to scaffold .env.template.)
  2. Check environment readiness: bun run dev:health
     • PM2-only fallback check: bun run dev:doctor -- --profile web
  3. Start the full local environment: bun run dev
     • PM2-only fallback frontend services: bun run dev:web
  4. Smoke frontend services: bun run dev:smoke:web
  5. Run tests: bun run test

${c.dim}Individual packages:${c.reset}
  • bun run dev:client    - React PWA (port 3001)
  • bun run dev:indexer   - Blockchain indexer GraphQL (port 3006)
  • bun run dev:contracts - Local blockchain (Anvil)
`);
}
