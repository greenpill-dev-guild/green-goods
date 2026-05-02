#!/usr/bin/env node

/**
 * Run JS dev CLIs under real system Node, even when invoked from `bun run`.
 *
 * Bun injects a temporary `node` shim into child process PATH. That is useful
 * for many package scripts, but Vite HTTPS dev servers currently fail HMR WSS
 * handshakes when the Vite CLI is forced through Bun. This wrapper re-execs
 * itself under a non-Bun Node and then launches the requested local CLI.
 */

import { accessSync, constants, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_NODE_CLI_REEXEC",
  cwd: process.cwd(),
});

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write("Usage: node scripts/dev/node-cli.js <cli-or-path> [...args]\n");
  process.exit(exitCode);
}

function isSupportedNodeVersion(version) {
  const [major, minor] = version.split(".").map((value) => Number.parseInt(value, 10));
  return (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
}

function executableExists(candidate) {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findCompatibleNode() {
  const executable = process.platform === "win32" ? "node.exe" : "node";
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const candidates = [process.execPath];
  if (process.env.NODE) candidates.push(process.env.NODE);

  for (const entry of pathEntries) {
    if (entry.includes("bun-node") || entry.includes(`${path.sep}.bun${path.sep}bin`)) continue;
    candidates.push(path.join(entry, executable));
  }

  const miseShim = path.join(homedir(), ".local/share/mise/shims", executable);
  candidates.push(miseShim);

  const miseNodeRoot = path.join(homedir(), ".local/share/mise/installs/node");
  try {
    for (const version of readdirSync(miseNodeRoot).sort().reverse()) {
      candidates.push(path.join(miseNodeRoot, version, "bin", executable));
    }
  } catch {
    // mise is optional; PATH candidates above are enough on most machines.
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (!executableExists(candidate)) continue;
    const key = `${candidate}:${realpathSync(candidate)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const probe = spawnSync(
      candidate,
      ["-p", "process.versions.bun ? `bun:${process.versions.bun}` : process.versions.node"],
      {
        encoding: "utf8",
        timeout: 2_000,
      }
    );
    const version = (probe.stdout || "").trim();
    if (version.startsWith("bun:")) continue;
    if (version && isSupportedNodeVersion(version)) return candidate;
  }

  return "";
}

function reexecUnderCompatibleNodeIfNeeded() {
  if (!process.versions.bun && isSupportedNodeVersion(process.versions.node)) return;
  if (process.env.GREEN_GOODS_NODE_CLI_COMPAT_REEXEC === "1") return;

  const compatibleNode = findCompatibleNode();
  if (!compatibleNode || compatibleNode === realpathSync(process.execPath)) return;

  const result = spawnSync(compatibleNode, [__filename, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GREEN_GOODS_NODE_CLI_COMPAT_REEXEC: "1",
      NODE: compatibleNode,
      npm_node_execpath: compatibleNode,
    },
    stdio: "inherit",
  });

  if (result.error) return;
  process.exit(result.status ?? (result.signal ? 1 : 0));
}

function assertCompatibleNode() {
  if (process.versions.bun) {
    process.stderr.write(
      "node-cli.js is still running under Bun. Install Node 20.19+ or 22.12+ on PATH and retry.\n"
    );
    process.exit(1);
  }

  if (!isSupportedNodeVersion(process.versions.node)) {
    process.stderr.write(
      `Node ${process.versions.node} is too old for Vite 7. Use Node 20.19+ or 22.12+.\n`
    );
    process.exit(1);
  }
}

function resolveLocalCli(command) {
  if (command.includes("/") || command.includes(path.sep)) {
    const candidate = path.isAbsolute(command) ? command : path.resolve(process.cwd(), command);
    return executableExists(candidate) ? realpathSync(candidate) : candidate;
  }

  const candidates = [
    path.resolve(process.cwd(), "node_modules/.bin", command),
    path.resolve(projectRoot, "node_modules/.bin", command),
  ];

  for (const candidate of candidates) {
    if (executableExists(candidate)) return realpathSync(candidate);
  }

  return command;
}

function nodeFirstPath() {
  const nodeDir = path.dirname(process.execPath);
  const entries = (process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => !entry.includes("bun-node"));
  return [nodeDir, ...entries].join(path.delimiter);
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h") usage(command ? 0 : 1);

reexecUnderCompatibleNodeIfNeeded();
assertCompatibleNode();

const cliPath = resolveLocalCli(command);
const result = spawnSync(cliPath, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE: process.execPath,
    npm_node_execpath: process.execPath,
    PATH: nodeFirstPath(),
  },
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? (result.signal ? 1 : 0));
