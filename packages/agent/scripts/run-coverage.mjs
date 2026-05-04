#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "../..");
const vitestBin = resolve(repoRoot, "node_modules/vitest/vitest.mjs");

const coverageArgs = process.argv.slice(2);
const args = [vitestBin, "run", "--coverage", ...coverageArgs];

function supportsVitestV8Coverage(command) {
  const result = spawnSync(
    command,
    [
      "-e",
      "if (process.versions.bun) process.exit(1); import('node:inspector/promises').then(() => process.exit(0)).catch(() => process.exit(1))",
    ],
    {
      cwd: packageDir,
      stdio: "ignore",
    }
  );

  return result.status === 0;
}

function nodeMajor(command) {
  const result = spawnSync(command, ["-p", "process.versions.node"], {
    cwd: packageDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return 0;
  }

  return Number.parseInt(result.stdout.trim().split(".")[0] ?? "0", 10);
}

function resolveMiseNode() {
  const result = spawnSync("mise", ["which", "node"], {
    cwd: packageDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  const candidate = result.stdout.trim();
  return candidate && existsSync(candidate) ? candidate : null;
}

function nodeCandidates() {
  const candidates = [
    process.env.NODE,
    process.execPath,
    resolveMiseNode(),
    resolve(process.env.HOME ?? "", ".local/share/mise/installs/node/22/bin/node"),
    "node",
  ];

  return candidates.filter(Boolean);
}

const node = nodeCandidates().find(
  (candidate, index, candidates) =>
    candidates.indexOf(candidate) === index &&
    nodeMajor(candidate) >= 22 &&
    supportsVitestV8Coverage(candidate)
);

if (!node) {
  process.stderr.write(
    "Vitest V8 coverage requires Node 22+ with node:inspector/promises. Install the repo Node version with `mise install node@22` or run coverage with NODE=/path/to/node22.\n"
  );
  process.exit(1);
}

const result = spawnSync(node, args, {
  cwd: packageDir,
  stdio: "inherit",
  env: {
    ...process.env,
    APP_ENV: process.env.APP_ENV ?? "test",
  },
});

process.exit(result.status ?? 1);
