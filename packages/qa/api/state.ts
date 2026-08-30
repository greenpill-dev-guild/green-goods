/**
 * QA session state — sharded by writer.
 *
 * Each tester owns exactly one blob (`qa/entries/<person>.json`) and only ever
 * writes that one. Two people recording the same case at the same moment touch
 * DIFFERENT objects, so there is no conflict to resolve: no locking, no
 * compare-and-set, no merge policy, and no way for one tester's verdict or
 * notes to overwrite another's. GET fans out over the roster and merges.
 *
 * The roster is fixed and served from here so the page never invents a writer:
 * an unknown `person` is rejected rather than silently creating a shard.
 *
 * Reads pass `useCache: false` deliberately. Private blob reads are served
 * through the CDN cache by default, and an overwrite can take up to 60 seconds
 * to propagate — which in a live two-person session reads as "the app lost my
 * partner's entry". Correctness beats the cache here; the payload is small.
 */

import { get, put } from "@vercel/blob";

export const TEAM = ["Afo", "Nansel", "Gui"] as const;
type Person = (typeof TEAM)[number];

/** One tester's verdict and notes on one case. */
interface Entry {
  /** "pass" | "fail" | "blocked" | "na", or "" while only a note exists. */
  s: string;
  /** Free-text note. */
  n: string;
  /** ISO timestamp of the tester's last change to this case. */
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
 * Read one tester's shard.
 *
 * The distinction between ABSENT and UNREADABLE is load-bearing, not
 * defensive style. Absent is normal — that tester has recorded nothing yet —
 * and merging a delta onto an empty base is exactly right. Unreadable is a
 * transient store error, and treating it as "no entries" would merge onto an
 * empty base and silently erase everything that tester had recorded. So an
 * unreadable shard throws, and the caller refuses the write instead.
 */
async function readShard(person: Person): Promise<Shard | null> {
  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(shardPath(person), { access: "private", useCache: false });
  } catch (error) {
    throw new Error(`could not read ${person}'s entries: ${describe(error)}`);
  }
  // `get` resolves null when the blob does not exist yet.
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`could not read ${person}'s entries: unexpected status ${result.statusCode}`);
  }
  const text = await new Response(result.stream).text();
  let parsed: Shard;
  try {
    parsed = JSON.parse(text) as Shard;
  } catch {
    throw new Error(`${person}'s entries are corrupt and were not overwritten`);
  }
  if (!parsed || typeof parsed !== "object" || !parsed.entries) {
    throw new Error(`${person}'s entries are malformed and were not overwritten`);
  }
  return parsed;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
      at: typeof entry.at === "string" ? entry.at : new Date().toISOString(),
    };
  }
  return delta;
}

function isTombstone(entry: Entry): boolean {
  return !entry.s && !entry.n.trim();
}

/**
 * Merge a delta into a tester's existing entries, newest write winning per
 * case. Clients send only what changed, so one tester with two browsers open
 * (a phone walking the PWA, a laptop on admin) cannot have one client's stale
 * snapshot roll back the other's work — which a whole-shard write would do.
 */
export function mergeDelta(
  existing: Record<string, Entry>,
  delta: Record<string, Entry>,
): Record<string, Entry> {
  const merged: Record<string, Entry> = { ...existing };
  for (const [caseId, incoming] of Object.entries(delta)) {
    const current = merged[caseId];
    if (current && current.at && incoming.at && incoming.at < current.at) continue;
    if (isTombstone(incoming)) delete merged[caseId];
    else merged[caseId] = incoming;
  }
  return merged;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    let shards: Array<Shard | null>;
    try {
      shards = await Promise.all(TEAM.map((person) => readShard(person)));
    } catch (error) {
      // Returning a partial view would render as "that tester cleared their
      // entries". Fail the poll instead; the page keeps what it has and retries.
      return json({ error: describe(error) }, 503);
    }
    // caseId -> person -> entry, the exact shape the page renders from.
    const entries: Record<string, Record<string, Entry>> = {};
    for (const shard of shards) {
      if (!shard) continue;
      for (const [caseId, entry] of Object.entries(shard.entries)) {
        (entries[caseId] ??= {})[shard.person] = entry;
      }
    }
    return json({ team: TEAM, entries, readAt: new Date().toISOString() });
  }

  if (request.method === "POST") {
    let body: { person?: unknown; entries?: unknown };
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    if (!isPerson(body.person)) {
      return json({ error: `unknown tester — expected one of ${TEAM.join(", ")}` }, 400);
    }

    let previous: Shard | null;
    try {
      previous = await readShard(body.person);
    } catch (error) {
      // Never merge onto an assumed-empty base: that would overwrite this
      // tester's whole record with just the delta in hand. Refuse the write —
      // the page keeps the work in sessionStorage and retries.
      return json({ error: describe(error) }, 503);
    }

    const shard: Shard = {
      person: body.person,
      updatedAt: new Date().toISOString(),
      entries: mergeDelta(previous?.entries ?? {}, sanitizeDelta(body.entries)),
    };

    try {
      await put(shardPath(body.person), JSON.stringify(shard), {
        access: "private",
        contentType: "application/json",
        // A stable pathname per tester is the whole point of the sharding — a
        // random suffix would mint a new object per save and orphan the last one.
        addRandomSuffix: false,
        allowOverwrite: true,
        // Writes must be immediately visible to the other tester's next poll;
        // the default month-long CDN lifetime would read as "my partner's
        // entries never arrive".
        cacheControlMaxAge: 0,
      });
    } catch (error) {
      return json({ error: `could not save ${body.person}'s entries: ${describe(error)}` }, 503);
    }

    return json({ ok: true, person: shard.person, count: Object.keys(shard.entries).length });
  }

  return json({ error: "method not allowed" }, 405);
}
