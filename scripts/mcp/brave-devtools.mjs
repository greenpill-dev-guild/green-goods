#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requiredNode = ">=20.19.0 or >=22.12.0";

function parseVersion(output) {
  const match = String(output).match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function supportsDevToolsMcp(version) {
  if (!version) return false;
  if (version.major >= 23) return true;
  if (version.major === 22) return version.minor > 12 || (version.minor === 12 && version.patch >= 0);
  if (version.major === 20) return version.minor > 19 || (version.minor === 19 && version.patch >= 0);
  return false;
}

function nodeVersion(nodeBin) {
  const result = spawnSync(nodeBin, ["-v"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return parseVersion(result.stdout || result.stderr);
}

function executableExists(candidate) {
  return Boolean(candidate) && existsSync(candidate);
}

function newestMiseNode() {
  const installRoot = path.join(homedir(), ".local/share/mise/installs/node");
  if (!existsSync(installRoot)) return "";

  const versions = readdirSync(installRoot)
    .map((entry) => ({
      entry,
      version: parseVersion(entry),
      nodeBin: path.join(installRoot, entry, "bin/node"),
    }))
    .filter((candidate) => supportsDevToolsMcp(candidate.version) && executableExists(candidate.nodeBin))
    .sort((a, b) => {
      if (a.version.major !== b.version.major) return b.version.major - a.version.major;
      if (a.version.minor !== b.version.minor) return b.version.minor - a.version.minor;
      return b.version.patch - a.version.patch;
    });

  return versions[0]?.nodeBin || "";
}

function resolveNodeBin() {
  const explicit = process.env.GREEN_GOODS_MCP_NODE_BIN;
  const candidates = [
    explicit,
    spawnSync("mise", ["which", "node"], { cwd: repoRoot, encoding: "utf8" }).stdout?.trim(),
    newestMiseNode(),
    process.execPath,
  ];

  for (const candidate of candidates) {
    if (!executableExists(candidate)) continue;
    if (supportsDevToolsMcp(nodeVersion(candidate))) return candidate;
  }

  process.stderr.write(
    `[green-goods:mcp] The upstream DevTools MCP package requires Node ${requiredNode}. ` +
      "Install the repo mise Node toolchain or set GREEN_GOODS_MCP_NODE_BIN to a compatible node binary.\n",
  );
  process.exit(1);
}

function isBraveExecutablePath(candidate) {
  return /brave/i.test(path.basename(candidate || "")) || /Brave Browser/i.test(candidate || "");
}

function resolveBraveExecutable() {
  const explicit = process.env.GREEN_GOODS_MCP_BRAVE_BIN;
  if (explicit && !isBraveExecutablePath(explicit)) {
    process.stderr.write(
      "[green-goods:mcp] GREEN_GOODS_MCP_BRAVE_BIN must point to Brave. " +
        "Google Chrome, Chrome for Testing, Chromium, and Edge are not valid Green Goods browser-proof targets.\n",
    );
    process.exit(1);
  }

  const candidates = [
    explicit,
    "/Applications/Brave Browser Beta.app/Contents/MacOS/Brave Browser Beta",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean);
  return candidates.find((candidate) => executableExists(candidate) && isBraveExecutablePath(candidate)) || "";
}

const nodeBin = resolveNodeBin();
const nodeDir = path.dirname(nodeBin);
const cacheDir = process.env.npm_config_cache || path.join(tmpdir(), "green-goods-npm-cache");
const serverArgs = [
  "-y",
  "chrome-devtools-mcp@latest",
  "--isolated",
  "--acceptInsecureCerts",
  "--viewport=1440x1000",
  "--experimentalPageIdRouting",
  "--experimentalStructuredContent",
  "--categoryExperimentalWebmcp",
  "--chromeArg=--enable-features=WebMCPTesting,DevToolsWebMCPSupport",
  "--redactNetworkHeaders",
  "--no-usage-statistics",
  "--no-performance-crux",
  ...process.argv.slice(2),
];

if (process.env.GREEN_GOODS_MCP_BRAVE_BROWSER_URL) {
  serverArgs.splice(2, 0, `--browserUrl=${process.env.GREEN_GOODS_MCP_BRAVE_BROWSER_URL}`);
} else if (process.env.GREEN_GOODS_MCP_BRAVE_WS_ENDPOINT) {
  serverArgs.splice(2, 0, `--wsEndpoint=${process.env.GREEN_GOODS_MCP_BRAVE_WS_ENDPOINT}`);
} else {
  const braveExecutable = resolveBraveExecutable();
  if (!braveExecutable) {
    process.stderr.write(
      "[green-goods:mcp] Brave is required for Green Goods browser MCP proof. " +
        "Install Brave or set GREEN_GOODS_MCP_BRAVE_BIN to the Brave executable.\n"
    );
    process.exit(1);
  }
  serverArgs.splice(2, 0, `--executablePath=${braveExecutable}`);
}

const child = spawn("npx", serverArgs, {
  cwd: tmpdir(),
  env: {
    ...process.env,
    PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ""}`,
    npm_config_cache: cacheDir,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  process.stderr.write(`[green-goods:mcp] Failed to start the Brave DevTools MCP wrapper: ${error.message}\n`);
  process.exit(1);
});
