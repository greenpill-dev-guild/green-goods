#!/usr/bin/env node

/**
 * Validate .env against .env.schema.
 *
 * Replaces varlock's startup validation. Reads .env.schema as the key contract,
 * checks .env has every required key non-empty. Never prints values.
 *
 * Exit 0 = valid. Exit 1 = missing/empty required keys.
 *
 * With no arguments, validates the conservative local-development baseline.
 * `--profile <name>` validates only keys annotated for that profile with
 * `# @required-in <profile>[,...]` in the schema.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSchema,
  readEnvironment,
  requiredKeysForProfile,
  validateRequiredEnvironment,
} from "../lib/env-schema.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, ".env.schema");
const envPath = path.join(projectRoot, ".env");

// Conservative required list: only the keys that MUST be present for `bun run dev:web`
// to function. It remains a fallback until `.env.schema` carries `@required-in dev`.
const baselineRequiredKeys = new Set([
  "APP_ENV",
  "VITE_CHAIN_ID",
  "VITE_API_BASE_URL",
  "VITE_ENVIO_INDEXER_URL",
]);

function parseArgs(args) {
  const parsed = { profile: undefined, envSource: "file" };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--profile") {
      parsed.profile = args[index + 1];
      index += 1;
      if (!parsed.profile) throw new Error("--profile requires a profile name.");
      continue;
    }
    if (arg === "--env-source") {
      parsed.envSource = args[index + 1];
      index += 1;
      if (parsed.envSource !== "file" && parsed.envSource !== "process") {
        throw new Error("--env-source must be file or process.");
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function requiredKeys(schema, profile) {
  if (!profile) return schema.filter((entry) => baselineRequiredKeys.has(entry.key)).map((entry) => entry.key);

  const profileKeys = requiredKeysForProfile(schema, profile);
  if (profile === "dev" && profileKeys.length === 0) {
    return schema.filter((entry) => baselineRequiredKeys.has(entry.key)).map((entry) => entry.key);
  }
  return profileKeys;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }

  const schema = parseSchema(schemaPath);
  if (!schema) {
    console.error("error: .env.schema not found at", schemaPath);
    process.exit(1);
  }

  const env = readEnvironment({ source: options.envSource, envFilePath: envPath });
  if (!env) {
    console.error("error: .env not found.");
    console.error("  fix: Run `bun run env:template:init` then `bun run env:sync` to create one.");
    process.exit(1);
  }

  const { missing, empty } = validateRequiredEnvironment(requiredKeys(schema, options.profile), env);
  const sourceLabel = options.envSource === "process" ? "process environment" : ".env";

  if (missing.length === 0 && empty.length === 0) {
    console.log(`env-check: ${sourceLabel} satisfies .env.schema (${schema.length} keys checked).`);
    process.exit(0);
  }

  console.error(`env-check: ${sourceLabel} is incomplete.`);
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
  if (options.envSource === "file") {
    console.error("Fix:");
    console.error("  - Add the missing keys to .env.template (with op:// refs or plain values)");
    console.error("  - Run `bun run env:sync` to materialize");
    console.error("  - Or set the value directly in .env if it's a personal local credential");
  } else {
    console.error("Fix: set the missing values in the invoking process environment.");
  }
  process.exit(1);
}

main();
