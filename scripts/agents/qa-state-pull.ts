#!/usr/bin/env bun
/**
 * Pull a QA app session into the repo's session workspace.
 *
 * The QA app (packages/qa) is where Afo and Gui record during a walk; this
 * brings that back as the artifacts `.claude/skills/qa-session/SKILL.md`
 * expects, so a session that ran in the browser closes out exactly like one
 * driven from the terminal.
 *
 *   bun run qa:pull [--slug 2026-09-02] [--out tmp/qa-session/<slug>]
 *
 * Reads the per-tester shards straight from the Blob store with
 * BLOB_READ_WRITE_TOKEN, NOT through the deployed app — so ingestion works
 * while the app is password-protected, and still works if the deploy is down.
 *
 * Results never enter git: everything lands under gitignored tmp/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
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
}

export function parseArgs(argv: string[]): Options {
  let slug = new Date().toISOString().slice(0, 10);
  let outDir = "";
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag !== "--slug" && flag !== "--out") {
      throw new Error(`unknown argument '${flag}' — expected --slug or --out`);
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
  return { slug, outDir: resolvedOutDir };
}

/**
 * Read one tester's shard. A missing shard is normal — it means that person has
 * not recorded anything — and must not fail the pull for everyone else.
 */
async function readShard(person: string, token: string): Promise<Shard | null> {
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(`qa/entries/${person}.json`, {
      access: "private",
      // Match the app: never read a cached copy of a live session.
      useCache: false,
      token,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as Shard;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not.?found|404/i.test(message)) return null;
    throw new Error(`could not read ${person}'s shard: ${message}`);
  }
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
