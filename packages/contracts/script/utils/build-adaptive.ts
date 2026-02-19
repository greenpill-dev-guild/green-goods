/**
 * Adaptive build script for contracts package.
 *
 * Selects fast or full forge build based on GG_CONTRACTS_BUILD_MODE env var.
 *
 * Modes:
 *   "fast"  — skips test & script dirs (source contracts only, ~2s cached / ~75s cold)
 *   "full"  — compiles everything including tests (~180s cold)
 *   "auto"  — checks git status to decide (default): if test/script files changed → full, else fast
 *
 * NOTE: default profile uses selective via_ir via foundry.toml
 * compilation_restrictions (not global via_ir=true).
 * Speed primarily comes from --skip test/script, sparse_mode, and
 * profile-separated Foundry caches/artifacts.
 */

import { resolve } from "path";

const contractsDir = resolve(import.meta.dir, "../..");
const mode = (process.env.GG_CONTRACTS_BUILD_MODE ?? "auto") as "auto" | "fast" | "full";

function log(msg: string) {
  console.log(`[adaptive-build] ${msg}`);
}

async function testOrScriptChanged(): Promise<boolean> {
  const proc = Bun.spawn(["git", "status", "--porcelain", "--", "test", "script"], {
    cwd: contractsDir,
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.trim().length > 0;
}

async function runForge(skipTestScript: boolean): Promise<number> {
  const args = skipTestScript ? ["forge", "build", "--skip", "test", "--skip", "script"] : ["forge", "build"];

  const proc = Bun.spawn(args, { cwd: contractsDir, stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

async function main() {
  let skipTestScript: boolean;

  if (mode === "full") {
    log("Using full mode (explicit) — compiling all files including tests");
    skipTestScript = false;
  } else if (mode === "fast") {
    log("Using fast mode (explicit) — skipping test & script compilation");
    skipTestScript = true;
  } else {
    const needsFull = await testOrScriptChanged();
    skipTestScript = !needsFull;
    log(
      skipTestScript
        ? "Using fast mode (no test/script changes detected)"
        : "Using full mode (test or script changes detected)",
    );
  }

  const exitCode = await runForge(skipTestScript);
  process.exit(exitCode);
}

main();
