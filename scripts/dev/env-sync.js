#!/usr/bin/env node

/**
 * Materialize .env from .env.template via `op inject`.
 *
 * Replaces varlock as the env-loading mechanism. Run this when:
 *   - First clone (after creating .env.template via `bun run env:template:init`)
 *   - Secrets rotated in 1Password
 *   - .env.template changed (added/removed keys)
 *
 * Once .env exists, Bun, Vite, and node --env-file= read it natively.
 * No per-command 1Password fetch, no Touch ID interruption mid-session.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const templatePath = path.join(projectRoot, ".env.template");
const envPath = path.join(projectRoot, ".env");
const backupPath = path.join(projectRoot, ".env.bak");
const fallbackBackupPath = path.join(os.tmpdir(), `green-goods-env-${process.pid}.bak`);

function fail(message, hint) {
  console.error(`error: ${message}`);
  if (hint) console.error(`  fix: ${hint}`);
  process.exit(1);
}

function backupEnv() {
  if (!fs.existsSync(envPath)) return "";

  try {
    fs.copyFileSync(envPath, backupPath);
    console.log(`Backed up existing .env to .env.bak`);
    return backupPath;
  } catch (error) {
    try {
      fs.copyFileSync(envPath, fallbackBackupPath);
      console.warn(
        `warning: could not write .env.bak in repo (${error.code || error.message}); backed up existing .env to ${fallbackBackupPath}`
      );
      return fallbackBackupPath;
    } catch (fallbackError) {
      fail(
        "could not back up existing .env",
        `${error.code || error.message}; fallback backup failed: ${
          fallbackError.code || fallbackError.message
        }`
      );
    }
  }
}

if (!fs.existsSync(templatePath)) {
  fail(
    ".env.template not found",
    "Run `bun run env:template:init` to generate one from .env.schema, then edit it."
  );
}

// Don't pre-check `op whoami` — it returns "not signed in" without a session token,
// but `op inject` itself triggers Touch ID via the 1Password desktop app integration.
// Pre-checking would block the actual auth from happening.

const restorePath = backupEnv();

console.log("Running `op inject` to resolve .env.template -> .env...");
const inject = spawnSync("op", ["inject", "-i", templatePath, "-o", envPath, "--force"], {
  cwd: projectRoot,
  stdio: ["inherit", "inherit", "inherit"],
});

if (inject.status !== 0) {
  if (restorePath && fs.existsSync(restorePath)) {
    try {
      fs.copyFileSync(restorePath, envPath);
      console.error(`Restored .env from ${restorePath} after op inject failure.`);
    } catch (error) {
      console.error(
        `warning: op inject failed and .env restore from ${restorePath} also failed: ${
          error.code || error.message
        }`
      );
    }
  }
  fail(
    "op inject failed",
    "Check the 1Password desktop app integration and confirm every op://... reference in .env.template points to a valid Vault/Item/field."
  );
}

console.log("");
console.log("Wrote .env from .env.template.");
console.log("Restart any running dev servers so they pick up the new env: `bun run dev:stop && bun run dev`.");
