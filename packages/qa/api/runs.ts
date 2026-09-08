/**
 * Runs endpoint for the QA app.
 *
 *   GET  /api/runs  → the run index: every run, and which one is open
 *   POST /api/runs  → { action: "rollover", label, environment, builds?, catalog? }
 *                     closes the open run and opens its successor
 *
 * A rollover is one conditional write of the index, taken under the store
 * lock that every save also takes, so no save can validate against the run
 * being closed and write after it closed. Two testers rolling over at once
 * produce one winner and one 409 that carries the fresh index, so the loser
 * looks again instead of opening a second run. Nothing is retried on
 * the server: a rollover is not idempotent, and the human should see what the
 * store looks like now. Named method exports, never a default export (see
 * ./state.ts for why).
 */

import { BlobPreconditionFailedError } from "@vercel/blob";

import { isSameOriginMutation, resolveCaller } from "../auth.js";
import {
  RUN_INDEX_PATH,
  cleanBuilds,
  cleanCatalog,
  cleanLabel,
  openRun,
  describeRun,
  rolloverIndex,
  runShardPath,
  validateEnvironment,
  validateRunId,
} from "../runs.js";
import {
  ensureRunIndex,
  fail,
  fallbackName,
  json,
  putConditional,
  putCreateOnly,
  readRunIndex,
  readShard,
  withStoreLock,
} from "../store.js";

const MAX_BODY_BYTES = 8 * 1024;

export async function GET(request: Request): Promise<Response> {
  const caller = await resolveCaller(request);
  if ("error" in caller) return json({ error: caller.error }, caller.status);
  try {
    const { index } = await ensureRunIndex(caller.allowlist);
    return json({ runs: index.runs, openRun: openRun(index).id });
  } catch (error) {
    return fail(error, "the runs could not be read", "qa/runs");
  }
}

/**
 * Carry every named tester into the new run.
 *
 * `named` and the roster labels come from the shards of the run being served,
 * so a fresh run with no shards would ask every tester for their name again
 * and show short addresses until they answered. An empty-entries shard with
 * the person already set costs nothing and keeps the roster stable. Best
 * effort: a failure here is logged, never a failed rollover.
 */
async function carryNames(allowlist: string[], closedRunId: string, openedRunId: string, now: string): Promise<void> {
  await Promise.all(
    allowlist.map(async (address) => {
      try {
        const previous = await readShard(address, closedRunId);
        const person = previous?.shard.person.trim();
        if (!person) return;
        await putCreateOnly(
          runShardPath(openedRunId, address),
          JSON.stringify({ address, person, updatedAt: now, entries: {} }),
        );
      } catch (error) {
        console.error(`qa/runs: could not carry ${fallbackName(address)}'s name into ${openedRunId}`, error);
      }
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "cross-origin request refused" }, 403);
  const caller = await resolveCaller(request);
  if ("error" in caller) return json({ error: caller.error }, caller.status);

  let body: {
    action?: unknown;
    label?: unknown;
    environment?: unknown;
    builds?: unknown;
    catalog?: unknown;
    expectedOpenRun?: unknown;
  };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "body must be a JSON object" }, 400);
    }
    body = parsed as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (body.action !== "rollover") return json({ error: "action must be rollover" }, 400);

  const label = cleanLabel(body.label);
  if (!label) return json({ error: "a label for the new run is required" }, 400);
  const environment = validateEnvironment(body.environment);
  if (!environment) return json({ error: "environment must be production, beta, or local" }, 400);
  const builds = cleanBuilds(body.builds);
  if (builds === null) {
    return json({ error: "build SHAs must be 7 to 40 hex characters, for client, admin, or website" }, 400);
  }
  const catalog = body.catalog === undefined || body.catalog === null ? null : cleanCatalog(body.catalog);
  if (body.catalog !== undefined && body.catalog !== null && catalog === null) {
    return json({ error: "catalog must carry a revision and an activeCases count" }, 400);
  }
  // The run the tester confirmed closing. A stale tab (a teammate rolled over
  // first, or a retry after a lost response) must not close the next run too.
  const expectedGiven = body.expectedOpenRun !== undefined && body.expectedOpenRun !== null;
  const expectedOpenRun = expectedGiven ? validateRunId(body.expectedOpenRun) : null;
  if (expectedGiven && !expectedOpenRun) return json({ error: "expectedOpenRun is malformed" }, 400);

  let next: ReturnType<typeof rolloverIndex>;
  let now: string;
  try {
    const outcome = await withStoreLock(async (): Promise<Response | { next: ReturnType<typeof rolloverIndex>; now: string }> => {
      const current = await ensureRunIndex(caller.allowlist);
      const currentOpen = openRun(current.index);
      if (expectedOpenRun && currentOpen.id !== expectedOpenRun) {
        return json(
          {
            error: `${describeRun(currentOpen)} is the open run now — reload and look again`,
            reason: "stale",
            runs: current.index.runs,
            openRun: currentOpen.id,
          },
          409,
        );
      }
      const stamp = new Date().toISOString();
      const rolled = rolloverIndex(current.index, { label, environment, builds, catalog, by: caller.address, now: stamp });
      try {
        await putConditional(RUN_INDEX_PATH, JSON.stringify(rolled.index), current.etag);
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError)) throw error;
        // Only a lease that ran out lets the index move under the lock. Hand
        // back what the store holds now and let the human look.
        const fresh = await readRunIndex();
        return json(
          {
            error: "the runs changed under you — reload and look again",
            runs: fresh?.index.runs ?? [],
            openRun: fresh ? openRun(fresh.index).id : null,
          },
          409,
        );
      }
      return { next: rolled, now: stamp };
    });
    if (outcome instanceof Response) return outcome;
    next = outcome.next;
    now = outcome.now;
  } catch (error) {
    return fail(error, "the run could not be rolled over", "qa/runs");
  }

  await carryNames(caller.allowlist, next.closed.id, next.opened.id, now);
  return json({ ok: true, closed: next.closed, opened: next.opened, runs: next.index.runs, openRun: next.opened.id });
}
