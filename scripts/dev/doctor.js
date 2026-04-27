#!/usr/bin/env node

/**
 * Non-mutating development environment doctor.
 *
 * Reports local machine readiness for Green Goods developer roles. It does not
 * install dependencies, start services, write .env, or print secret values.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const validProfiles = new Set(["web", "full", "contracts", "upload"]);

const profileLabels = {
  web: "Frontend QA",
  full: "Full-stack/indexer",
  contracts: "Contracts",
  upload: "Upload-capable QA",
};

const profilePorts = {
  web: [
    { port: 3001, label: "client" },
    { port: 3002, label: "admin" },
    { port: 3003, label: "docs" },
  ],
  full: [
    { port: 3001, label: "client" },
    { port: 3002, label: "admin" },
    { port: 3003, label: "docs" },
    { port: 5433, label: "indexer postgres" },
    { port: 6006, label: "storybook" },
    { port: 8080, label: "indexer graphql" },
    { port: 9898, label: "envio indexer" },
  ],
  contracts: [],
  upload: [
    { port: 3001, label: "client" },
    { port: 3002, label: "admin" },
    { port: 3003, label: "docs" },
  ],
};

const requiredTools = [
  { cmd: "node", label: "Node.js", minMajor: 22 },
  { cmd: "bun", label: "Bun", minMajor: 1 },
  { cmd: "git", label: "Git" },
];

const marks = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
  info: "INFO",
};

const results = [];
let opReady = null;

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: node scripts/dev/doctor.js [--profile web|full|contracts|upload] [--json]\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = { profile: "web", json: false };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--json") {
      options.json = true;
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

    process.stderr.write(`Unknown option: ${arg}\n`);
    usage(1);
  }

  if (!validProfiles.has(options.profile)) {
    process.stderr.write(`Invalid profile: ${options.profile || "(missing)"}\n`);
    usage(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

function add(level, title, detail = "", fix = "", metadata = {}) {
  results.push({ level, title, detail, fix, ...metadata });
}

function requiredLevel(requiredProfiles, fallback = "warn") {
  return requiredProfiles.includes(options.profile) ? "fail" : fallback;
}

function commandExists(cmd) {
  const probe = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  return spawnSync(probe, { shell: true, stdio: "ignore" }).status === 0;
}

function commandVersion(cmd) {
  if (cmd === "node" && process.versions.node) {
    return `v${process.versions.node}`;
  }

  const result = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return `${result.stdout || result.stderr}`.trim().split("\n")[0] || "";
}

function majorVersion(version) {
  const match = version.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
    const equals = normalized.indexOf("=");
    if (equals === -1) continue;

    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function valueFor(envFile, key) {
  return process.env[key] ?? envFile[key] ?? "";
}

function hasUsableValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^if\(|^op\(|^\$\{?[A-Z0-9_]+\}?$/i.test(trimmed)) return false;
  if (/^(changeme|change-me|placeholder|test|example|your_)/i.test(trimmed)) return false;
  return true;
}

function hasOpRef(value) {
  return /^op:\/\//.test(value.trim());
}

function opRefEntries(envFile) {
  return Object.entries(envFile).filter(([, value]) => hasOpRef(value));
}

function checkPortHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve(error && error.code === "EADDRINUSE" ? false : true);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function checkPort(port) {
  const [ipv4Available, ipv6Available] = await Promise.all([
    checkPortHost(port, "127.0.0.1"),
    checkPortHost(port, "::1"),
  ]);
  return ipv4Available && ipv6Available;
}

function checkPlatform() {
  if (process.platform === "win32") {
    add(
      "fail",
      "Native Windows detected",
      "Green Goods scripts are supported on macOS/Linux shells. Use WSL2 or a dev container on Windows.",
      "Open the repo inside WSL2, then rerun bun run setup.",
      { check: "platform" }
    );
    return;
  }

  add("pass", "Shell platform supported", `${process.platform}; macOS/Linux native scripts are supported.`, "", {
    check: "platform",
  });
}

function checkTools() {
  for (const tool of requiredTools) {
    if (!commandExists(tool.cmd)) {
      add("fail", `${tool.label} not found`, "", `Install ${tool.label}, then rerun bun run setup.`, {
        check: `tool:${tool.cmd}`,
      });
      continue;
    }

    const version = commandVersion(tool.cmd);
    const major = majorVersion(version);
    if (tool.minMajor && major !== null && major < tool.minMajor) {
      add(
        "fail",
        `${tool.label} version is too old`,
        `${version || "unknown version"} detected; ${tool.minMajor}+ required.`,
        tool.cmd === "node" ? "Install Node 22, or run mise install from the repo root." : "",
        { check: `tool:${tool.cmd}` }
      );
      continue;
    }

    add("pass", `${tool.label} available`, version, "", { check: `tool:${tool.cmd}` });
  }

  if (options.profile === "full") {
    if (!commandExists("docker")) {
      add("fail", "Docker not found", "Required for full-stack/indexer work.", "Install Docker Desktop or Docker Engine.", {
        check: "tool:docker",
      });
    } else {
      add("pass", "Docker available", commandVersion("docker"), "", { check: "tool:docker" });
    }

    if (!commandExists("pnpm")) {
      add("warn", "pnpm not found", "Only required for native generated-indexer package work.", "", {
        check: "tool:pnpm",
      });
    } else {
      add("pass", "pnpm available", commandVersion("pnpm"), "", { check: "tool:pnpm" });
    }
  }

  if (options.profile === "contracts") {
    if (!commandExists("forge")) {
      add(
        "fail",
        "Foundry not found",
        "Required for contracts work.",
        "Install Foundry with curl -L https://foundry.paradigm.xyz | bash && foundryup.",
        { check: "tool:forge" }
      );
    } else {
      add("pass", "Foundry available", commandVersion("forge"), "", { check: "tool:forge" });
    }
  }
}

function checkDocker() {
  if (options.profile !== "full" || !commandExists("docker")) return;

  const result = spawnSync("docker", ["ps"], { stdio: "ignore" });
  if (result.status === 0) {
    add("pass", "Docker daemon running", "Required for full-stack/indexer development.", "", {
      check: "docker-daemon",
    });
  } else {
    add(
      "fail",
      "Docker daemon is not running",
      "Full-stack/indexer work needs Docker.",
      process.platform === "darwin" ? "Open Docker Desktop, then rerun bun run dev:doctor -- --profile full." : "",
      { check: "docker-daemon" }
    );
  }
}

function checkOpReadiness(envFile) {
  const opRefs = opRefEntries(envFile);
  const usesBulkOp = valueFor(envFile, "OP_ENABLE_ENVIRONMENT_LOAD").toLowerCase() === "true";
  if (opRefs.length === 0 && !usesBulkOp) {
    opReady = true;
    return;
  }

  if (!commandExists("op")) {
    opReady = false;
    add(
      "fail",
      "1Password CLI is not installed",
      `${opRefs.length} OP ref(s) or bulk environment loading are configured.`,
      "Install the 1Password CLI, or remove OP refs not needed on this machine.",
      { check: "op-cli" }
    );
    return;
  }

  const opStatus = spawnSync("op", ["whoami", "--format", "json"], {
    encoding: "utf8",
    stdio: "ignore",
    timeout: 3000,
  });

  if (opStatus.status === 0) {
    opReady = true;
    add("pass", "1Password CLI signed in", `${opRefs.length} OP ref(s) can be resolved locally.`, "", {
      check: "op-cli",
    });
    return;
  }

  opReady = false;
  add(
    "fail",
    "1Password CLI is not signed in",
    `${opRefs.length} OP ref(s) or bulk environment loading are configured.`,
    "Run op signin, unlock the desktop app, or remove OP refs not needed for this role.",
    { check: "op-cli" }
  );
}

function checkEnv() {
  const envPath = path.join(projectRoot, ".env");
  const schemaPath = path.join(projectRoot, ".env.schema");
  const envFile = parseEnvFile(envPath);
  const schema = parseEnvFile(schemaPath);

  if (fs.existsSync(envPath)) {
    add("pass", "Root .env exists", "Package-level .env files are still not allowed.", "", {
      check: "env:file",
    });
  } else {
    add(
      requiredLevel(["web", "full", "upload"]),
      "Root .env is missing",
      "",
      "Run bun run setup from a fresh clone.",
      { check: "env:file" }
    );
  }

  const staleStorageKeys = Object.keys(envFile).filter((key) => key.includes("STORACHA"));
  if (staleStorageKeys.length > 0) {
    add(
      "fail",
      "Root .env contains stale Storacha keys",
      staleStorageKeys.sort().join(", "),
      "Remove Storacha entries from root .env, or move .env aside and rerun bun run setup.",
      { check: "env:stale-storage" }
    );
  }

  checkOpReadiness(envFile);

  const vitePinataJwt = valueFor(envFile, "VITE_PINATA_JWT");
  const pinataUploadJwtOpRef = valueFor(envFile, "PINATA_UPLOAD_JWT_OP_REF");
  const pinataJwt = valueFor(envFile, "PINATA_JWT");
  const hasPinataBrowser = hasUsableValue(vitePinataJwt) || (hasOpRef(pinataUploadJwtOpRef) && opReady);
  const hasPinataServer = hasPinataBrowser || hasUsableValue(pinataJwt);

  if (hasPinataBrowser) {
    add("pass", "Pinata upload credentials configured", "Secret value or OP ref was detected but not printed.", "", {
      check: "env:pinata",
    });
  } else {
    add(
      requiredLevel(["upload"]),
      "Pinata upload credentials missing",
      "Image reads can use public gateways, but upload-capable QA will fail.",
      "Set VITE_PINATA_JWT in root .env, or PINATA_UPLOAD_JWT_OP_REF=op://... to resolve it through Varlock.",
      { check: "env:pinata" }
    );
  }

  if (!hasPinataBrowser && hasPinataServer) {
    add(
      requiredLevel(["upload"]),
      "Browser Pinata JWT is not resolved",
      "Current frontend upload code still consumes VITE_PINATA_JWT.",
      "Set VITE_PINATA_JWT directly or configure PINATA_UPLOAD_JWT_OP_REF.",
      { check: "env:pinata-browser" }
    );
  }

  const rpId = valueFor(envFile, "VITE_PASSKEY_RP_ID") || schema.VITE_PASSKEY_RP_ID || "";
  if (!rpId) {
    add("pass", "Passkey RP ID uses runtime fallback", "localhost in dev, greengoods.app otherwise.", "", {
      check: "env:passkey-rp-id",
    });
  } else if (rpId === "localhost") {
    add("pass", "Passkey RP ID set for local browser QA", "localhost", "", {
      check: "env:passkey-rp-id",
    });
  } else if (rpId === "greengoods.app") {
    add(
      "warn",
      "Passkey RP ID is production domain",
      "Local passkey creation on localhost may fail with this override.",
      "For localhost QA, set VITE_PASSKEY_RP_ID=localhost or leave it blank.",
      { check: "env:passkey-rp-id" }
    );
  } else {
    add("info", "Passkey RP ID override present", "Custom value detected but not printed.", "", {
      check: "env:passkey-rp-id",
    });
  }

  if (options.profile === "web" || options.profile === "full" || options.profile === "upload") {
    const indexerUrl = valueFor(envFile, "VITE_ENVIO_INDEXER_URL") || schema.VITE_ENVIO_INDEXER_URL || "";
    if (indexerUrl.includes("localhost:8080")) {
      add("pass", "Indexer URL points to local GraphQL", "http://localhost:8080/v1/graphql", "", {
        check: "env:indexer-url",
      });
    } else if (indexerUrl) {
      add("info", "Indexer URL override present", "Non-local value detected but not printed.", "", {
        check: "env:indexer-url",
      });
    } else {
      add("warn", "Indexer URL is missing", "", "Set VITE_ENVIO_INDEXER_URL in root .env.", {
        check: "env:indexer-url",
      });
    }
  }
}

function checkIndexerGenerated() {
  if (options.profile !== "full") return;

  const generatedDir = path.join(projectRoot, "packages/indexer/generated");
  const generatedSrc = path.join(generatedDir, "src");
  const generatedModules = path.join(generatedDir, "node_modules");

  if (!fs.existsSync(generatedDir)) {
    add(
      "fail",
      "Indexer generated folder missing",
      "Needed for indexer tests and full-stack Docker builds.",
      "Run cd packages/indexer && bun run codegen && bun run setup-generated.",
      { check: "indexer:generated" }
    );
    return;
  }

  if (fs.existsSync(generatedSrc)) {
    add("pass", "Indexer generated source exists", "packages/indexer/generated/src", "", {
      check: "indexer:generated-src",
    });
  } else {
    add("fail", "Indexer generated source missing", "", "Run cd packages/indexer && bun run codegen.", {
      check: "indexer:generated-src",
    });
  }

  if (fs.existsSync(generatedModules)) {
    add("pass", "Indexer generated dependencies installed", "packages/indexer/generated/node_modules", "", {
      check: "indexer:generated-deps",
    });
  } else {
    add(
      "warn",
      "Indexer generated dependencies missing",
      "Needed for native indexer tests.",
      "Run cd packages/indexer && bun run setup-generated.",
      { check: "indexer:generated-deps" }
    );
  }
}

async function checkPorts() {
  for (const item of profilePorts[options.profile]) {
    const available = await checkPort(item.port);
    if (available) {
      add("pass", `Port ${item.port} available`, item.label, "", { check: `port:${item.port}` });
    } else {
      add(
        "warn",
        `Port ${item.port} already in use`,
        item.label,
        "Run bun run dev:stop, or stop the conflicting process before starting services.",
        { check: `port:${item.port}` }
      );
    }
  }
}

function summary() {
  const failures = results.filter((result) => result.level === "fail");
  const warnings = results.filter((result) => result.level === "warn");
  return {
    profile: options.profile,
    label: profileLabels[options.profile],
    ready: failures.length === 0,
    failures: failures.length,
    warnings: warnings.length,
  };
}

function printJson() {
  const payload = {
    profile: options.profile,
    label: profileLabels[options.profile],
    results,
    summary: summary(),
    entrypoints: {
      firstClone: "bun run setup",
      doctor: "bun run dev:doctor -- --profile web",
      webStack: "bun run dev:web",
      webSmoke: "bun run dev:smoke:web",
      fullStack: "bun run dev:full",
      stop: "bun run dev:stop",
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

function printText() {
  console.log(`\nGreen Goods Dev Doctor (${profileLabels[options.profile]})\n`);
  for (const result of results) {
    console.log(`[${marks[result.level]}] ${result.title}`);
    if (result.detail) console.log(`       ${result.detail}`);
    if (result.fix) console.log(`       Fix: ${result.fix}`);
  }

  console.log("\nRole readiness");
  console.log("- Frontend QA: Node.js, Bun, Git, root .env, ports 3001/3002/3003.");
  console.log("- Full-stack/indexer: frontend QA plus Docker and packages/indexer/generated.");
  console.log("- Contracts: frontend QA plus Foundry.");
  console.log("- Upload-capable QA: frontend QA plus Pinata JWT or 1Password OP ref.");

  console.log("\nRecommended entrypoints");
  console.log("- First clone: bun run setup");
  console.log("- Doctor profile: bun run dev:doctor -- --profile web");
  console.log("- Frontend stack: bun run dev:web");
  console.log("- Web smoke: bun run dev:smoke:web");
  console.log("- Full stack: bun run dev:full");
  console.log("- Stop PM2 services: bun run dev:stop");

  const currentSummary = summary();
  if (!currentSummary.ready) {
    console.log(`\n${currentSummary.failures} required check(s) failed.`);
    return;
  }

  if (currentSummary.warnings > 0) {
    console.log(`\nNo required checks failed; ${currentSummary.warnings} warning(s) need attention for some roles.`);
    return;
  }

  console.log(`\nAll checks passed for ${profileLabels[options.profile]}.`);
}

checkPlatform();
checkTools();
checkDocker();
checkEnv();
checkIndexerGenerated();
await checkPorts();

if (options.json) {
  printJson();
} else {
  printText();
}

if (!summary().ready) {
  process.exitCode = 1;
}
