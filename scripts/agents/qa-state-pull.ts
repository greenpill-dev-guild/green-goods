#!/usr/bin/env bun
/**
 * Pull a QA app session into the repo's session workspace.
 *
 * The QA app (packages/qa) is where Afo and Gui record during a walk; this
 * brings that back as the artifacts `.claude/skills/qa-session/SKILL.md`
 * expects, so a session that ran in the browser closes out exactly like one
 * driven from the terminal.
 *
 *   bun run qa:pull [--slug 2026-09-02] [--out tmp/qa-session/<slug>] [--force]
 *
 * Reads the per-tester shards straight from the Blob store with
 * BLOB_READ_WRITE_TOKEN, NOT through the deployed app — so ingestion works
 * while the app is password-protected, and still works if the deploy is down.
 *
 * Results never enter git: everything lands under gitignored tmp/.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog } from "./qa-workbook-build";
import { mergeShards, ROSTER, summarize, toResultsCsv, type Shard } from "./qa-state";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, "..", "..");
const privateOutputRoot = path.join(repoRoot, "tmp");

interface Options {
  slug: string;
  outDir: string;
  force: boolean;
}

/** What a completed pull leaves behind, and therefore what a rerun would replace. */
export const SESSION_ARTIFACTS = ["results.csv", "qa-state.json"] as const;

export function parseArgs(argv: string[]): Options {
  let slug = new Date().toISOString().slice(0, 10);
  let outDir = "";
  let force = false;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--force") {
      force = true;
      continue;
    }
    if (flag !== "--slug" && flag !== "--out") {
      throw new Error(`unknown argument '${flag}' — expected --slug, --out or --force`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for '${flag}'`);
    if (flag === "--slug") slug = value;
    else outDir = value;
    index++;
  }
  const resolvedOutDir = path.resolve(repoRoot, outDir || path.join("tmp", "qa-session", slug));
  const relativeToPrivateRoot = path.relative(privateOutputRoot, resolvedOutDir);
  const escapesPrivateRoot =
    relativeToPrivateRoot === ".." ||
    relativeToPrivateRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToPrivateRoot);
  if (escapesPrivateRoot) {
    throw new Error("--out must stay under the repo's gitignored tmp/ directory");
  }
  return { slug, outDir: resolvedOutDir, force };
}

/**
 * Which session artifacts a pull would replace.
 *
 * A pulled run sheet is worked on AFTER the pull — severity gets assigned, a
 * note gets redacted, a case caught outside the web app gets appended — and
 * none of that exists in the Blob store. Rerunning the same slug to refresh
 * remote results would project the store back over that work and silently drop
 * it, so a pull that would land on an existing session refuses instead.
 * `--force` is how the operator says the local copy is expendable.
 */
export function existingArtifacts(outDir: string, exists: (target: string) => boolean = existsSync): string[] {
  return SESSION_ARTIFACTS.filter((name) => exists(path.join(outDir, name)));
}

/**
 * Parse one tester's shard, or throw.
 *
 * ABSENT and MALFORMED are different answers and only one of them is normal.
 * `mergeShards` skips a shard whose shape it does not recognise, which is right
 * for a merge but wrong for ingestion: a shard that is `null`, has no `entries`,
 * or is owned by someone else would drop that tester silently, and `qa:pull`
 * would then write a complete-LOOKING run sheet with their session missing.
 * Failing the pull is recoverable; a confident, incomplete CSV is not.
 */
export function parseShard(person: string, text: string): Shard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${person}'s shard is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${person}'s shard is not an object`);
  }
  const shard = parsed as Partial<Shard>;
  if (shard.person !== person) {
    throw new Error(`${person}'s shard reports its owner as ${JSON.stringify(shard.person ?? null)}`);
  }
  if (!shard.entries || typeof shard.entries !== "object" || Array.isArray(shard.entries)) {
    throw new Error(`${person}'s shard has no entries object`);
  }
  for (const [caseId, entry] of Object.entries(shard.entries)) {
    if (!entry || typeof entry !== "object" || typeof entry.s !== "string" || typeof entry.n !== "string") {
      throw new Error(`${person}'s entry for ${caseId} is malformed`);
    }
  }
  return shard as Shard;
}

/**
 * Read one tester's shard. A missing shard is normal — it means that person has
 * not recorded anything — and must not fail the pull for everyone else.
 */
async function readShard(person: string, token: string): Promise<Shard | null> {
  const { get } = await import("@vercel/blob");
  let text: string;
  try {
    const result = await get(`qa/entries/${person}.json`, {
      access: "private",
      // Match the app: never read a cached copy of a live session.
      useCache: false,
      token,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    text = await new Response(result.stream).text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not.?found|404/i.test(message)) return null;
    throw new Error(`could not read ${person}'s shard: ${message}`);
  }
  // Deliberately outside the catch: a shape failure is not a transport failure,
  // and must never be mistaken for the absent-shard case handled above.
  return parseShard(person, text);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Copy it from the QA app's Blob store " +
        "(Vercel > Storage > the private QA store > .env.local tab) into the repo root .env.",
    );
  }

  // Before the store fan-out, so a refused pull costs nothing and reads clearly.
  const clashes = existingArtifacts(options.outDir);
  if (clashes.length && !options.force) {
    throw new Error(
      `${path.relative(repoRoot, options.outDir)} already has ${clashes.join(" and ")}. ` +
        "Refusing to overwrite a pulled session — severity, redactions and hand-added rows " +
        "live only there. Pull to a fresh --out, or pass --force to replace it.",
    );
  }

  const catalog = await loadCatalog();
  const active = catalog.cases.filter((testCase) => testCase.status !== "retired");
  const shards = await Promise.all(ROSTER.map((person) => readShard(person, token)));
  const merged = mergeShards(shards);
  const summary = summarize(active, merged);

  mkdirSync(options.outDir, { recursive: true });
  const csvPath = path.join(options.outDir, "results.csv");
  const statePath = path.join(options.outDir, "qa-state.json");
  writeFileSync(csvPath, toResultsCsv(active, merged));
  writeFileSync(
    statePath,
    `${JSON.stringify({ slug: options.slug, pulledAt: new Date().toISOString(), summary, entries: merged }, null, 2)}\n`,
  );

  const per = Object.entries(summary.perPerson)
    .filter(([, count]) => count > 0)
    .map(([person, count]) => `${person} ${count}`)
    .join(", ");
  console.log(
    `qa:pull: ${summary.recorded}/${summary.total} cases recorded (${per || "nobody yet"}) — ` +
      `${summary.pass} pass, ${summary.fail} fail, ${summary.blocked} blocked, ${summary.na} n/a` +
      (summary.noVerdict ? `, ${summary.noVerdict} noted without a verdict` : ""),
  );
  console.log(`  ${path.relative(repoRoot, csvPath)}`);
  console.log(`  ${path.relative(repoRoot, statePath)}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`qa:pull failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
