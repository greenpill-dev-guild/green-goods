#!/usr/bin/env node

/**
 * Validate .env against env.schema.
 *
 * Reads env.schema as the key contract and checks that .env has every key the
 * profile requires, non-empty. Never prints values.
 *
 * Exit 0 = valid. Exit 1 = missing/empty required keys.
 *
 * A profile's keys are the ones annotated `# @required-in <profile>[,...]` in the
 * schema. With no arguments the profile is `dev`: what `bun run dev -- web` needs.
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
const schemaPath = path.join(projectRoot, "env.schema");
const envPath = path.join(projectRoot, ".env");
const DEFAULT_PROFILE = "dev";

function parseArgs(args) {
  const parsed = { profile: DEFAULT_PROFILE, envSource: "file" };

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
    console.error("error: env.schema not found at", schemaPath);
    process.exit(1);
  }

  const requiredKeys = requiredKeysForProfile(schema, options.profile);
  if (requiredKeys.length === 0) {
    // A profile nothing is annotated for would pass whatever the environment holds.
    console.error(`error: env.schema marks no key \`@required-in ${options.profile}\`.`);
    console.error("  fix: Check the profile name, or restore the annotations in env.schema.");
    process.exit(1);
  }

  const env = readEnvironment({ source: options.envSource, envFilePath: envPath });
  if (!env) {
    console.error("error: .env not found.");
    console.error(
      "  fix: Run `bun run env:sync` to create one from env.schema, or `npm run setup -- --profile isolated` for a baseline without secrets."
    );
    process.exit(1);
  }

  const { missing, empty } = validateRequiredEnvironment(requiredKeys, env);
  const sourceLabel = options.envSource === "process" ? "process environment" : ".env";

  if (missing.length === 0 && empty.length === 0) {
    console.log(
      `env-check: ${sourceLabel} has the ${requiredKeys.length} key(s) env.schema requires for ${options.profile}.`
    );
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
    console.error("  - Run `bun run env:sync` to rewrite .env from env.schema");
    console.error("  - If the key has no value there, give it one in env.schema (a 1Password reference or a plain value)");
    console.error("  - Or set the value directly in .env if it's a personal local credential");
  } else {
    console.error("Fix: set the missing values in the invoking process environment.");
  }
  process.exit(1);
}

main();
