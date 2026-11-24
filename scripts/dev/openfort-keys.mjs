#!/usr/bin/env node

/**
 * Store the Openfort keys for email sign-in everywhere they are read.
 *
 * Run it yourself, in your own terminal: it asks for each value with hidden input and never
 * prints one. The prompts name the Openfort dashboard's sections; the Project secret key is not
 * used. In order it
 *   1. saves each value to the "Green Goods" 1Password vault (the item env.schema references),
 *   2. runs `bun run env:sync`, which writes the root .env from env.schema,
 *   3. sets the two public keys on the App and Hub Vercel projects (production and staging),
 *   4. stages all four on the Fly agent app; they take effect at its next deploy.
 *
 * Values travel only through stdin and request bodies, never as command-line arguments.
 *
 *   bun run openfort:keys                  # all four steps
 *   bun run openfort:keys -- --skip-vercel --skip-fly
 *   bun run openfort:keys -- --dry-run     # say what would happen, ask for nothing
 *
 * Vercel needs a token: VERCEL_TOKEN, else the Vercel CLI's saved login, else a hidden prompt.
 * Fly uses the flyctl login on this machine.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const VAULT = "Green Goods";
const VERCEL_TEAM_SLUG = "greenpilldevguild";
const VERCEL_PROJECTS = ["green-goods", "green-goods-admin"]; // the App and the Hub
const VERCEL_CUSTOM_ENVIRONMENT = "staging";
const FLY_APP = "green-goods";

/** Every key, and where it is read. Only `public` keys may reach a browser build. */
export const OPENFORT_KEYS = [
  {
    name: "VITE_OPENFORT_PUBLISHABLE_KEY",
    prompt: "Project keys > Publishable key (pk_...)",
    public: true,
    vercel: true,
    fly: true,
  },
  {
    name: "VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY",
    prompt: "Embedded wallet keys > Publishable key",
    public: true,
    vercel: true,
    fly: true,
  },
  {
    name: "OPENFORT_SHIELD_SECRET_KEY",
    prompt: "Embedded wallet keys > Secret key",
    public: false,
    vercel: false,
    fly: true,
  },
  {
    name: "OPENFORT_SHIELD_ENCRYPTION_SHARE",
    prompt: "Embedded wallet keys > Encryption share",
    public: false,
    vercel: false,
    fly: true,
  },
];

function parseArgs(argv) {
  const flags = new Set(argv);
  const known = ["--skip-1password", "--skip-vercel", "--skip-fly", "--dry-run", "--help"];
  const unknown = argv.filter((arg) => !known.includes(arg));
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(" ")}`);
  return {
    onePassword: !flags.has("--skip-1password"),
    vercel: !flags.has("--skip-vercel"),
    fly: !flags.has("--skip-fly"),
    dryRun: flags.has("--dry-run"),
    help: flags.has("--help"),
  };
}

/** Read one line without echoing it. */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("Run this in a terminal: values are read with hidden input."));
      return;
    }
    stdout.write(`${prompt}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const finish = (result, error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish(value.trim());
        if (char === "\u0003") return finish(null, new Error("Cancelled; nothing was stored."));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function run(command, args, { input, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "inherit" : "pipe", quiet ? "pipe" : "inherit", "pipe"],
  });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  return result;
}

/**
 * Run a command that reads a value on stdin. Node gives a child a socket for stdin, which op does
 * not take as piped input ("provide the item category with '--category' flag"), so the value goes
 * through `cat` into a real pipe. Either way it never reaches the command line.
 */
function runPiped(command, args, input) {
  return run("/bin/sh", ["-c", 'cat | "$@"', "sh", command, ...args], { input, quiet: true });
}

/** What a failed command said, with any value it was given blanked out. */
function failure(result, values = []) {
  let said = (result.stderr ?? "").trim();
  for (const value of values) if (value) said = said.split(value).join("[redacted]");
  said = said.slice(0, 300);
  return said ? `: ${said}` : ` (exit ${result.status})`;
}

/** Create the item env.schema names, or replace its credential, with the value piped in. */
function storeInOnePassword(name, value) {
  const existing = run("op", ["item", "get", name, "--vault", VAULT, "--format", "json"], {
    quiet: true,
    input: "",
  });
  if (existing.status === 0) {
    const item = JSON.parse(existing.stdout);
    const field = (item.fields ?? []).find((f) => f.id === "credential" || f.label === "credential");
    if (!field) throw new Error(`1Password item ${name} has no "credential" field to replace.`);
    field.value = value;
    const edited = runPiped("op", ["item", "edit", name, "--vault", VAULT], JSON.stringify(item));
    if (edited.status !== 0) {
      throw new Error(`1Password refused to update ${name}${failure(edited, [value])}`);
    }
    return "updated";
  }
  // Create only when the item is missing. Any other failure (a locked app, no network, two items
  // with one name) could make a duplicate, which would leave env.schema's reference ambiguous.
  if (!/isn't an item/i.test(existing.stderr ?? "")) {
    throw new Error(`1Password could not look up ${name}${failure(existing)}`);
  }
  const created = runPiped(
    "op",
    ["item", "create", "--vault", VAULT, "-"],
    JSON.stringify({
      title: name,
      category: "API_CREDENTIAL",
      fields: [{ id: "credential", label: "credential", type: "CONCEALED", value }],
    })
  );
  if (created.status !== 0) {
    throw new Error(`1Password refused to create ${name}${failure(created, [value])}`);
  }
  return "created";
}

async function vercelToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
  const authFiles = [
    path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json"),
  ];
  for (const file of authFiles) {
    try {
      const token = JSON.parse(fs.readFileSync(file, "utf8")).token;
      if (typeof token === "string" && token) return token;
    } catch {
      // Not logged in through this path; try the next.
    }
  }
  return askHidden("Vercel token (none found from the CLI login)");
}

async function vercel(token, method, route, body) {
  const url = new URL(`https://api.vercel.com${route}`);
  url.searchParams.set("slug", VERCEL_TEAM_SLUG);
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    // Vercel's error bodies name the problem, never the value sent.
    throw new Error(`Vercel ${method} ${route} answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function storeInVercel(token, values) {
  for (const project of VERCEL_PROJECTS) {
    const { environments = [] } =
      (await vercel(token, "GET", `/v9/projects/${project}/custom-environments`)) ?? {};
    const staging = environments.find((env) => env.slug === VERCEL_CUSTOM_ENVIRONMENT);
    if (!staging) {
      throw new Error(`Vercel project ${project} has no "${VERCEL_CUSTOM_ENVIRONMENT}" environment.`);
    }
    const entries = OPENFORT_KEYS.filter((key) => key.vercel).flatMap((key) => [
      { key: key.name, value: values[key.name], type: "encrypted", target: ["production"] },
      {
        key: key.name,
        value: values[key.name],
        type: "encrypted",
        customEnvironmentIds: [staging.id],
      },
    ]);
    await vercel(token, "POST", `/v10/projects/${project}/env?upsert=true`, entries);
    console.log(`  Vercel ${project}: production and ${VERCEL_CUSTOM_ENVIRONMENT} set.`);
  }
}

function storeInFly(values) {
  const input = OPENFORT_KEYS.filter((key) => key.fly)
    .map((key) => `${key.name}=${values[key.name]}`)
    .join("\n");
  const result = runPiped("fly", ["secrets", "import", "--app", FLY_APP, "--stage"], `${input}\n`);
  if (result.status !== 0) {
    throw new Error(`fly secrets import failed${failure(result, Object.values(values))}`);
  }
  console.log(`  Fly ${FLY_APP}: staged; they apply at the agent's next deploy.`);
}

function describePlan(options) {
  const lines = ["This stores:"];
  for (const key of OPENFORT_KEYS) {
    const places = [
      options.onePassword && `1Password "${VAULT}" and the root .env`,
      options.vercel && key.vercel && `Vercel ${VERCEL_PROJECTS.join(", ")}`,
      options.fly && key.fly && `Fly ${FLY_APP}`,
    ].filter(Boolean);
    lines.push(`  ${key.name}${key.public ? " (public)" : ""}: ${places.join("; ") || "nowhere"}`);
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    return;
  }
  console.log(describePlan(options));
  if (options.dryRun) return;

  const values = {};
  for (const key of OPENFORT_KEYS) {
    const value = await askHidden(key.prompt);
    if (!value || /\s/.test(value)) throw new Error(`No usable value for ${key.name}; nothing was stored.`);
    values[key.name] = value;
  }

  if (options.onePassword) {
    for (const key of OPENFORT_KEYS) {
      console.log(`  1Password ${key.name}: ${storeInOnePassword(key.name, values[key.name])}.`);
    }
    const sync = run("bun", ["run", "env:sync"]);
    if (sync.status !== 0) throw new Error("env:sync failed; the 1Password items are saved.");
  }
  if (options.vercel) await storeInVercel(await vercelToken(), values);
  if (options.fly) storeInFly(values);
  console.log("Done. No value was printed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
}
