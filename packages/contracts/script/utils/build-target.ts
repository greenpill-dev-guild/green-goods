/**
 * Build a specific Solidity file (or set of files) quickly.
 *
 * This exists to avoid raw `forge build <path>` usage in day-to-day work.
 *
 * Usage:
 *   bun run build:target -- src/registries/ENS.sol
 *   bun run build:target -- src/registries/ENS.sol src/tokens/Garden.sol
 *
 * Notes:
 * - Passing explicit PATHS makes Foundry compile only those sources + dependencies.
 * - This is *much* faster than compiling the entire `src/` tree on every change.
 */

import { resolve } from "path";

const contractsDir = resolve(import.meta.dir, "../..");
const quiet = process.env.GG_CONTRACTS_BUILD_QUIET !== "0";

function log(msg: string) {
  console.log(`[build-target] ${msg}`);
}

function usage(): never {
  console.error("Usage: bun run build:target -- <solidity-path> [more-paths...]");
  process.exit(1);
}

function shouldSkipTest(paths: string[]): boolean {
  return !paths.some((p) => p.endsWith(".t.sol") || p.startsWith("test/"));
}

function shouldSkipScript(paths: string[]): boolean {
  return !paths.some((p) => p.endsWith(".s.sol") || p.startsWith("script/"));
}

async function runForgeBuild(targets: string[]): Promise<number> {
  const args: string[] = ["forge", "build"];
  if (quiet) args.push("-q");

  // Only skip if none of the targets are in those buckets (skip filters can exclude explicit paths).
  if (shouldSkipTest(targets)) args.push("--skip", "test");
  if (shouldSkipScript(targets)) args.push("--skip", "script");

  args.push(...targets);

  log(args.join(" "));
  const proc = Bun.spawn(args, { cwd: contractsDir, stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

async function main() {
  const targets = Bun.argv.slice(2).filter(Boolean);
  if (targets.length === 0) usage();

  const exitCode = await runForgeBuild(targets);
  process.exit(exitCode);
}

main();
