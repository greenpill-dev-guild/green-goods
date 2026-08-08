/**
 * EIP-170 deployed-bytecode size gate.
 *
 * Builds the production profile (the profile `upgrade.ts` and mainnet deploys use:
 * via_ir, optimizer_runs = 1 — the smallest bytecode we can ship) and fails when any
 * concrete deployable contract exceeds the 24,576-byte deployed-code limit that
 * Arbitrum and every Ethereum-equivalent chain enforce. Foundry's test EVM does NOT
 * enforce the limit, so a green test suite says nothing about deployability — this
 * gate is the only guard.
 *
 * Scope: contracts and external libraries whose compilationTarget lives under `src/`,
 * excluding `src/vendor/` (upstream code deployed by its own factories), `src/mocks/`,
 * and `src/interfaces/`. Abstract contracts and interfaces have empty deployed
 * bytecode and fall out naturally. External libraries are checked because each one is
 * its own deployment with its own 24,576-byte budget.
 *
 * Usage:
 *   bun run check:sizes                # build production profile, then check
 *   bun run check:sizes -- --skip-build  # reuse existing production artifacts
 *
 * NOTE: never pass an explicit source path to the production build — under
 * FOUNDRY_PROFILE=production, `forge build <path> --skip test --skip script` has been
 * observed to silently skip compiling the named target itself. Build the whole tree.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const CONTRACTS_ROOT = resolve(import.meta.dir, "../..");
const PROFILE = process.env.GG_SIZE_GATE_PROFILE ?? "production";
const OUT_DIR = join(CONTRACTS_ROOT, ".generated/foundry/out", PROFILE);
const EIP170_LIMIT = 24_576;
const WARN_RATIO = 0.9;

const EXCLUDED_PREFIXES = ["src/vendor/", "src/mocks/", "src/interfaces/"];

/**
 * Known-oversize contracts allowed to pass the gate while their restructuring is in
 * flight. Every entry is a RELEASE BLOCKER: the contract cannot be broadcast to a
 * real network until its entry is removed. Keep this list empty.
 */
const RELEASE_BLOCKER_ALLOWLIST: Record<string, { maxBytes: number; reason: string }> = {};

interface SizeRow {
  name: string;
  source: string;
  bytes: number;
}

function log(msg: string) {
  console.log(`[check-contract-sizes] ${msg}`);
}

async function buildProduction(): Promise<void> {
  const args = ["forge", "build", "--skip", "test", "--skip", "script", "-q"];
  log(`FOUNDRY_PROFILE=${PROFILE} ${args.join(" ")}`);
  const proc = Bun.spawn(args, {
    cwd: CONTRACTS_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, FOUNDRY_PROFILE: PROFILE },
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    log(`forge build failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }
}

function collectArtifacts(): SizeRow[] {
  const rows: SizeRow[] = [];
  const sourceDirs = readdirSync(OUT_DIR).filter((entry) => {
    if (entry === "build-info") return false;
    return statSync(join(OUT_DIR, entry)).isDirectory();
  });

  for (const sourceDir of sourceDirs) {
    const dirPath = join(OUT_DIR, sourceDir);
    const artifactFiles = readdirSync(dirPath).filter(
      (file) => file.endsWith(".json") && !file.endsWith(".abi.json") && !file.endsWith(".metadata.json"),
    );
    for (const file of artifactFiles) {
      const artifact = JSON.parse(readFileSync(join(dirPath, file), "utf8"));
      const target: Record<string, string> | undefined = artifact.metadata?.settings?.compilationTarget;
      const deployed: string | undefined = artifact.deployedBytecode?.object;
      if (!target || !deployed || deployed === "0x") continue;

      const [sourcePath, contractName] = Object.entries(target)[0] ?? [];
      if (!sourcePath || !contractName) continue;
      if (!sourcePath.startsWith("src/")) continue;
      if (EXCLUDED_PREFIXES.some((prefix) => sourcePath.startsWith(prefix))) continue;

      // Unlinked library placeholders (`__$…$__`) are 40 hex chars — exactly the 20
      // bytes the address occupies after linking, so the length math stays exact.
      rows.push({ name: contractName, source: sourcePath, bytes: (deployed.length - 2) / 2 });
    }
  }
  return rows.sort((a, b) => b.bytes - a.bytes);
}

function formatRow(row: SizeRow, status: string): string {
  const margin = EIP170_LIMIT - row.bytes;
  return `${status.padEnd(6)} ${String(row.bytes).padStart(6)} bytes  margin ${String(margin).padStart(7)}  ${row.name} (${row.source})`;
}

/** Newest mtime (ms) of any file under `dir` whose name passes `keep`. */
function newestMtimeMs(dir: string, keep: (name: string) => boolean): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtimeMs(entryPath, keep));
    } else if (keep(entry.name)) {
      newest = Math.max(newest, statSync(entryPath).mtimeMs);
    }
  }
  return newest;
}

/**
 * `--skip-build` must not accept artifacts that predate the sources: an edited
 * or newly added contract would then be measured stale or not at all, and the
 * gate would pass on a set that no longer describes the tree. Branch switches
 * refresh source mtimes, so this fails toward "rebuild", never toward a
 * false green.
 */
function assertArtifactsCoverSources(): void {
  const newestSource = newestMtimeMs(join(CONTRACTS_ROOT, "src"), (name) => name.endsWith(".sol"));
  const newestArtifact = newestMtimeMs(OUT_DIR, (name) => name.endsWith(".json"));
  if (newestSource > newestArtifact) {
    log(
      `--skip-build refused: a source under src/ is newer than every artifact under ${OUT_DIR} — ` +
        `rerun without --skip-build so the production build covers the current tree.`,
    );
    process.exit(1);
  }
}

async function main() {
  if (process.argv.includes("--skip-build")) {
    assertArtifactsCoverSources();
  } else {
    await buildProduction();
  }

  const rows = collectArtifacts();
  if (rows.length === 0) {
    log(`no deployable artifacts found under ${OUT_DIR} — did the build run?`);
    process.exit(1);
  }

  const failures: SizeRow[] = [];
  const allowed: SizeRow[] = [];
  log(`deployed bytecode vs EIP-170 limit (${EIP170_LIMIT} bytes), profile "${PROFILE}":`);
  for (const row of rows) {
    const allowEntry = RELEASE_BLOCKER_ALLOWLIST[row.name];
    if (row.bytes > EIP170_LIMIT) {
      if (allowEntry && row.bytes <= allowEntry.maxBytes) {
        allowed.push(row);
        console.log(formatRow(row, "ALLOW"));
      } else {
        failures.push(row);
        console.log(formatRow(row, "FAIL"));
      }
    } else if (row.bytes > EIP170_LIMIT * WARN_RATIO) {
      console.log(formatRow(row, "WARN"));
    } else {
      console.log(formatRow(row, "ok"));
    }
  }

  for (const row of allowed) {
    log(
      `RELEASE BLOCKER: ${row.name} is allowlisted at ${row.bytes} bytes — ` +
        `${RELEASE_BLOCKER_ALLOWLIST[row.name].reason}. It cannot be deployed until this entry is removed.`,
    );
  }

  if (failures.length > 0) {
    log(
      `${failures.length} contract(s) exceed the EIP-170 deployed-code limit and cannot be deployed ` +
        `to Arbitrum or any Ethereum-equivalent chain. Move behavior into external deployed libraries ` +
        `(see src/lib/pooling/) or reduce scope.`,
    );
    process.exit(1);
  }
  log("all deployable contracts fit under the EIP-170 limit.");
}

main();
