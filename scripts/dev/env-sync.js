#!/usr/bin/env node

/**
 * Materialize .env from env.schema via `op inject`.
 *
 * env.schema is the inject template: a shared team secret is a 1Password reference in the
 * value position, and `op inject` swaps each reference for its secret. Run this when:
 *   - First clone
 *   - Secrets rotated in 1Password
 *   - env.schema changed (added/removed keys or references)
 *
 * Once .env exists, Bun, Vite, and node --env-file= read it natively.
 * No per-command 1Password fetch, no Touch ID interruption mid-session.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findSyncProblems } from "../lib/env-schema.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, "env.schema");
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

if (!fs.existsSync(schemaPath)) {
  fail("env.schema not found", "It is tracked in Git; restore it with `git restore env.schema`.");
}

// Refuse a schema the inject step would trip on or copy wrongly, before .env is touched.
const syncProblems = findSyncProblems(fs.readFileSync(schemaPath, "utf8"));
if (syncProblems.length > 0) {
  for (const problem of syncProblems) console.error(`env.schema ${problem}`);
  fail("env.schema cannot be synced as written", "Fix the lines above, then rerun `bun run env:sync`.");
}

// Don't pre-check `op whoami` — it returns "not signed in" without a session token,
// but `op inject` itself triggers Touch ID via the 1Password desktop app integration.
// Pre-checking would block the actual auth from happening.

const restorePath = backupEnv();

console.log("Running `op inject` to resolve env.schema -> .env...");
const inject = spawnSync("op", ["inject", "-i", schemaPath, "-o", envPath, "--force"], {
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
    "Check the 1Password desktop app integration and confirm every op://... reference in env.schema points to a valid Vault/Item/field."
  );
}

console.log("");
console.log("Wrote .env from env.schema.");
console.log("Restart your owning dev launcher with Ctrl-C and the same mode so it picks up the new environment. Do not stop another session or silently change modes.");
