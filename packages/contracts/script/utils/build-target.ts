/**
 * Build a specific Solidity file (or set of files) quickly.
 *
 * This exists to avoid raw `forge build <path>` usage in day-to-day work.
 *
 * Usage:
 *   bun run --cwd packages/contracts build --mode target -- src/registries/ENS.sol
 *   bun run --cwd packages/contracts build --mode target -- src/registries/ENS.sol src/tokens/Garden.sol
 *
 * Notes:
 * - Passing explicit PATHS makes Foundry compile only those sources + dependencies.
 * - This is *much* faster than compiling the entire `src/` tree on every change.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const contractsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const quiet = process.env.GG_CONTRACTS_BUILD_QUIET !== "0";

function log(msg: string) {
  console.log(`[build-target] ${msg}`);
}

function usage(): never {
  console.error("Usage: bun run --cwd packages/contracts build --mode target -- <solidity-path> [more-paths...]");
  process.exit(1);
}

function shouldSkipTest(paths: string[]): boolean {
  return !paths.some((p) => p.endsWith(".t.sol") || p.startsWith("test/"));
}

function shouldSkipScript(paths: string[]): boolean {
  return !paths.some((p) => p.endsWith(".s.sol") || p.startsWith("script/"));
}

export function targetBuildArguments(targets: string[], isQuiet = true): string[] {
  if (!targets.length || targets.some((target) => !target.endsWith(".sol") || target.startsWith("-"))) {
    throw new Error("Target build requires explicit Solidity paths");
  }
  const args: string[] = ["forge", "build"];
  if (isQuiet) args.push("-q");

  // Only skip if none of the targets are in those buckets (skip filters can exclude explicit paths).
  if (shouldSkipTest(targets)) args.push("--skip", "test");
  if (shouldSkipScript(targets)) args.push("--skip", "script");

  // --skip is variadic: terminate options before the target paths, otherwise Forge treats
  // every requested source as another skip filter and silently compiles something else.
  args.push("--", ...targets);
  return args;
}

async function runForgeBuild(targets: string[]): Promise<number> {
  const args = targetBuildArguments(targets, quiet);

  log(args.join(" "));
  const proc = Bun.spawn(args, {
    cwd: contractsDir,
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  return await proc.exited;
}

async function main() {
  const targets = Bun.argv.slice(2).filter(Boolean);
  if (targets.length === 0) usage();

  const exitCode = await runForgeBuild(targets);
  process.exit(exitCode);
}

if (import.meta.main) main();
