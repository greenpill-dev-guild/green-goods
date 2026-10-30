import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANUAL_FORK_FILES, SHARD_ORDER, SHARDS } from "./fork-shards.mjs";

// TEST-QUALITY: allow-small-test-file - two structural guards keep every fork suite in a CI shard; more cases would restate them.
const contractsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function forkTestFiles(directory = join(contractsRoot, "test/fork")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return forkTestFiles(path);
    return entry.name.endsWith(".t.sol") ? [relative(contractsRoot, path)] : [];
  });
}

// Shard globs name files through a single brace group; expand exactly that form.
function shardFiles(glob: string): string[] {
  const match = glob.match(/^([^{}*?[]*)\{([^{}*?[]+)\}([^{}*?[]*)$/);
  if (match) return match[2].split(",").map((name) => `${match[1]}${name}${match[3]}`);
  if (/[{}*?[]/.test(glob)) throw new Error(`Unsupported shard glob: ${glob}`);
  return [glob];
}

describe("fork shard coverage", () => {
  it("assigns every fork test file to exactly one CI shard or a documented manual exemption", () => {
    const owners = new Map<string, string[]>();
    for (const shard of SHARD_ORDER) {
      for (const file of shardFiles(SHARDS[shard].glob)) owners.set(file, [...(owners.get(file) ?? []), shard]);
    }
    for (const file of Object.keys(MANUAL_FORK_FILES)) owners.set(file, [...(owners.get(file) ?? []), "manual"]);

    const files = forkTestFiles();
    const problems = files
      .filter((file) => owners.get(file)?.length !== 1)
      .map((file) => `${file}: ${owners.get(file)?.join(", ") ?? "unassigned"}`);
    problems.push(...[...owners.keys()].filter((file) => !files.includes(file)).map((file) => `${file}: missing file`));

    expect(problems).toEqual([]);
  });

  it("runs every ordered shard in the Contracts workflow", () => {
    const workflow = readFileSync(resolve(contractsRoot, "../../.github/workflows/contracts.yml"), "utf8");
    const scheduled = (shard: string) =>
      new RegExp(`^\\s*- shard: ${shard}\\s*$|test:shard run ${shard}\\s*$`, "m").test(workflow);

    expect(SHARD_ORDER.filter((shard) => !scheduled(shard))).toEqual([]);
  });
});
