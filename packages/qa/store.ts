/**
 * The Blob-facing half of the QA store, shared by the state and runs endpoints.
 *
 * Shards are keyed by the ADDRESS that owns them and by the run they belong
 * to. The allowlist grants an address the right to record; what that person is
 * called is theirs to declare and lives inside their own shard, so a rename
 * never orphans work and a name can never select which object gets written.
 *
 * Reads pass `useCache: false` deliberately. Private blob reads are served
 * through the CDN cache by default, and an overwrite can take up to 60 seconds
 * to propagate — which in a live two-person session reads as "the app lost my
 * partner's entry". Correctness beats the cache here; the payloads are small.
 */

import { randomUUID } from "node:crypto";

import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";

import {
  FIRST_RUN_ID,
  RUN_INDEX_PATH,
  type RunIndex,
  initialIndex,
  legacyRunRecord,
  legacyShardPath,
  runIndexShapeError,
  runShardPath,
} from "./runs.js";

export type Address = string;

/** How long a name may be. Long enough for a name, short enough for a column. */
const MAX_NAME_LENGTH = 32;

/** One tester's verdict and notes on one case. */
export interface Entry {
  /** "pass" | "fail" | "blocked" | "na", or "" while only a note exists. */
  s: string;
  /** Free-text note. */
  n: string;
  /** ISO timestamp stamped by this server when the write landed. */
  at: string;
}

export interface Shard {
  /** Lowercase owner address. The identity; never taken from a request body. */
  address: Address;
  /** Self-declared display name. Empty until the tester sets one. */
  person: string;
  updatedAt: string;
  entries: Record<string, Entry>;
}

export const STATUSES = new Set(["pass", "fail", "blocked", "na", ""]);
export const MAX_NOTE_LENGTH = 4000;

/**
 * An error whose message is safe to return to the caller.
 *
 * A store error's own message can carry a token, a store id, or a stack, and
 * these endpoints are reachable by every allowlisted tester. The detail goes
 * to the server log; the caller gets the sentence that tells a tester what
 * happened to their work.
 */
export class StoreError extends Error {
  readonly detail: unknown;

  constructor(message: string, detail: unknown) {
    super(message);
    this.name = "StoreError";
    this.detail = detail;
  }
}

/** A name is a label, so the only rules are "present" and "fits a column". */
export function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
}

/** What to call a tester who has not named themselves yet. */
export function fallbackName(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Never let a proxy or browser serve a stale session between polls.
      "Cache-Control": "private, no-store",
    },
  });
}

export function fail(error: unknown, fallback: string, scope = "qa/state"): Response {
  const safe = error instanceof StoreError ? error.message : fallback;
  console.error(`${scope}: ${safe}`, error instanceof StoreError ? error.detail : error);
  return json({ error: safe }, 503);
}

/**
 * Why a parsed shard is not one, or null when it is fine.
 *
 * Checking only for a truthy `entries` let a malformed entry through, and GET
 * hands whatever it read straight to the page — which reads `e.s` off it and
 * takes the checklist down mid-session for everyone. A shard this store
 * cannot vouch for is a 503, the same answer an unreadable one gets: refusing
 * the read is recoverable, serving corrupt state to a live session is not.
 */
export function shardShapeError(address: string, parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "shard is not an object";
  }
  const shard = parsed as Partial<Shard>;
  // Ownership is the address. A mismatch means this object is not what its
  // path claims, which is the one case where refusing beats merging.
  if (typeof shard.address !== "string" || shard.address.toLowerCase() !== address.toLowerCase()) {
    return `shard reports its owner as ${JSON.stringify(shard.address ?? null)}`;
  }
  if (!/^0x[0-9a-f]{40}$/.test(shard.address)) return "shard owner is not a lowercase address";
  if (typeof shard.person !== "string" || cleanName(shard.person) !== shard.person) {
    return "shard has no valid display name";
  }
  if (typeof shard.updatedAt !== "string" || !Number.isFinite(Date.parse(shard.updatedAt))) {
    return "shard has no valid update timestamp";
  }
  if (!shard.entries || typeof shard.entries !== "object" || Array.isArray(shard.entries)) {
    return "shard has no entries object";
  }
  for (const [caseId, entry] of Object.entries(shard.entries)) {
    if (!caseId || caseId.length > 64) return "shard has an invalid case id";
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return `entry ${caseId} is not an object`;
    const candidate = entry as Partial<Entry>;
    if (typeof candidate.s !== "string" || !STATUSES.has(candidate.s)) return `entry ${caseId} has no valid status`;
    if (typeof candidate.n !== "string" || candidate.n.length > MAX_NOTE_LENGTH) return `entry ${caseId} has no valid note`;
    if (typeof candidate.at !== "string" || !Number.isFinite(Date.parse(candidate.at))) {
      return `entry ${caseId} has no valid timestamp`;
    }
  }
  return null;
}

/**
 * Read one private JSON object with the ETag needed to write it back safely.
 *
 * The distinction between ABSENT and UNREADABLE is load-bearing, not
 * defensive style. Absent is normal — nothing recorded there yet — and merging
 * onto an empty base is exactly right. Unreadable is a transient store error,
 * and treating it as "nothing there" would merge onto an empty base and
 * silently erase what was recorded. So an unreadable object throws, and the
 * caller refuses the write instead.
 */
export async function readText(pathname: string, unreadable: string): Promise<{ text: string; etag: string } | null> {
  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(pathname, { access: "private", useCache: false });
  } catch (error) {
    throw new StoreError(unreadable, error);
  }
  // `get` resolves null when the blob does not exist yet.
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new StoreError(unreadable, `unexpected status ${result.statusCode}`);
  }
  // The SDK reports the ETag on the blob metadata, not on the result itself.
  // Reading it from the wrong place silently turned every conditional write
  // into an unconditional one, which is the failure the ETag exists to stop.
  const etag = (result as { blob?: { etag?: string }; etag?: string }).blob?.etag ?? (result as { etag?: string }).etag;
  if (!etag) throw new StoreError(unreadable, "the store returned no ETag");
  return { text: await new Response(result.stream).text(), etag };
}

/**
 * Read one tester's shard in one run, or their legacy shard when `runId` is
 * null. The raw text comes back too, so a migration can copy it byte for byte.
 */
export async function readShard(
  address: Address,
  runId: string | null,
): Promise<{ shard: Shard; etag: string; text: string } | null> {
  const pathname = runId === null ? legacyShardPath(address) : runShardPath(runId, address);
  const read = await readText(pathname, `${fallbackName(address)}'s entries could not be read`);
  if (!read) return null;
  let parsed: Shard;
  try {
    parsed = JSON.parse(read.text) as Shard;
  } catch (error) {
    throw new StoreError(`${fallbackName(address)}'s entries are unreadable and were not overwritten`, error);
  }
  const invalid = shardShapeError(address, parsed);
  if (invalid) {
    throw new StoreError(`${fallbackName(address)}'s entries are unreadable and were not overwritten`, invalid);
  }
  return { shard: parsed, etag: read.etag, text: read.text };
}

const JSON_WRITE = {
  access: "private",
  contentType: "application/json",
  // A stable pathname per object is the whole point — a random suffix would
  // mint a new object per save and orphan the last one.
  addRandomSuffix: false,
  // No cacheControlMaxAge. Freshness is a READ-side guarantee: every `get`
  // passes `useCache: false`. The store's documented floor is 60s, and a
  // rejected write is a lost verdict, so the option is never set.
} as const;

/**
 * Create an object that must not exist yet.
 *
 * Blob's create-only write is the serialization point, exactly as it is for
 * sign-in nonces: one concurrent request creates the object, every later one
 * finds it. A create conflict surfaces as a generic error, so a failed write
 * is confirmed by reading the path back — "exists" is the only outcome that
 * lets the caller continue; anything else fails closed.
 */
export async function putCreateOnly(pathname: string, body: string): Promise<"created" | "exists"> {
  try {
    await put(pathname, body, { ...JSON_WRITE, allowOverwrite: false });
    return "created";
  } catch (writeError) {
    let existing: Awaited<ReturnType<typeof get>>;
    try {
      existing = await get(pathname, { access: "private", useCache: false });
    } catch (readError) {
      throw new StoreError(`${pathname} could not be created`, readError);
    }
    if (existing?.statusCode === 200) return "exists";
    throw new StoreError(`${pathname} could not be created`, writeError);
  }
}

/**
 * Overwrite an object only if it is still what the caller read.
 *
 * A losing write throws `BlobPreconditionFailedError` unchanged so the caller
 * can decide whether to merge and retry (a shard) or refuse and let a human
 * look again (the run index).
 */
export async function putConditional(pathname: string, body: string, etag: string): Promise<void> {
  try {
    await put(pathname, body, { ...JSON_WRITE, allowOverwrite: true, ifMatch: etag });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw error;
    throw new StoreError(`${pathname} could not be saved`, error);
  }
}

/**
 * Put a shard back the way it was before a write that turned out to target a
 * run that had just closed. With no earlier shard the write created one, and
 * an empty shard carrying the name is what a rollover would have left there.
 */
export async function restoreShard(address: Address, runId: string, previous: { text: string } | null): Promise<void> {
  const current = await readShard(address, runId);
  if (!current) return;
  const body = previous
    ? previous.text
    : JSON.stringify({ address: address.toLowerCase(), person: current.shard.person, updatedAt: new Date().toISOString(), entries: {} });
  await putConditional(runShardPath(runId, address), body, current.etag);
}

export async function readRunIndex(): Promise<{ index: RunIndex; etag: string } | null> {
  const read = await readText(RUN_INDEX_PATH, "the run index could not be read");
  if (!read) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch (error) {
    throw new StoreError("the run index is unreadable and was not overwritten", error);
  }
  const invalid = runIndexShapeError(parsed);
  if (invalid) throw new StoreError("the run index is unreadable and was not overwritten", invalid);
  return { index: parsed as RunIndex, etag: read.etag };
}

/**
 * The run index, migrating the legacy store into Run 1 on first contact.
 *
 * Before runs existed every tester owned one shard at `qa/entries/`. The first
 * authenticated request after the deploy copies each of those shards byte for
 * byte into Run 1 and creates the index with Run 1 open as the legacy
 * baseline. Every copy and the index itself are create-only, so concurrent
 * first requests cannot clobber each other, a crash halfway is finished by the
 * next request, and running it again changes nothing. The legacy shards are
 * never written or deleted afterwards, which keeps the migration reversible.
 * Only a null read migrates: an unreadable index is a 503, never a reason to
 * start over.
 */
export async function ensureRunIndex(
  allowlist: string[],
  now: () => string = () => new Date().toISOString(),
): Promise<{ index: RunIndex; etag: string }> {
  const existing = await readRunIndex();
  if (existing) return existing;

  const shards = await Promise.all(
    allowlist.map(async (address) => {
      const legacy = await readShard(address, null);
      if (legacy) await putCreateOnly(runShardPath(FIRST_RUN_ID, address), legacy.text);
      return legacy?.shard ?? null;
    }),
  );
  const stamp = now();
  await putCreateOnly(RUN_INDEX_PATH, JSON.stringify(initialIndex(legacyRunRecord(shards, stamp), stamp)));
  const created = await readRunIndex();
  if (!created) throw new StoreError("the run index could not be created", "index absent after create");
  return created;
}

/**
 * The store lock: one lease that every save and every rollover takes before
 * reading the run index and writing.
 *
 * Sharding keeps testers from clobbering each other, and ETags keep one
 * tester's two clients from clobbering themselves, but neither orders a save
 * against a rollover: a save could validate its run against an index read
 * moments before a teammate closed that run, then write into the closed
 * shard. Blob has no transaction, so the serialization point is a create-only
 * object: whoever creates `qa/lock.json` holds the store until they delete it.
 * The lease carries an expiry so a function that died mid-save cannot wedge
 * the store; a caller that finds an expired lease takes it over with a
 * conditional overwrite, and a holder whose own lease ran out never deletes
 * what may already be someone else's. Contention is a few polls, then a 503
 * the page answers by keeping its outbox and retrying.
 */
export const STORE_LOCK_PATH = "qa/lock.json";

export interface StoreLock {
  token: string;
  expiresAt: number;
}

export interface StoreLockOptions {
  /** How long one lease lasts. Longer than any save, far shorter than a session. */
  ttlMs?: number;
  /** How long to wait between polls of a held lease. */
  retryMs?: number;
  /** How many polls before giving up with "busy". */
  attempts?: number;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseLock(text: string): StoreLock | null {
  try {
    const parsed = JSON.parse(text) as Partial<StoreLock>;
    if (typeof parsed?.token !== "string" || typeof parsed.expiresAt !== "number") return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export async function acquireStoreLock(options: StoreLockOptions = {}): Promise<StoreLock> {
  const ttlMs = options.ttlMs ?? envNumber("QA_STORE_LOCK_TTL_MS", 8_000);
  const retryMs = options.retryMs ?? envNumber("QA_STORE_LOCK_RETRY_MS", 120);
  const attempts = Math.max(1, options.attempts ?? envNumber("QA_STORE_LOCK_ATTEMPTS", 40));
  const token = randomUUID();
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const lease: StoreLock = { token, expiresAt: Date.now() + ttlMs };
    const body = JSON.stringify(lease);
    let outcome: "created" | "exists";
    try {
      outcome = await putCreateOnly(STORE_LOCK_PATH, body);
    } catch (error) {
      // A create that failed and could not be confirmed as "exists" is most
      // often a lease deleted between the two calls. Poll again rather than
      // failing a save on it; a real outage still ends in the busy answer.
      console.error("qa/store: lock create could not be confirmed", error);
      outcome = "exists";
    }
    if (outcome === "created") return lease;
    const held = await readText(STORE_LOCK_PATH, "the store lock could not be read");
    if (held) {
      const current = parseLock(held.text);
      if (!current || current.expiresAt <= Date.now()) {
        // The holder died or overran its lease. Take it over conditionally so
        // two waiters cannot both believe they did.
        try {
          await putConditional(STORE_LOCK_PATH, body, held.etag);
          return lease;
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError)) throw error;
        }
      }
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
  throw new StoreError("the store is busy saving elsewhere — try again", "lock contention");
}

export async function releaseStoreLock(lock: StoreLock): Promise<void> {
  // A lease that ran out may already be somebody else's; only a live holder deletes.
  if (lock.expiresAt <= Date.now()) return;
  try {
    const held = await readText(STORE_LOCK_PATH, "the store lock could not be read");
    if (!held || parseLock(held.text)?.token !== lock.token) return;
    await del(STORE_LOCK_PATH);
  } catch (error) {
    // Nothing to do for the caller: the lease expires on its own.
    console.error("qa/store: the store lock could not be released", error);
  }
}

/** Run one unit of store work under the lease, releasing it however the work ends. */
export async function withStoreLock<T>(work: () => Promise<T>, options?: StoreLockOptions): Promise<T> {
  const lock = await acquireStoreLock(options);
  try {
    return await work();
  } finally {
    await releaseStoreLock(lock);
  }
}
