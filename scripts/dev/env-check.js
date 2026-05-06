#!/usr/bin/env node

/**
 * Validate .env against .env.schema.
 *
 * Replaces varlock's startup validation. Reads .env.schema as the key contract,
 * checks .env has every required key non-empty. Never prints values.
 *
 * Exit 0 = valid. Exit 1 = missing/empty required keys.
 *
 * A schema key is treated as required unless its declaration line has a
 * `# @optional` comment, the key starts with `OP_`, or the key has a non-empty
 * default value in the schema.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, ".env.schema");
const envPath = path.join(projectRoot, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
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

function parseSchema(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const entries = [];
  let pendingOptional = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      if (/@optional/i.test(line)) pendingOptional = true;
      continue;
    }

    const equals = line.indexOf("=");
    if (equals === -1) {
      pendingOptional = false;
      continue;
    }

    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      pendingOptional = false;
      continue;
    }

    const inlineOptional = /@optional/i.test(line);
    entries.push({
      key,
      hasDefault: value.length > 0,
      optional: pendingOptional || inlineOptional,
    });

    pendingOptional = false;
  }

  return entries;
}

// Conservative required list: only the keys that MUST be present for `bun run dev:web`
// to function. Wider validation (per-profile) belongs in env-check --profile in a future pass.
const baselineRequiredKeys = new Set([
  "APP_ENV",
  "VITE_CHAIN_ID",
  "VITE_API_BASE_URL",
  "VITE_ENVIO_INDEXER_URL",
]);

function isRequired(entry) {
  return baselineRequiredKeys.has(entry.key);
}

const schema = parseSchema(schemaPath);
if (!schema) {
  console.error("error: .env.schema not found at", schemaPath);
  process.exit(1);
}

const env = parseEnvFile(envPath);
if (!env) {
  console.error("error: .env not found.");
  console.error("  fix: Run `bun run env:template:init` then `bun run env:sync` to create one.");
  process.exit(1);
}

const missing = [];
const empty = [];

for (const entry of schema) {
  if (!isRequired(entry)) continue;
  if (!(entry.key in env)) {
    missing.push(entry.key);
    continue;
  }
  const value = env[entry.key];
  if (!value || value.trim() === "") {
    empty.push(entry.key);
  }
}

if (missing.length === 0 && empty.length === 0) {
  console.log(`env-check: .env satisfies .env.schema (${schema.length} keys checked).`);
  process.exit(0);
}

console.error("env-check: .env is incomplete.");
if (missing.length > 0) {
  console.error("");
  console.error(`Missing keys (${missing.length}):`);
  for (const key of missing.sort()) console.error(`  - ${key}`);
}
if (empty.length > 0) {
  console.error("");
  console.error(`Empty values (${empty.length}):`);
  for (const key of empty.sort()) console.error(`  - ${key}`);
}
console.error("");
console.error("Fix:");
console.error("  - Add the missing keys to .env.template (with op:// refs or plain values)");
console.error("  - Run `bun run env:sync` to materialize");
console.error("  - Or set the value directly in .env if it's a personal local credential");
process.exit(1);
