/**
 * QA session state — sharded by writer.
 *
 * Each tester owns exactly one blob (`qa/entries/<person>.json`) and only ever
 * writes that one. Two people recording the same case at the same moment touch
 * DIFFERENT objects, so there is no cross-tester conflict to resolve and no way
 * for one tester's verdict or notes to overwrite another's. GET fans out over
 * the roster and merges.
 *
 * Sharding removes conflicts BETWEEN testers. It does not remove them within
 * one tester: a save is read-modify-write, and the documented workflow has one
 * person running two clients (a phone on the PWA, a laptop on admin). Two of
 * their saves overlapping would otherwise let the second read a pre-first shard
 * and write the first's entries away. So each write is conditional on the ETag
 * that was read, and a losing write re-reads and re-merges instead of retrying
 * blind.
 *
 * The roster is fixed and served from here so the page never invents a writer:
 * an unknown `person` is rejected rather than silently creating a shard.
 *
 * Reads pass `useCache: false` deliberately. Private blob reads are served
 * through the CDN cache by default, and an overwrite can take up to 60 seconds
 * to propagate — which in a live two-person session reads as "the app lost my
 * partner's entry". Correctness beats the cache here; the payload is small.
 */

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

export const TEAM = ["Afo", "Nansel", "Gui"] as const;
type Person = (typeof TEAM)[number];

/** One tester's verdict and notes on one case. */
interface Entry {
  /** "pass" | "fail" | "blocked" | "na", or "" while only a note exists. */
  s: string;
  /** Free-text note. */
  n: string;
  /** ISO timestamp stamped by this server when the write landed. */
  at: string;
}

interface Shard {
  person: Person;
  updatedAt: string;
  entries: Record<string, Entry>;
}

const STATUSES = new Set(["pass", "fail", "blocked", "na", ""]);
/** One save is a delta, not a whole shard — this bound is generous on purpose. */
const MAX_BODY_BYTES = 512 * 1024;
const MAX_NOTE_LENGTH = 4000;
/** Attempts per save. Contention is two clients of one person, not a thundering herd. */
const MAX_WRITE_ATTEMPTS = 4;

function shardPath(person: Person): string {
  return `qa/entries/${person}.json`;
}

function isPerson(value: unknown): value is Person {
  return typeof value === "string" && (TEAM as readonly string[]).includes(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Never let a proxy or browser serve a stale session between polls.
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * An error whose message is safe to return to the caller.
 *
 * A store error's own message can carry a token, a store id, or a stack, and
 * this endpoint is reachable by anyone holding the deployment password. The
 * detail goes to the server log; the caller gets the sentence that tells a
 * tester what happened to their work.
 */
class StoreError extends Error {
  constructor(
    message: string,
    readonly detail: unknown,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

function fail(error: unknown, fallback: string): Response {
  const safe = error instanceof StoreError ? error.message : fallback;
  console.error(`qa/state: ${safe}`, error instanceof StoreError ? error.detail : error);
  return json({ error: safe }, 503);
}

/**
 * Read one tester's shard, with the ETag needed to write it back safely.
 *
 * The distinction between ABSENT and UNREADABLE is load-bearing, not
 * defensive style. Absent is normal — that tester has recorded nothing yet —
 * and merging a delta onto an empty base is exactly right. Unreadable is a
 * transient store error, and treating it as "no entries" would merge onto an
 * empty base and silently erase everything that tester had recorded. So an
 * unreadable shard throws, and the caller refuses the write instead.
 */
async function readShard(person: Person): Promise<{ shard: Shard; etag: string } | null> {
  const unreadable = `${person}'s entries could not be read`;
  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(shardPath(person), { access: "private", useCache: false });
  } catch (error) {
    throw new StoreError(unreadable, error);
  }
  // `get` resolves null when the blob does not exist yet.
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new StoreError(unreadable, `unexpected status ${result.statusCode}`);
  }
  const text = await new Response(result.stream).text();
  let parsed: Shard;
  try {
    parsed = JSON.parse(text) as Shard;
  } catch (error) {
    throw new StoreError(`${person}'s entries are unreadable and were not overwritten`, error);
  }
  if (!parsed || typeof parsed !== "object" || !parsed.entries) {
    throw new StoreError(
      `${person}'s entries are unreadable and were not overwritten`,
      "shard is not an object with entries",
    );
  }
  return { shard: parsed, etag: result.etag };
}

/**
 * Normalize an incoming delta, dropping anything the page would not have
 * written. An entry with no status and no note is a TOMBSTONE — the tester
 * cleared that case — and is carried through as a deletion rather than
 * silently ignored.
 */
export function sanitizeDelta(raw: unknown): Record<string, Entry> {
  const delta: Record<string, Entry> = {};
  if (!raw || typeof raw !== "object") return delta;
  for (const [caseId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof caseId !== "string" || caseId.length > 64) continue;
    const entry = value as Partial<Entry> | null;
    if (!entry || typeof entry !== "object") continue;
    delta[caseId] = {
      s: typeof entry.s === "string" && STATUSES.has(entry.s) ? entry.s : "",
      n: typeof entry.n === "string" ? entry.n.slice(0, MAX_NOTE_LENGTH) : "",
      // `at` is accepted so the shape round-trips, but it is never trusted:
      // mergeDelta restamps it. See below.
      at: typeof entry.at === "string" ? entry.at : "",
    };
  }
  return delta;
}

function isTombstone(entry: Entry): boolean {
  return !entry.s && !entry.n.trim();
}

/**
 * Merge a delta into a tester's existing entries. Clients send only what
 * changed, so one tester with two browsers open cannot have one client's stale
 * snapshot roll back the other's work — which a whole-shard write would do.
 *
 * Ordering is by ARRIVAL, stamped here. A client clock is never trusted: a
 * device an hour fast would otherwise make its writes win forever, and every
 * later correction from the other device would be silently dropped. The fix is
 * not to sanity-check the skew but to stop depending on it. The server is the
 * single serialization point — conditional writes guarantee that — so the
 * order writes land here is the only ordering that is actually observable.
 */
export function mergeDelta(
  existing: Record<string, Entry>,
  delta: Record<string, Entry>,
  now: string = new Date().toISOString(),
): Record<string, Entry> {
  const merged: Record<string, Entry> = { ...existing };
  for (const [caseId, incoming] of Object.entries(delta)) {
    if (isTombstone(incoming)) delete merged[caseId];
    else merged[caseId] = { s: incoming.s, n: incoming.n, at: now };
  }
  return merged;
}

/**
 * Apply one tester's delta as an atomic read-modify-write.
 *
 * `ifMatch` makes the write conditional on the shard still being what we
 * merged onto; a concurrent save from that tester's other client invalidates
 * the ETag and we merge again onto the new base. Without this, the second
 * writer's `put` would land the first writer's entries away.
 *
 * The create path (no shard yet) cannot be conditional — `put` has no
 * create-only mode — so it verifies instead: if a concurrent create won, the
 * read-back is missing our keys and the loop runs again, now with an ETag.
 */
async function applyDelta(person: Person, delta: Record<string, Entry>): Promise<Shard> {
  const keys = Object.keys(delta);
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    // Never merge onto an assumed-empty base: that would overwrite this
    // tester's whole record with just the delta in hand. readShard throws
    // rather than reporting an unreadable shard as an empty one.
    const previous = await readShard(person);
    const shard: Shard = {
      person,
      updatedAt: new Date().toISOString(),
      entries: mergeDelta(previous?.shard.entries ?? {}, delta),
    };
    try {
      await put(shardPath(person), JSON.stringify(shard), {
        access: "private",
        contentType: "application/json",
        // A stable pathname per tester is the whole point of the sharding — a
        // random suffix would mint a new object per save and orphan the last one.
        addRandomSuffix: false,
        allowOverwrite: true,
        // No cacheControlMaxAge. Freshness is a READ-side guarantee here:
        // every `get` passes `useCache: false` and goes to origin, so the CDN
        // lifetime this would set is never on the path. Setting it to 0 to
        // "be safe" would instead risk the store rejecting the write — its
        // documented floor is 60s — and a rejected write is a lost verdict.
        ...(previous ? { ifMatch: previous.etag } : {}),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < MAX_WRITE_ATTEMPTS) continue;
      throw new StoreError(`${person}'s entries could not be saved`, error);
    }
    if (previous) return shard;
    // Unconditional create: prove it survived a concurrent create before
    // reporting success, so a lost race retries instead of silently dropping.
    const landed = await readShard(person);
    const settled = keys.every((caseId) => {
      const stored = landed?.shard.entries[caseId];
      return isTombstone(delta[caseId]) ? !stored : Boolean(stored);
    });
    if (settled) return landed?.shard ?? shard;
  }
  throw new StoreError(`${person}'s entries are being saved from elsewhere — try again`, "write contention");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    let reads: Array<{ shard: Shard; etag: string } | null>;
    try {
      reads = await Promise.all(TEAM.map((person) => readShard(person)));
    } catch (error) {
      // Returning a partial view would render as "that tester cleared their
      // entries". Fail the poll instead; the page keeps what it has and retries.
      return fail(error, "session state could not be read");
    }
    // caseId -> person -> entry, the exact shape the page renders from.
    const entries: Record<string, Record<string, Entry>> = {};
    for (const read of reads) {
      if (!read) continue;
      for (const [caseId, entry] of Object.entries(read.shard.entries)) {
        (entries[caseId] ??= {})[read.shard.person] = entry;
      }
    }
    return json({ team: TEAM, entries, readAt: new Date().toISOString() });
  }

  if (request.method === "POST") {
    let body: { person?: unknown; entries?: unknown };
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      const parsed: unknown = JSON.parse(text);
      // `JSON.parse("null")` and `JSON.parse("[]")` both succeed; reading
      // `.person` off them would throw or pass undefined straight through.
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "body must be a JSON object" }, 400);
      }
      body = parsed as { person?: unknown; entries?: unknown };
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    if (!isPerson(body.person)) {
      return json({ error: `unknown tester — expected one of ${TEAM.join(", ")}` }, 400);
    }

    let shard: Shard;
    try {
      shard = await applyDelta(body.person, sanitizeDelta(body.entries));
    } catch (error) {
      // The page keeps the unsent delta in sessionStorage and retries.
      return fail(error, `${body.person}'s entries were not saved`);
    }

    return json({ ok: true, person: shard.person, count: Object.keys(shard.entries).length });
  }

  return json({ error: "method not allowed" }, 405);
}
