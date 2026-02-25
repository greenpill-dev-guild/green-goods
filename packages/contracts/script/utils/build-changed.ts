/**
 * Build only changed Solidity sources for fast iteration.
 *
 * Why:
 * - `forge build` over the entire project can take ~60–90s on *any* .sol change.
 * - `forge build <path>` compiles only that file + dependencies and is often ~2–5s.
 *
 * This script finds changed Solidity sources in `src/`, `test/`, and `script/`
 * and passes them as explicit PATHS to `forge build`.
 *
 * Caveat:
 * - If you change a shared interface/library, building only that file may not compile
 *   every dependent. Use `bun run build` (or `bun run test`) before merging/deploying.
 */

import { resolve } from "path";

const contractsDir = resolve(import.meta.dir, "../..");
const quiet = process.env.GG_CONTRACTS_BUILD_QUIET !== "0";
const CONTRACTS_PATH_PREFIX = "packages/contracts/";
const SHARED_SOURCE_PREFIXES = ["src/interfaces/", "src/lib/"] as const;

function log(msg: string) {
  console.log(`[build-changed] ${msg}`);
}

function parseGitPorcelainPath(line: string): { status: string; path: string } | null {
  const trimmed = line.trimEnd();
  if (!trimmed) return null;
  if (trimmed.length < 4) return null;

  const status = trimmed.slice(0, 2);
  const rest = trimmed.slice(3).trim();
  if (!rest) return null;

  const arrowIndex = rest.lastIndexOf("->");
  const path = arrowIndex === -1 ? rest : rest.slice(arrowIndex + 2).trim();
  return { status, path };
}

function normalizeContractsPath(path: string): string {
  if (path.startsWith(CONTRACTS_PATH_PREFIX)) {
    return path.slice(CONTRACTS_PATH_PREFIX.length);
  }
  return path;
}

type ChangedTargets = { src: string[]; test: string[]; script: string[] };

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function hasSharedSourceChange(srcTargets: string[]): boolean {
  return srcTargets.some((path) => SHARED_SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix)));
}

async function getChangedTargets(): Promise<ChangedTargets> {
  const proc = Bun.spawn(["git", "status", "--porcelain"], {
    cwd: contractsDir,
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const src: string[] = [];
  const test: string[] = [];
  const script: string[] = [];

  for (const line of output.split("\n")) {
    const parsed = parseGitPorcelainPath(line);
    if (!parsed) continue;
    if (parsed.status.includes("D")) continue;

    const p = normalizeContractsPath(parsed.path);
    if (p.startsWith("src/") && p.endsWith(".sol")) src.push(p);
    if (p.startsWith("test/") && p.endsWith(".sol")) test.push(p);
    if (p.startsWith("script/") && p.endsWith(".sol")) script.push(p);
  }

  return {
    src: dedupeSorted(src),
    test: dedupeSorted(test),
    script: dedupeSorted(script),
  };
}

async function runForgeBuild(targets: ChangedTargets): Promise<number> {
  const args: string[] = ["forge", "build"];
  if (quiet) args.push("-q");

  if (targets.test.length === 0) args.push("--skip", "test");
  if (targets.script.length === 0) args.push("--skip", "script");

  const sourceTargets = hasSharedSourceChange(targets.src) ? ["src"] : targets.src;
  const explicitTargets = dedupeSorted([...sourceTargets, ...targets.test, ...targets.script]);
  args.push(...(explicitTargets.length > 0 ? explicitTargets : ["src"]));

  log(args.join(" "));
  const proc = Bun.spawn(args, { cwd: contractsDir, stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

async function main() {
  const targets = await getChangedTargets();

  const count = targets.src.length + targets.test.length + targets.script.length;
  if (count === 0) {
    log("No changed Solidity targets in src/test/script — running src-only cached build");
  } else {
    log(
      `Building changed Solidity targets (src=${targets.src.length}, test=${targets.test.length}, script=${targets.script.length})`,
    );
  }

  const exitCode = await runForgeBuild(targets);
  process.exit(exitCode);
}

main();
