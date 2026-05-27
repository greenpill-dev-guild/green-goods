#!/usr/bin/env node

/**
 * Copy schema defaults from .env.schema into .env for keys missing there.
 *
 * Without varlock, Bun and Vite read .env directly — they do not consult .env.schema.
 * Run this once after removing varlock so schema defaults (URLs, ports, feature flags)
 * actually reach your runtime.
 *
 * Never overwrites existing values. Only appends keys absent from .env.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, ".env.schema");
const envPath = path.join(projectRoot, ".env");

function fail(message, hint) {
  console.error(`error: ${message}`);
  if (hint) console.error(`  fix: ${hint}`);
  process.exit(1);
}

function parseKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const text = fs.readFileSync(filePath, "utf8");
  const keys = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
    const equals = normalized.indexOf("=");
    if (equals === -1) continue;
    const key = normalized.slice(0, equals).trim();
    const value = normalized.slice(equals + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    keys.set(key, value);
  }
  return keys;
}

if (!fs.existsSync(schemaPath)) {
  fail(".env.schema not found");
}

const schemaDefaults = parseKeys(schemaPath);
const existingEnv = parseKeys(envPath);

const additions = [];
for (const [key, value] of schemaDefaults) {
  if (existingEnv.has(key)) continue;
  if (!value) continue;
  // Skip op-related infrastructure keys; user manages these directly.
  if (key === "OP_ENABLE_ENVIRONMENT_LOAD" || key === "OP_ENVIRONMENT" || key === "OP_ACCOUNT") continue;
  additions.push({ key, value });
}

if (additions.length === 0) {
  console.log("env-bootstrap: nothing to add — .env already has every defaulted schema key.");
  process.exit(0);
}

if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, `${envPath}.bak`);
  console.log(`Backed up .env to .env.bak`);
}

const block = ["", `# --- bootstrapped from .env.schema defaults on ${new Date().toISOString()} ---`];
for (const { key, value } of additions) {
  block.push(`${key}=${value}`);
}

const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").replace(/\n+$/, "") : "";
fs.writeFileSync(envPath, `${existing}\n${block.join("\n")}\n`);

console.log(`env-bootstrap: appended ${additions.length} schema defaults to .env.`);
console.log("Restart any running dev servers: `bun run dev:stop && bun run dev`.");
