/**
 * Adaptive build script for contracts package.
 *
 * Selects fast or full forge build based on GG_CONTRACTS_BUILD_MODE env var.
 *
 * Modes:
 *   "fast"  — compiles `src` only (skips Foundry test/script Solidity)
 *   "full"  — compiles everything including tests (~180s cold)
 *   "auto"  — compiles changed Solidity targets (default), with safe broadening for shared source changes
 *
 * NOTE:
 * - This wrapper keeps deploy/CI realism in dedicated profiles (`production`, `ci`, `e2e`, `fork`).
 * - For local iteration, avoid full-project `forge build` unless explicitly requested via `full`.
 */

import { resolve } from "path";

const contractsDir = resolve(import.meta.dir, "../..");
const mode = (process.env.GG_CONTRACTS_BUILD_MODE ?? "auto") as "auto" | "fast" | "full";
const quiet = process.env.GG_CONTRACTS_BUILD_QUIET !== "0";
const CONTRACTS_PATH_PREFIX = "packages/contracts/";
const SHARED_SOURCE_PREFIXES = ["src/interfaces/", "src/lib/"] as const;

function log(msg: string) {
  console.log(`[adaptive-build] ${msg}`);
}

type BuildSkips = { skipTest: boolean; skipScript: boolean };
type BuildPlan = BuildSkips & { targets: string[] };
type ChangedTargets = { src: string[]; test: string[]; script: string[] };

function parseGitPorcelainPath(line: string): { status: string; path: string } | null {
  const trimmed = line.trimEnd();
  if (!trimmed) return null;
  if (trimmed.length < 4) return null;

  const status = trimmed.slice(0, 2);
  // "XY path" — path begins after 3 chars (two status chars + space)
  const rest = trimmed.slice(3).trim();
  if (!rest) return null;

  // Renames: "R  old -> new"
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

function planForFastMode(): BuildPlan {
  return {
    skipTest: true,
    skipScript: true,
    targets: ["src"],
  };
}

function planForAutoMode(changed: ChangedTargets): BuildPlan {
  const broadenSourceScope = hasSharedSourceChange(changed.src);
  const sourceTargets = broadenSourceScope ? ["src"] : changed.src;
  const targets = dedupeSorted([...sourceTargets, ...changed.script]);

  return {
    // Tests compile under `bun run test` / `forge test`, which use test/fork profiles.
    // Keep `build` focused on src + scripts to avoid profile-mismatch stack issues on fork suites.
    skipTest: true,
    skipScript: changed.script.length === 0,
    targets: targets.length === 0 ? ["src"] : targets,
  };
}

async function runForge(plan: BuildPlan): Promise<number> {
  const args: string[] = ["forge", "build"];
  if (quiet) args.push("-q");
  if (plan.skipTest) args.push("--skip", "test");
  if (plan.skipScript) args.push("--skip", "script");
  if (plan.targets.length > 0) args.push(...plan.targets);

  const profile = process.env.FOUNDRY_PROFILE ?? (!plan.skipTest ? "test" : undefined);
  if (profile) {
    log(`Using Foundry profile "${profile}"`);
  }

  const proc = Bun.spawn(args, {
    cwd: contractsDir,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      ...(profile ? { FOUNDRY_PROFILE: profile } : {}),
    },
  });
  return await proc.exited;
}

async function main() {
  let plan: BuildPlan;

  if (mode === "full") {
    log("Using full mode (explicit) — compiling all files including tests");
    plan = { skipTest: false, skipScript: false, targets: [] };
  } else if (mode === "fast") {
    plan = planForFastMode();
    log("Using fast mode (explicit) — compiling src only");
  } else {
    const changed = await getChangedTargets();
    plan = planForAutoMode(changed);
    const parts: string[] = [];
    parts.push(changed.test.length > 0 ? "skip test (validated via forge test profiles)" : "skip test");
    parts.push(plan.skipScript ? "skip script" : "include changed script Solidity");
    parts.push(`targets=${plan.targets.join(",")}`);
    log(`Using auto mode (${parts.join("; ")})`);
  }

  const exitCode = await runForge(plan);
  process.exit(exitCode);
}

main();
