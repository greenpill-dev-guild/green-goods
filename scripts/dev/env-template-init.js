#!/usr/bin/env node

/**
 * Generate .env.template from .env.schema.
 *
 * .env.template is the team-shared source of truth: keys + 1Password refs
 * (op://Vault/Item/field) for shared secrets, plain values for non-secrets.
 *
 * `bun run env:sync` then runs `op inject` against this template to produce .env.
 *
 * Usage:
 *   node scripts/dev/env-template-init.js [--vault <name>] [--field <name>] [--force]
 *
 * Options:
 *   --vault <name>   1Password vault to look up items in. If set, the script queries
 *                    `op item list --vault <name>` and writes a real op:// ref for any
 *                    schema key that matches an item title in that vault. Without this
 *                    flag, sensitive keys get YOUR_VAULT placeholders you must edit.
 *   --field <name>   Field name within each 1Password item (default: credential).
 *   --force          Overwrite an existing .env.template.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, ".env.schema");
const templatePath = path.join(projectRoot, ".env.template");

function parseArgs(argv) {
  const opts = { vault: "", field: "credential", force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--vault") opts.vault = argv[++i] || "";
    else if (arg.startsWith("--vault=")) opts.vault = arg.slice("--vault=".length);
    else if (arg === "--field") opts.field = argv[++i] || "credential";
    else if (arg.startsWith("--field=")) opts.field = arg.slice("--field=".length);
    else if (arg === "--force") opts.force = true;
    else if (arg === "-h" || arg === "--help") {
      console.log("Usage: node scripts/dev/env-template-init.js [--vault <name>] [--field <name>] [--force]");
      process.exit(0);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (!fs.existsSync(schemaPath)) {
  console.error("error: .env.schema not found at", schemaPath);
  process.exit(1);
}

if (fs.existsSync(templatePath) && !opts.force) {
  console.error("error: .env.template already exists. Pass --force to overwrite, or remove and rerun.");
  process.exit(1);
}

let vaultItemNames = new Set();
if (opts.vault) {
  const list = spawnSync("op", ["item", "list", "--vault", opts.vault, "--format", "json"], {
    encoding: "utf8",
  });
  if (list.status !== 0) {
    console.error(`error: failed to list items in vault "${opts.vault}".`);
    console.error(`  ${(list.stderr || "").trim()}`);
    console.error("  fix: confirm `op whoami` succeeds and the vault name matches `op vault list`.");
    process.exit(1);
  }
  try {
    const items = JSON.parse(list.stdout);
    for (const item of items) {
      if (typeof item.title === "string") vaultItemNames.add(item.title);
    }
  } catch (err) {
    console.error("error: failed to parse `op item list` output:", err.message);
    process.exit(1);
  }
}

const schemaText = fs.readFileSync(schemaPath, "utf8");

const lines = [];
lines.push("# .env.template — team-shared source of truth for environment variables.");
lines.push("# Generated from .env.schema. Edit this file to:");
lines.push("#   - replace placeholder values with 1Password refs (Vault/Item/field) for shared secrets");
lines.push("#   - keep plain values for non-secret defaults (URLs, ports, feature flags)");
lines.push("# Then run `bun run env:sync` to materialize .env via the inject step.");
lines.push("# Note: do not write example op-scheme URIs in comments — the inject tool will try to resolve them.");
lines.push("");

let pendingComment = [];
let opRefCount = 0;
let placeholderCount = 0;

for (const rawLine of schemaText.split(/\r?\n/)) {
  const line = rawLine.trimEnd();

  if (!line.trim()) {
    if (pendingComment.length > 0) {
      lines.push(...pendingComment, "");
      pendingComment = [];
    } else {
      lines.push("");
    }
    continue;
  }

  if (line.trim().startsWith("#")) {
    // Defang any op:// URIs in passed-through comments — `op inject` resolves matches even
    // inside comments, so a literal example op:// string would crash the inject pipeline.
    pendingComment.push(line.replace(/op:\/\//g, "op-scheme://"));
    continue;
  }

  const equals = line.indexOf("=");
  if (equals === -1) continue;

  const key = line.slice(0, equals).trim();
  const value = line.slice(equals + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

  // Skip varlock plumbing keys — *_OP_REF told varlock where to fetch a sibling key.
  // Without varlock, you put op:// refs directly in the target key, so these are dead.
  if (key.endsWith("_OP_REF")) continue;

  if (pendingComment.length > 0) {
    lines.push(...pendingComment);
    pendingComment = [];
  }

  const isSensitiveHint = line.includes("@sensitive") || /password|token|secret|key|jwt/i.test(key);

  // Detect leftover varlock syntax — `$VAR` substitution and `if(...)` conditionals.
  // These don't resolve without varlock; passing them through to .env yields broken values.
  const isVarlockExpr = /^\$[A-Z_]/.test(value) || /^if\s*\(/.test(value);

  if (opts.vault && vaultItemNames.has(key)) {
    lines.push(`${key}=op://${opts.vault}/${key}/${opts.field}`);
    opRefCount += 1;
  } else if (isVarlockExpr) {
    // Resolve `$OTHER_KEY` substitutions to the matching vault ref when the source is in the vault.
    const directRefMatch = /^\$([A-Z][A-Z0-9_]*)$/.exec(value);
    if (directRefMatch && opts.vault && vaultItemNames.has(directRefMatch[1])) {
      lines.push(`${key}=op://${opts.vault}/${directRefMatch[1]}/${opts.field}`);
      opRefCount += 1;
    } else {
      // Conditional or non-resolvable substitution. Leave empty with a comment so the dev decides.
      lines.push(`# TODO: ${key} used a varlock expression in .env.schema (${value.slice(0, 40)}...).`);
      lines.push(`# Set a real value, a 1Password ref using the op-scheme URI, or leave empty for app fallback.`);
      lines.push(`${key}=`);
    }
  } else if (isSensitiveHint && !value) {
    lines.push(`${key}=op://YOUR_VAULT/${key}/${opts.field}`);
    placeholderCount += 1;
  } else {
    lines.push(`${key}=${value}`);
  }
}

fs.writeFileSync(templatePath, `${lines.join("\n").replace(/\n+$/, "")}\n`);

console.log(`Wrote ${path.relative(projectRoot, templatePath)}`);
if (opts.vault) {
  console.log(`Generated ${opRefCount} real op:// ref(s) from vault "${opts.vault}".`);
}
if (placeholderCount > 0) {
  console.log(`Wrote ${placeholderCount} YOUR_VAULT placeholder(s) — edit these before running env:sync.`);
}
console.log("");
console.log("Next steps:");
if (placeholderCount > 0) {
  console.log("  1. Edit .env.template — replace op://YOUR_VAULT/... placeholders with real refs");
  console.log("  2. Run `bun run env:sync` to materialize .env");
} else {
  console.log("  1. Run `bun run env:sync` to materialize .env");
}
