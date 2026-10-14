#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function parsePinnedFoundryVersion(miseToml) {
  const match = miseToml.match(/^foundry\s*=\s*"v?([^"]+)"\s*$/m);
  const version = match?.[1] ?? "";
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(".mise.toml must pin Foundry to an exact x.y.z version");
  }
  return version;
}

export function readPinnedFoundryVersion(projectRoot) {
  return parsePinnedFoundryVersion(fs.readFileSync(path.join(projectRoot, ".mise.toml"), "utf8"));
}

export function parseForgeVersion(output) {
  return output.match(/forge Version:\s*v?(\d+\.\d+\.\d+)/i)?.[1] ?? "";
}

export function foundryVersionMatches(output, expectedVersion) {
  return parseForgeVersion(output) === expectedVersion;
}

export function readInstalledForgeVersion() {
  const result = spawnSync("forge", ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return { output: "", version: "" };
  const output = `${result.stdout || result.stderr}`.trim();
  return { output, version: parseForgeVersion(output) };
}

export function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "../..");
  const expectedVersion = readPinnedFoundryVersion(projectRoot);
  const installed = readInstalledForgeVersion();

  if (installed.version !== expectedVersion) {
    const detected = installed.version || "not installed";
    process.stderr.write(`Foundry ${expectedVersion} is required; detected ${detected}.\n`);
    process.stderr.write(`Run: foundryup --install v${expectedVersion} && foundryup --use v${expectedVersion}\n`);
    process.stderr.write(`Or:  mise install foundry@${expectedVersion}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Foundry ${expectedVersion} matches the repository toolchain pin.\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
