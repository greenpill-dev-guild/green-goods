/**
 * QA session state — sharded by writer, versioned by run.
 *
 * Each tester owns exactly one blob per run
 * (`qa/runs/<runId>/entries/<address>.json`) and only ever writes that one.
 * Two people recording the same case at the same moment touch DIFFERENT
 * objects, so there is no cross-tester conflict to resolve and no way for one
 * tester's verdict or notes to overwrite another's. GET fans out over the
 * roster for the requested run and merges.
 *
 * Sharding removes conflicts BETWEEN testers. It does not remove them within
 * one tester: a save is read-modify-write, and the documented workflow has one
 * person running two clients (a phone on the PWA, a laptop on admin). Two of
 * their saves overlapping would otherwise let the second read a pre-first shard
 * and write the first's entries away. So each write is conditional on the ETag
 * that was read, and a losing write re-reads and re-merges instead of retrying
 * blind.
 *
 * Runs make past passes immutable: writes land only in the open run, a write
 * that names a closed run is refused with the open run's id so the page can
 * re-target it, and the first request after the deploy migrates the legacy
 * `qa/entries/` shards into Run 1 (see ../store.ts and ../runs.ts).
 */

import { BlobPreconditionFailedError, put } from "@vercel/blob";

// `.js`, not `.ts`, and not extensionless: Vercel compiles this to ESM and
// Node's resolver demands an explicit extension on a relative import. Without
// it the function crashes at load with ERR_MODULE_NOT_FOUND — which it did.
import { isSameOriginMutation, resolveCaller } from "../auth.js";
import { type RunIndex, type RunRecord, describeRun, findRun, openRun, runShardPath, validateRunId } from "../runs.js";
import {
  type Address,
  type Entry,
  MAX_NOTE_LENGTH,
  STATUSES,
  type Shard,
  StoreError,
  cleanName,
  ensureRunIndex,
  fail,
  fallbackName,
  json,
  readShard,
  shardShapeError,
} from "../store.js";

export { fallbackName, shardShapeError };
export type { Address, Entry, Shard };

/** One case's changed fields, or an explicit request to remove the case. */
interface EntryPatch {
  s?: string;
  n?: string;
  delete?: true;
}

/** One save is a delta, not a whole shard — this bound is generous on purpose. */
const MAX_BODY_BYTES = 512 * 1024;
/** Attempts per save. Contention is two clients of one person, not a thundering herd. */
const MAX_WRITE_ATTEMPTS = 4;

/**
 * Human labels for address-owned shards, made unique without changing identity.
 *
 * Names are self-declared and therefore may collide. A name collision must not
 * turn two address-keyed shards back into one entry in the merged response.
 */
export function displayLabels(shards: Array<Pick<Shard, "address" | "person">>): string[] {
  const bases = shards.map((shard) => shard.person.trim() || fallbackName(shard.address));
  const baseCounts = new Map<string, number>();
  for (const base of bases) baseCounts.set(base.toLocaleLowerCase(), (baseCounts.get(base.toLocaleLowerCase()) ?? 0) + 1);
  const provisional = bases.map((base, index) =>
    (baseCounts.get(base.toLocaleLowerCase()) ?? 0) > 1
      ? `${base} (${fallbackName(shards[index].address)})`
      : base,
  );
  const labelCounts = new Map<string, number>();
  for (const label of provisional) {
    labelCounts.set(label.toLocaleLowerCase(), (labelCounts.get(label.toLocaleLowerCase()) ?? 0) + 1);
  }
  return provisional.map((label, index) =>
    (labelCounts.get(label.toLocaleLowerCase()) ?? 0) > 1
      ? `${bases[index]} (${shards[index].address})`
      : label,
  );
}

/**
 * Normalize an incoming delta, dropping anything the page would not have
 * written. Status and note are independent patches: one browser changing a
 * verdict must not send its stale copy of the note, or vice versa. Deletion is
 * explicit so clearing one field cannot accidentally clear the whole case.
 *
 * The two-empty-fields form remains a delete for an outbox written by the
 * previous page version. Explicit deletes use `{ delete: true }`.
 */
export function sanitizeDelta(raw: unknown): Record<string, EntryPatch> {
  const delta = Object.create(null) as Record<string, EntryPatch>;
  if (!raw || typeof raw !== "object") return delta;
  for (const [caseId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!caseId || caseId.length > 64) continue;
    const incoming = value as Partial<Entry> & { delete?: unknown };
    if (!incoming || typeof incoming !== "object") continue;
    const hasStatus =
      Object.prototype.hasOwnProperty.call(incoming, "s") &&
      typeof incoming.s === "string" &&
      STATUSES.has(incoming.s);
    const hasNote = Object.prototype.hasOwnProperty.call(incoming, "n") && typeof incoming.n === "string";
    if (incoming.delete === true || (hasStatus && hasNote && !incoming.s && !incoming.n?.trim())) {
      delta[caseId] = { delete: true };
      continue;
    }
    const patch: EntryPatch = {};
    if (hasStatus) patch.s = incoming.s;
    if (hasNote) patch.n = incoming.n?.slice(0, MAX_NOTE_LENGTH);
    if (Object.keys(patch).length) delta[caseId] = patch;
  }
  return delta;
}

/**
 * Merge field-level patches into a tester's existing entries. A phone verdict
 * and laptop note that arrive together both survive regardless of arrival
 * order because neither write carries the field it did not change.
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
  delta: Record<string, EntryPatch>,
  now: string = new Date().toISOString(),
): Record<string, Entry> {
  const merged = Object.assign(Object.create(null) as Record<string, Entry>, existing);
  for (const [caseId, incoming] of Object.entries(delta)) {
    if (incoming.delete) {
      delete merged[caseId];
      continue;
    }
    const current = merged[caseId] ?? { s: "", n: "", at: now };
    const next = {
      s: Object.prototype.hasOwnProperty.call(incoming, "s") ? (incoming.s ?? "") : current.s,
      n: Object.prototype.hasOwnProperty.call(incoming, "n") ? (incoming.n ?? "") : current.n,
      at: now,
    };
    if (!next.s && !next.n.trim()) delete merged[caseId];
    else merged[caseId] = next;
  }
  return merged;
}

/**
 * Apply one tester's delta to their shard in one run as an atomic
 * read-modify-write.
 *
 * `ifMatch` makes the write conditional on the shard still being what we
 * merged onto; a concurrent save from that tester's other client invalidates
 * the ETag and we merge again onto the new base. Without this, the second
 * writer's `put` would land the first writer's entries away.
 *
 * The create path uses Blob's create-only mode (`allowOverwrite: false`). Two
 * clients that both read an absent shard therefore cannot both report success:
 * one creates it, while the other retries against the newly created ETag.
 */
export async function applyDelta(
  address: Address,
  delta: Record<string, EntryPatch>,
  declaredName?: string,
  runId = "run-1",
): Promise<Shard> {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    // Never merge onto an assumed-empty base: that would overwrite this
    // tester's whole record with just the delta in hand. readShard throws
    // rather than reporting an unreadable shard as an empty one.
    const previous = await readShard(address, runId);
    const shard: Shard = {
      address: address.toLowerCase(),
      // A tester may rename themselves; an omitted name never erases the
      // one already recorded.
      person: cleanName(declaredName) || previous?.shard.person || "",
      updatedAt: new Date().toISOString(),
      entries: mergeDelta(previous?.shard.entries ?? {}, delta),
    };
    try {
      await put(runShardPath(runId, address), JSON.stringify(shard), {
        access: "private",
        contentType: "application/json",
        // A stable pathname per tester and run is the whole point of the
        // sharding — a random suffix would mint a new object per save and
        // orphan the last one.
        addRandomSuffix: false,
        // Existing writes are conditional overwrites. A missing shard is a
        // create-only write, so a client that read the same absence cannot land
        // later and erase the first client's successful create.
        allowOverwrite: Boolean(previous),
        // No cacheControlMaxAge. Freshness is a READ-side guarantee here:
        // every `get` passes `useCache: false` and goes to origin, so the CDN
        // lifetime this would set is never on the path. Setting it to 0 to
        // "be safe" would instead risk the store rejecting the write — its
        // documented floor is 60s — and a rejected write is a lost verdict.
        ...(previous ? { ifMatch: previous.etag } : {}),
      });
    } catch (error) {
      // Blob reports ETag contention precisely. A create conflict is currently
      // surfaced as a generic Blob error, so any failed create gets the same
      // bounded re-read: if another client won, the next attempt has its ETag;
      // if this was a store failure, the final attempt still returns 503.
      if ((error instanceof BlobPreconditionFailedError || !previous) && attempt < MAX_WRITE_ATTEMPTS) continue;
      throw new StoreError(`${fallbackName(address)}'s entries could not be saved`, error);
    }
    return shard;
  }
  throw new StoreError(`${fallbackName(address)}'s entries are being saved from elsewhere — try again`, "write contention");
}

/** Run records with the opener's and closer's display names beside their addresses. */
function labelledRuns(index: RunIndex, nameFor: Map<string, string>): Array<RunRecord & { openedByLabel: string | null; closedByLabel: string | null }> {
  const labelFor = (address: string | null | undefined) =>
    address ? (nameFor.get(address) ?? fallbackName(address)) : null;
  return index.runs.map((run) => ({
    ...run,
    openedByLabel: labelFor(run.openedBy),
    closedByLabel: labelFor(run.closedBy),
  }));
}

/**
 * Vercel resolves an `api/` module's shape from its exports. A DEFAULT export
 * is read as the Node `(req, res) => void` signature, whose return value is
 * ignored — so a default export returning a `Response` writes nothing to the
 * socket and the request hangs until the platform kills it at 300s. That is a
 * 504 with no error, which is exactly how this failed in production.
 *
 * Named method exports select the Web `fetch` signature instead, where the
 * returned `Response` is the response. `handler` stays exported for the local
 * server and the tests, which call it directly.
 */
export async function GET(request: Request): Promise<Response> {
  return handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export async function handler(request: Request): Promise<Response> {
  // Method first: an unsupported verb is a 405 whether or not you are signed
  // in, and answering that before the identity gate keeps the reply honest.
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (request.method === "POST" && !isSameOriginMutation(request)) {
    return json({ error: "cross-origin request refused" }, 403);
  }
  const caller = await resolveCaller(request);
  if ("error" in caller) return json({ error: caller.error }, caller.status);

  // The index is load-bearing on every request: GET must resolve the default
  // run and POST must refuse a closed one, so it is read at origin each time.
  let index: RunIndex;
  try {
    index = (await ensureRunIndex(caller.allowlist)).index;
  } catch (error) {
    return fail(error, "the runs could not be read");
  }
  const open = openRun(index);

  if (request.method === "GET") {
    const requested = new URL(request.url).searchParams.get("run");
    let served: RunRecord = open;
    if (requested) {
      const runId = validateRunId(requested);
      const run = runId ? findRun(index, runId) : undefined;
      if (!run) return json({ error: `run ${requested.slice(0, 32)} does not exist here`, openRun: open.id }, 404);
      served = run;
    }

    let reads: Array<{ shard: Shard; etag: string } | null>;
    try {
      reads = await Promise.all(caller.allowlist.map((address) => readShard(address, served.id)));
    } catch (error) {
      // Returning a partial view would render as "that tester cleared their
      // entries". Fail the poll instead; the page keeps what it has and retries.
      return fail(error, "session state could not be read");
    }
    // The roster is whoever the allowlist admits, labelled by the name they
    // declared. Somebody who has never signed in has no shard and so no name
    // yet — they still belong on the roster, under their short address.
    const owners = caller.allowlist.map((address, position) => ({
      address,
      person: reads[position]?.shard.person ?? "",
    }));
    const team = displayLabels(owners);
    let you = fallbackName(caller.address);
    const nameFor = new Map<string, string>();
    caller.allowlist.forEach((address, position) => {
      const label = team[position];
      nameFor.set(address, label);
      if (address === caller.address) you = label;
    });

    // caseId -> person -> entry, the exact shape the page renders from.
    const entries = Object.create(null) as Record<string, Record<string, Entry>>;
    for (const read of reads) {
      if (!read) continue;
      const label = nameFor.get(read.shard.address) ?? fallbackName(read.shard.address);
      for (const [caseId, entry] of Object.entries(read.shard.entries)) {
        (entries[caseId] ??= Object.create(null) as Record<string, Entry>)[label] = entry;
      }
    }
    return json({
      team,
      you,
      // The page shows this once so a tester can confirm which wallet is
      // recording before they trust the name beside it.
      address: caller.address,
      named: Boolean(reads[caller.allowlist.indexOf(caller.address)]?.shard.person?.trim()),
      entries,
      readAt: new Date().toISOString(),
      runs: labelledRuns(index, nameFor),
      run: served.id,
      openRun: open.id,
    });
  }

  if (request.method === "POST") {
    let body: { entries?: unknown; person?: unknown; run?: unknown };
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      const parsed: unknown = JSON.parse(text);
      // `JSON.parse("null")` and `JSON.parse("[]")` both succeed; reading
      // fields off them would throw or pass undefined straight through.
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "body must be a JSON object" }, 400);
      }
      body = parsed as { entries?: unknown; person?: unknown; run?: unknown };
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    // A page that names no run — the version deployed before runs existed —
    // records into the open run. A page that names a run must name the open
    // one: a closed or unknown run is refused WITHOUT a write, and the refusal
    // carries the open run's id so the page can re-target its outbox there.
    // Never a 404: the page treats any other failure as "retry every 5s".
    let target: RunRecord = open;
    if (body.run !== undefined && body.run !== null && body.run !== "") {
      const runId = validateRunId(body.run);
      if (!runId) return json({ error: "run id is malformed" }, 400);
      const run = findRun(index, runId);
      if (!run) return json({ error: `run ${runId} does not exist here`, reason: "unknown", openRun: open.id }, 409);
      if (run.closedAt) {
        return json(
          { error: `${describeRun(run)} is closed`, reason: "closed", openRun: open.id, closedAt: run.closedAt },
          409,
        );
      }
      target = run;
    }

    // `body.person` sets THIS caller's own display name — a label on their own
    // shard. It cannot change which shard is written; that is the address.
    let shard: Shard;
    try {
      shard = await applyDelta(caller.address, sanitizeDelta(body.entries), body.person as string | undefined, target.id);
    } catch (error) {
      // The page keeps the unsent delta in localStorage and retries.
      return fail(error, `${fallbackName(caller.address)}'s entries were not saved`);
    }

    return json({
      ok: true,
      person: shard.person || fallbackName(shard.address),
      count: Object.keys(shard.entries).length,
      run: target.id,
    });
  }

  return json({ error: "method not allowed" }, 405);
}
