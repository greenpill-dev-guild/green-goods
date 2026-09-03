#!/usr/bin/env bun
/**
 * Pull a QA app session into the repo's session workspace.
 *
 * The QA app (packages/qa) is where testers record during a walk; this
 * brings that back as the artifacts `.claude/skills/qa-session/SKILL.md`
 * expects, so a session that ran in the browser closes out exactly like one
 * driven from the terminal.
 *
 *   bun run qa:pull [--slug 2026-09-02] [--out tmp/qa-session/<slug>] [--force]
 *
 * Reads the per-tester shards straight from the Blob store with
 * BLOB_READ_WRITE_TOKEN, NOT through the deployed app — so ingestion works
 * without an app session, and still works if the deploy is down.
 *
 * Results never enter git: everything lands under gitignored tmp/.
 */

import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog } from "./qa-workbook-build";
import { mergeShards, summarize, toResultsCsv, type Shard } from "./qa-state";
// @ts-expect-error -- plain JS helper shared with the env tooling
import { parseEnvFile } from "../lib/env-schema.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, "..", "..");
const privateOutputRoot = path.join(repoRoot, "tmp");

export interface Options {
  slug: string;
  outDir: string;
  force: boolean;
}

/** What a completed pull leaves behind, and therefore what a rerun would replace. */
const PULL_DATA_ARTIFACTS = ["results.csv", "qa-state.json"] as const;
export const PULL_IN_PROGRESS_ARTIFACT = ".qa-pull-in-progress";
export const SESSION_ARTIFACTS = [...PULL_DATA_ARTIFACTS] as const;
type PullArtifactContents = Record<(typeof PULL_DATA_ARTIFACTS)[number], string>;
const SHARD_STATUSES = new Set(["pass", "fail", "blocked", "na", ""]);
type BlobAccess = Pick<typeof import("@vercel/blob"), "get" | "list">;

const PRIVATE_OUTPUT_ERROR = "private QA output must resolve under the repo's gitignored tmp/ directory";

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/** Resolve symlinks in the nearest existing ancestor without requiring the final path to exist. */
function projectedPhysicalPath(candidate: string): string {
  const missing: string[] = [];
  let existing = candidate;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(PRIVATE_OUTPUT_ERROR);
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(realpathSync(existing), ...missing);
}

/** Follow directory links before trusting the private-output boundary. */
export function assertPrivateOutputPath(root: string, outDir: string): void {
  try {
    const privateRoot = path.join(root, "tmp");
    if (existsSync(privateRoot) && lstatSync(privateRoot).isSymbolicLink()) {
      throw new Error(PRIVATE_OUTPUT_ERROR);
    }
    const physicalRepoRoot = realpathSync(root);
    const physicalPrivateRoot = projectedPhysicalPath(privateRoot);
    const physicalOutDir = projectedPhysicalPath(outDir);
    if (!isWithin(physicalRepoRoot, physicalPrivateRoot) || !isWithin(physicalPrivateRoot, physicalOutDir)) {
      throw new Error(PRIVATE_OUTPUT_ERROR);
    }
  } catch {
    throw new Error(PRIVATE_OUTPUT_ERROR);
  }
}

/** Replace a private artifact atomically so an existing symlink or hard link is never followed. */
export function writePrivateFileAtomically(target: string, content: string): void {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, target);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Preserve the write failure below.
      }
    }
    try {
      unlinkSync(temporary);
    } catch {
      // The temporary file may never have been created.
    }
    throw new Error("private QA output must be a writable regular file under tmp/");
  }
}

/** Acquire the shared session marker without replacing another operation's marker. */
function acquirePrivateSessionMarker(target: string, content: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Preserve the acquisition failure below.
      }
    }
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("QA session artifacts are already locked for this destination");
    }
    throw new Error("QA session artifacts could not acquire their exclusive lock");
  }
}

interface ArtifactSetOperations {
  write: (target: string, content: string) => void;
  move: (source: string, target: string) => void;
  remove: (target: string) => void;
  exists: (target: string) => boolean;
  acquire?: (target: string, content: string) => void;
  read?: (target: string) => string;
}

export interface PrivateSessionLock {
  outDir: string;
  markerPath: string;
  markerContent: string;
}

function releasePrivateSessionMarker(
  markerPath: string,
  markerContent: string,
  operations: Pick<ArtifactSetOperations, "exists" | "remove"> & Required<Pick<ArtifactSetOperations, "read">>,
): void {
  if (!operations.exists(markerPath) || operations.read(markerPath) !== markerContent) {
    throw new Error("QA session lock ownership changed; leaving the marker in place");
  }
  operations.remove(markerPath);
}

/** Hold the same exclusive marker used by qa:pull for another session-artifact operation. */
export function acquirePrivateSessionLock(
  outDir: string,
  owner: "qa:pull" | "qa:report",
): PrivateSessionLock {
  const markerPath = path.join(outDir, PULL_IN_PROGRESS_ARTIFACT);
  const markerContent = `${owner}:${randomUUID()}\n`;
  acquirePrivateSessionMarker(markerPath, markerContent);
  return { outDir, markerPath, markerContent };
}

export function releasePrivateSessionLock(lock: PrivateSessionLock): void {
  releasePrivateSessionMarker(lock.markerPath, lock.markerContent, {
    exists: existsSync,
    read: (target) => readFileSync(target, "utf8"),
    remove: unlinkSync,
  });
}

class PrivateArtifactOverwriteError extends Error {}
class PrivateArtifactSetIncompleteError extends Error {}

function assertPrivateSessionLockOwnership(
  outDir: string,
  lock: PrivateSessionLock,
  operations: Pick<ArtifactSetOperations, "exists"> & Required<Pick<ArtifactSetOperations, "read">>,
  message: string,
): void {
  if (
    path.resolve(lock.outDir) !== path.resolve(outDir) ||
    lock.markerPath !== path.join(outDir, PULL_IN_PROGRESS_ARTIFACT) ||
    !operations.exists(lock.markerPath) ||
    operations.read(lock.markerPath) !== lock.markerContent
  ) {
    throw new Error(message);
  }
}

/**
 * Stage and commit both pulled artifacts as one recoverable replacement.
 *
 * POSIX cannot atomically rename two files together. The marker blocks readers
 * during the replacement. Both new files are fully staged before either current
 * artifact moves, and a failed commit restores the previous pair. The marker is
 * left behind only if rollback itself cannot restore a consistent directory.
 */
export function writePrivateArtifactSetAtomically(
  outDir: string,
  artifacts: PullArtifactContents,
  operations: ArtifactSetOperations = {
    write: writePrivateFileAtomically,
    move: renameSync,
    remove: unlinkSync,
    exists: existsSync,
  },
  replaceExisting = false,
  lock?: PrivateSessionLock,
): void {
  const generation = randomUUID();
  const markerPath = path.join(outDir, PULL_IN_PROGRESS_ARTIFACT);
  const paths = PULL_DATA_ARTIFACTS.map((name) => ({
    name,
    target: path.join(outDir, name),
    staged: path.join(outDir, `.${name}.${generation}.staged`),
    backup: path.join(outDir, `.${name}.${generation}.backup`),
  }));
  const backedUp: typeof paths = [];
  const committed: typeof paths = [];
  let rollbackFailed = false;
  let markerAcquired = false;
  let sessionLockHeld = false;
  const markerContent = lock?.markerContent ?? `${generation}\n`;
  const acquire = operations.acquire ?? acquirePrivateSessionMarker;
  const read = operations.read ?? ((target: string) => readFileSync(target, "utf8"));

  try {
    if (lock) {
      assertPrivateSessionLockOwnership(
        outDir,
        lock,
        { ...operations, read },
        "QA session lock ownership changed before committing the pulled artifacts",
      );
      sessionLockHeld = true;
    } else {
      acquire(markerPath, markerContent);
      markerAcquired = true;
      sessionLockHeld = true;
    }
    const conflicts = PULL_DATA_ARTIFACTS.filter((name) => operations.exists(path.join(outDir, name)));
    if (conflicts.length && !replaceExisting) {
      throw new PrivateArtifactOverwriteError(
        `Refusing to overwrite ${conflicts.join(" and ")} after acquiring the session lock; retry with --force only if that local copy is expendable`,
      );
    }
    for (const artifact of paths) {
      operations.write(artifact.staged, artifacts[artifact.name]);
    }
    for (const artifact of paths) {
      if (!operations.exists(artifact.target)) continue;
      operations.move(artifact.target, artifact.backup);
      backedUp.push(artifact);
    }
    for (const artifact of paths) {
      operations.move(artifact.staged, artifact.target);
      committed.push(artifact);
    }
  } catch (error) {
    if (!sessionLockHeld) throw error;
    for (const artifact of [...committed].reverse()) {
      try {
        if (operations.exists(artifact.target)) operations.remove(artifact.target);
      } catch {
        rollbackFailed = true;
      }
    }
    for (const artifact of [...backedUp].reverse()) {
      try {
        if (operations.exists(artifact.backup)) operations.move(artifact.backup, artifact.target);
      } catch {
        rollbackFailed = true;
      }
    }
    for (const artifact of paths) {
      try {
        if (operations.exists(artifact.staged)) operations.remove(artifact.staged);
      } catch {
        rollbackFailed = true;
      }
    }
    if (!rollbackFailed && markerAcquired) {
      try {
        releasePrivateSessionMarker(markerPath, markerContent, { ...operations, read });
      } catch {
        rollbackFailed = true;
      }
    }
    if (!rollbackFailed && error instanceof PrivateArtifactOverwriteError) throw error;
    if (rollbackFailed) {
      throw new PrivateArtifactSetIncompleteError(
        "private QA artifact set is incomplete; confirm no qa:pull process is active, repair the destination, and retry",
      );
    }
    throw new Error("private QA artifact set replacement failed; previous artifacts were restored");
  }

  for (const artifact of backedUp) {
    try {
      if (operations.exists(artifact.backup)) operations.remove(artifact.backup);
    } catch {
      // The committed pair is complete; a hidden backup can be cleaned on the next pull.
    }
  }
  if (markerAcquired) {
    try {
      releasePrivateSessionMarker(markerPath, markerContent, { ...operations, read });
    } catch (error) {
      if (error instanceof Error && /lock ownership changed/i.test(error.message)) throw error;
      throw new Error("private QA artifact set is complete but still marked in progress");
    }
  }
}

export function assertPullNotInProgress(
  outDir: string,
  exists: (target: string) => boolean = existsSync,
): void {
  if (exists(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))) {
    throw new Error(
      "incomplete qa:pull artifact set; confirm no qa:pull process is active before repairing the destination",
    );
  }
}

/** Re-read the pull after parsing so a concurrent replacement cannot mix generations. */
export function verifyPrivateArtifactSet(
  outDir: string,
  artifacts: Partial<PullArtifactContents>,
  operations: {
    exists: (target: string) => boolean;
    read: (target: string) => string;
  } = {
    exists: existsSync,
    read: (target) => readFileSync(target, "utf8"),
  },
  lock?: PrivateSessionLock,
): void {
  const assertReadable = () => {
    if (!lock) {
      assertPullNotInProgress(outDir, operations.exists);
      return;
    }
    assertPrivateSessionLockOwnership(
      outDir,
      lock,
      operations,
      "QA session lock ownership changed while reading the pulled artifacts",
    );
  };

  assertReadable();
  for (const name of PULL_DATA_ARTIFACTS) {
    const content = artifacts[name];
    if (content === undefined) continue;
    const target = path.join(outDir, name);
    if (!operations.exists(target) || operations.read(target) !== content) {
      throw new Error(`${name} changed while the qa:report snapshot was being read`);
    }
  }
  assertReadable();
}

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
  return [...SESSION_ARTIFACTS, PULL_IN_PROGRESS_ARTIFACT].filter((name) =>
    exists(path.join(outDir, name)),
  );
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
/**
 * Find the Blob token, from the process environment or the repo's own `.env`.
 *
 * Both commands promise "the repository root environment", and relying on the
 * runtime to autoload `.env` does not keep that promise — bun's autoload does
 * not fire in every shell these run from, which reads as "the token is not set"
 * when it is sitting in the file. Reading it explicitly makes the promise true.
 * The process environment still wins, so CI and one-off overrides behave.
 */
export function resolveBlobToken(env: NodeJS.ProcessEnv = process.env): string {
  const fromProcess = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (fromProcess) return fromProcess;
  const rootEnv = parseEnvFile(path.join(import.meta.dirname, "..", "..", ".env"));
  const fromFile = rootEnv?.BLOB_READ_WRITE_TOKEN?.trim();
  if (fromFile) return fromFile;
  throw new Error(
    "BLOB_READ_WRITE_TOKEN is not set — checked the process environment and the repo root .env. " +
      "Copy it from the QA app's Blob store in Vercel.",
  );
}

export function parseShard(pathname: string, text: string): Shard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${pathname} shard is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${pathname} shard is not an object`);
  }
  const shard = parsed as Partial<Shard>;
  // Ownership is the address in the path, not the display name inside — the
  // name is a label the tester may change, and changing it must not make their
  // own shard unreadable.
  const owner = pathname.split("/").pop()?.replace(/\.json$/, "").toLowerCase();
  if (!owner || !/^0x[0-9a-f]{40}$/.test(owner)) {
    throw new Error(`${pathname} is not keyed by an owner address`);
  }
  if (typeof shard.address !== "string" || !/^0x[0-9a-f]{40}$/.test(shard.address)) {
    throw new Error(`${pathname} shard has no lowercase owner address`);
  }
  if (shard.address !== owner) {
    throw new Error(`${pathname} reports its owner as ${JSON.stringify(shard.address)}`);
  }
  if (typeof shard.person !== "string" || shard.person !== shard.person.trim() || shard.person.length > 32) {
    throw new Error(`${pathname} shard has no valid display name`);
  }
  if (typeof shard.updatedAt !== "string" || !Number.isFinite(Date.parse(shard.updatedAt))) {
    throw new Error(`${pathname} shard has no valid update timestamp`);
  }
  if (!shard.entries || typeof shard.entries !== "object" || Array.isArray(shard.entries)) {
    throw new Error(`${pathname} shard has no entries object`);
  }
  for (const [caseId, entry] of Object.entries(shard.entries)) {
    if (
      !caseId ||
      caseId.length > 64 ||
      !entry ||
      typeof entry !== "object" ||
      typeof entry.s !== "string" ||
      !SHARD_STATUSES.has(entry.s) ||
      typeof entry.n !== "string" ||
      entry.n.length > 4000 ||
      typeof entry.at !== "string" ||
      !Number.isFinite(Date.parse(entry.at))
    ) {
      throw new Error(`${pathname} entry for ${caseId} is malformed`);
    }
  }
  return shard as Shard;
}

/**
 * Read one tester's shard. A missing shard is normal — it means that person has
 * not recorded anything — and must not fail the pull for everyone else.
 */
export async function readShard(
  pathname: string,
  token: string,
  access?: Pick<BlobAccess, "get">,
): Promise<Shard | null> {
  const get = access?.get ?? (await import("@vercel/blob")).get;
  let text: string;
  try {
    const result = await get(pathname, {
      access: "private",
      // Match the app: never read a cached copy of a live session.
      useCache: false,
      token,
    });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error(`unexpected status ${result.statusCode}`);
    }
    text = await new Response(result.stream).text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not.?found|404/i.test(message)) return null;
    throw new Error(`could not read ${pathname}: ${message}`);
  }
  // Deliberately outside the catch: a shape failure is not a transport failure,
  // and must never be mistaken for the absent-shard case handled above.
  return parseShard(pathname, text);
}

/**
 * Read every shard in the store.
 *
 * Enumerated rather than derived from a roster: shards are keyed by owner
 * address and the allowlist lives in the deployment's environment, not here.
 * Listing means these commands need no copy of who the testers are, and pick up
 * somebody added mid-season without a code change.
 */
export async function readShards(token: string, access?: BlobAccess): Promise<Array<Shard | null>> {
  const list = access?.list ?? (await import("@vercel/blob")).list;
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "qa/entries/", token, ...(cursor ? { cursor } : {}) });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const shards = blobs.filter((blob) => blob.pathname.endsWith(".json"));
  return Promise.all(shards.map((blob) => readShard(blob.pathname, token, access)));
}

export async function runPull(
  options: Options,
  deps: {
    repoRoot: string;
    token: string;
    loadCatalog: typeof loadCatalog;
    readShards: typeof readShards;
    now?: () => Date;
  },
): Promise<{
  csvPath: string;
  statePath: string;
  summary: ReturnType<typeof summarize>;
}> {
  assertPrivateOutputPath(deps.repoRoot, options.outDir);

  // Before the store fan-out, so a refused pull costs nothing and reads clearly.
  const clashes = existingArtifacts(options.outDir);
  if (clashes.includes(PULL_IN_PROGRESS_ARTIFACT)) {
    throw new Error(
      `${path.relative(deps.repoRoot, options.outDir)} is marked as an active or incomplete session operation. ` +
        "Confirm no qa:pull or qa:report process is using it, then remove the marker before retrying.",
    );
  }
  if (clashes.length && !options.force) {
    throw new Error(
      `${path.relative(deps.repoRoot, options.outDir)} already has ${clashes.join(" and ")}. ` +
        "Refusing to overwrite a pulled session — severity, redactions and hand-added rows " +
        "live only there. Pull to a fresh --out, or pass --force to replace it.",
    );
  }

  mkdirSync(options.outDir, { recursive: true });
  const csvPath = path.join(options.outDir, "results.csv");
  const statePath = path.join(options.outDir, "qa-state.json");
  const lock = acquirePrivateSessionLock(options.outDir, "qa:pull");
  let releaseLock = true;
  try {
    const catalog = await deps.loadCatalog();
    const active = catalog.cases.filter((testCase) => testCase.status !== "retired");
    const shards = await deps.readShards(deps.token);
    const merged = mergeShards(shards);
    const summary = summarize(active, merged);

    try {
      writePrivateArtifactSetAtomically(
        options.outDir,
        {
          "results.csv": toResultsCsv(active, merged),
          "qa-state.json": `${JSON.stringify({ slug: options.slug, pulledAt: (deps.now?.() ?? new Date()).toISOString(), summary, entries: merged }, null, 2)}\n`,
        },
        undefined,
        options.force,
        lock,
      );
    } catch (error) {
      if (error instanceof PrivateArtifactSetIncompleteError) releaseLock = false;
      throw error;
    }
    return { csvPath, statePath, summary };
  } finally {
    if (releaseLock) releasePrivateSessionLock(lock);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const token = resolveBlobToken();
  const { csvPath, statePath, summary } = await runPull(options, {
    repoRoot,
    token,
    loadCatalog,
    readShards,
  });

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
