#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main as checkFoundryVersion } from "./check-foundry-version.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(scriptDir, "../../packages/contracts");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: contractsRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

checkFoundryVersion();
if (process.exitCode) process.exit(process.exitCode);

run("forge", ["fmt", "--check"]);
run(process.execPath, [
  path.join(contractsRoot, "node_modules/solhint/solhint.js"),
  "--config",
  "./.solhint.json",
  "src/**/*.sol",
  "--ignore-path",
  ".solhintignore",
]);
