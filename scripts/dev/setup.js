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

const validProfiles = new Set(["host", "isolated", "cloud"]);
const validInstallModes = new Set(["auto", "always", "skip"]);
const validEnvModes = new Set(["auto", "baseline", "skip"]);

function usage() {
  console.log(`Usage: node scripts/dev/setup.js [--profile host|isolated|cloud] [options]

Profiles:
  host      First-clone local machine setup. May install missing host tools.
  isolated  Container/worktree setup. May bootstrap Bun; no secrets/services.
  cloud     Remote/cloud setup. Secrets are expected to be injected externally.

Options:
  --cloud                 Alias for --profile cloud.
  --isolated              Alias for --profile isolated.
  --install auto|always|skip
                          Dependency install mode. Defaults to GG_SETUP_INSTALL or auto.
  --skip-install          Alias for --install skip.
  --env-mode auto|baseline|skip
                          .env handling. isolated+auto creates a non-secret baseline.
  --help                  Show this help.

Environment overrides:
  GG_WORKSPACE_PROFILE=host|isolated|cloud
  GG_SETUP_INSTALL=auto|always|skip
  GG_SETUP_ENV_MODE=auto|baseline|skip
`);
}

function parseArgs(argv) {
  const options = {
    profile: process.env.GG_WORKSPACE_PROFILE || "host",
    installMode: process.env.GG_SETUP_INSTALL || "auto",
    envMode: process.env.GG_SETUP_ENV_MODE || "auto",
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--cloud") {
      options.profile = "cloud";
      continue;
    }

    if (arg === "--isolated") {
      options.profile = "isolated";
      continue;
    }

    if (arg === "--profile") {
      options.profile = argv[++index] || "";
      continue;
    }

    if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      continue;
    }

    if (arg === "--install") {
      options.installMode = argv[++index] || "";
      continue;
    }

    if (arg.startsWith("--install=")) {
      options.installMode = arg.slice("--install=".length);
      continue;
    }

    if (arg === "--skip-install") {
      options.installMode = "skip";
      continue;
    }

    if (arg === "--env-mode") {
      options.envMode = argv[++index] || "";
      continue;
    }

    if (arg.startsWith("--env-mode=")) {
      options.envMode = arg.slice("--env-mode=".length);
      continue;
    }

    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }

  if (!validProfiles.has(options.profile)) {
    console.error(`Invalid setup profile: ${options.profile || "(missing)"}`);
    usage();
    process.exit(1);
  }

  if (!validInstallModes.has(options.installMode)) {
    console.error(`Invalid install mode: ${options.installMode || "(missing)"}`);
    usage();
    process.exit(1);
  }

  if (!validEnvModes.has(options.envMode)) {
    console.error(`Invalid env mode: ${options.envMode || "(missing)"}`);
    usage();
    process.exit(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const isHost = options.profile === "host";
const isIsolated = options.profile === "isolated";
const isCloud = options.profile === "cloud";

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

function dependencyReadiness() {
  const requiredPaths = [
    "node_modules/.bun",
    "node_modules/.bin/turbo",
    "node_modules/.bin/oxlint",
    "node_modules/multiformats/basics.js",
  ];
  const missing = requiredPaths.filter((entry) => !fs.existsSync(entry));
  return { ready: missing.length === 0, missing };
}

function shouldRunInstall() {
  if (options.installMode === "skip") return false;
  if (options.installMode === "always") return true;
  if (isHost) return true;

  const readiness = dependencyReadiness();
  if (readiness.ready) return false;

  if (fs.existsSync("node_modules")) {
    log.warning(`node_modules exists but install markers are missing (${readiness.missing.join(", ")}); reinstalling.`);
  }

  return true;
}

function installCommand() {
  return isHost ? "bun install" : "bun install --frozen-lockfile";
}

function writeBaselineEnv() {
  const envPath = ".env";
  if (fs.existsSync(envPath)) {
    log.success("Environment already configured\n");
    return;
  }

  if (options.envMode === "skip") {
    log.info("Skipping .env creation by request\n");
    return;
  }

  const shouldCreate = options.envMode === "baseline" || (isIsolated && options.envMode === "auto");
  if (!shouldCreate) return;

  const lines = [
    "# Non-secret Green Goods baseline generated by setup profile.",
    "# Replace or extend this file locally when a workflow needs credentials.",
    `GG_WORKSPACE_PROFILE=${options.profile}`,
    "APP_ENV=development",
    "VITE_CHAIN_ID=11155111",
    "VITE_API_BASE_URL=http://localhost:3000",
    "VITE_ENVIO_INDEXER_URL=http://localhost:3006/v1/graphql",
    "",
  ];

  fs.writeFileSync(envPath, lines.join("\n"), { mode: 0o600 });
  log.success("Created non-secret baseline .env for isolated workspace\n");
}

function reportEnvState() {
  if (isCloud) {
    log.info("Skipping .env generation in cloud mode (secrets are injected by the platform)\n");
    return;
  }

  writeBaselineEnv();
  if (fs.existsSync(".env")) return;

  if (fs.existsSync(".env.template")) {
    log.info(".env.template found — run `bun run env:sync` to materialize .env via `op inject`\n");
  } else if (fs.existsSync(".env.schema")) {
    log.info("No .env yet. Bootstrap:");
    console.log(`  1. ${c.cyan}bun run env:template:init${c.reset}  -- generate .env.template from .env.schema`);
    console.log(`  2. Edit .env.template, replacing op://YOUR_VAULT/... with real 1Password refs`);
    console.log(`  3. ${c.cyan}bun run env:sync${c.reset}            -- materialize .env via \`op inject\``);
    console.log(`  Or for a portable baseline: ${c.cyan}npm run setup -- --profile isolated${c.reset}\n`);
  } else {
    log.warning("No .env.schema found\n");
  }
}

console.log(`\n${c.green}🌱 Green Goods Setup${c.reset}${c.dim} (${options.profile})${c.reset}\n`);

// Check dependencies
log.info("Checking dependencies...\n");
const hasNode = checkVersion("node", 22, "Node.js");
let hasBun = checkVersion("bun", 1, "bun");
const hasGit = checkCommand("git", "Git");
const hasDocker = isHost ? checkDocker() : false;
const hasForge = isHost ? checkCommand("forge", "Foundry") : commandExists("forge");
if (!isHost && hasForge) log.success(commandVersion("forge") || "Foundry available");

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
    log.error("Bun missing in cloud environment — expected to be provided by the runtime image.\n");
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

if (isHost && !hasDocker) {
  log.warning("Docker not running. Required for indexer development.");
}

let foundryInstalled = hasForge;
if (!hasForge) {
  if (isHost) {
    log.warning("Foundry not found. Attempting to install...\n");
    foundryInstalled = installFoundry();
    if (!foundryInstalled) {
      log.warning("Continuing without Foundry — contract scripts and pre-push hooks will fail until installed.\n");
    }
  } else {
    log.warning("Foundry not found. Contracts work will need an image/profile that provides it.\n");
  }
}

if (shouldRunInstall()) {
  const command = installCommand();
  log.info(`Installing dependencies (${command})...\n`);
  try {
    execSync(command, { stdio: "inherit" });
    log.success("Dependencies installed\n");
  } catch {
    log.error("Failed to install dependencies\n");
    process.exit(1);
  }
} else {
  log.info("Skipping dependency install\n");
}

reportEnvState();

// Next steps
console.log(`${c.green}✓ Setup complete!${c.reset}\n`);
if (isIsolated) {
  console.log(`${c.cyan}Next steps:${c.reset}
  1. Check portable readiness: bun run dev:doctor -- --profile web
  2. Run focused package tests or builds for the task at hand
  3. Start services only when this workspace owns them: bun run dev:web
  4. Clean local artifacts when done: bun run dev:clean

${c.dim}Isolated setup avoids host installs, secret resolution, Docker starts, browser launches, and service stops.${c.reset}
`);
} else if (!isCloud) {
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
