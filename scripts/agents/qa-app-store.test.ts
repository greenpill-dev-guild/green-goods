import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: blob.get,
    put: blob.put,
  };
});

import { BlobPreconditionFailedError } from "@vercel/blob";

import { issueSession } from "../../packages/qa/auth";
import { POST as rollover } from "../../packages/qa/api/runs";
import {
  applyDelta,
  displayLabels,
  handler,
  mergeDelta,
  sanitizeDelta,
  shardShapeError,
} from "../../packages/qa/api/state";
import {
  RUN_INDEX_PATH,
  type RunIndex,
  legacyRunRecord,
  rolloverIndex,
  runIndexShapeError,
  runShardPath,
} from "../../packages/qa/runs";
import { ensureRunIndex } from "../../packages/qa/store";

/** Shards are keyed by owner address; the display name inside is only a label. */
const ADDRESS = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e";
const OTHER_ADDRESS = "0x22682c3d3848294ff9bcbf3f0ddf48a605446b56";
const SECRET = "test-secret-that-is-long-enough-to-pass-the-length-check";
const ORIGIN = "https://qa.greengoods.app";
const NOW = "2026-09-07T10:00:00.000Z";

interface StoredBlob {
  body: string;
  etag: string;
}

/**
 * A keyed in-memory Blob: pathname → object, honouring create-only writes and
 * ETag-conditional overwrites exactly the way the store does. A losing
 * conditional write throws the SDK's precondition error, because the
 * endpoints map that class — and only that class — to a 409.
 */
function memoryBlob(initial: Record<string, string> = {}) {
  const objects = new Map<string, StoredBlob>();
  let etag = 0;
  for (const [pathname, body] of Object.entries(initial)) objects.set(pathname, { body, etag: `etag-${++etag}` });
  const puts: Array<{ pathname: string; options: Record<string, unknown> }> = [];
  // A read gate holds the first N reads of one pathname until all N have
  // started, so two requests provably act on the same ETag before either writes.
  let gate: { pathname: string; readers: number; started: number; release: () => void; open: Promise<void> } | null = null;
  // A put hook runs before one write lands, so a test can slip a rollover in
  // between a request's index check and its shard write.
  let beforePut: ((pathname: string) => Promise<void>) | null = null;
  blob.get.mockImplementation(async (pathname: string) => {
    if (gate && pathname === gate.pathname && gate.started < gate.readers) {
      gate.started += 1;
      if (gate.started === gate.readers) gate.release();
      await gate.open;
    }
    const stored = objects.get(pathname);
    // The SDK reports the ETag on the blob metadata, not on the result.
    return stored ? { statusCode: 200, stream: stored.body, blob: { etag: stored.etag } } : null;
  });
  blob.put.mockImplementation(async (pathname: string, body: string, options: Record<string, unknown>) => {
    if (beforePut) {
      const hook = beforePut;
      beforePut = null;
      await hook(pathname);
    }
    puts.push({ pathname, options });
    const stored = objects.get(pathname);
    if (options.allowOverwrite === false && stored) throw new Error("pathname already exists");
    if (options.ifMatch && options.ifMatch !== stored?.etag) throw new BlobPreconditionFailedError("etag mismatch");
    objects.set(pathname, { body: String(body), etag: `etag-${++etag}` });
    return {};
  });
  return {
    objects,
    puts,
    gate(pathname: string, readers: number) {
      let release = () => {};
      const open = new Promise<void>((resolve) => {
        release = resolve;
      });
      gate = { pathname, readers, started: 0, release, open };
    },
    onNextPut(hook: (pathname: string) => Promise<void>) {
      beforePut = hook;
    },
    json: (pathname: string) => JSON.parse(objects.get(pathname)?.body ?? "null"),
    index: () => JSON.parse(objects.get(RUN_INDEX_PATH)?.body ?? "null") as RunIndex | null,
  };
}

const entry = (s: string, at = "2026-09-04T18:30:00.000Z", n = "") => ({ s, n, at });

function shardBody(address: string, person: string, entries: Record<string, ReturnType<typeof entry>>) {
  return JSON.stringify({ address, person, updatedAt: "2026-09-04T22:00:00.000Z", entries });
}

async function withConfig<T>(allowlist: string[], run: () => Promise<T>): Promise<T> {
  const previousSecret = process.env.QA_SESSION_SECRET;
  const previousAllowlist = process.env.QA_ALLOWLIST;
  process.env.QA_SESSION_SECRET = SECRET;
  process.env.QA_ALLOWLIST = JSON.stringify(allowlist);
  try {
    return await run();
  } finally {
    if (previousSecret === undefined) delete process.env.QA_SESSION_SECRET;
    else process.env.QA_SESSION_SECRET = previousSecret;
    if (previousAllowlist === undefined) delete process.env.QA_ALLOWLIST;
    else process.env.QA_ALLOWLIST = previousAllowlist;
  }
}

async function signedAs(address: string, init: RequestInit & { path?: string } = {}): Promise<Request> {
  const token = await issueSession(SECRET, address, Date.now());
  const { path = "/api/state", ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("cookie", `qa_session=${token}`);
  if (rest.method === "POST") {
    headers.set("origin", ORIGIN);
    headers.set("content-type", "application/json");
  }
  return new Request(`${ORIGIN}${path}`, { ...rest, headers });
}

const legacyStore = () =>
  memoryBlob({
    [`qa/entries/${ADDRESS}.json`]: shardBody(ADDRESS, "Afo", {
      "PUB-001": entry("pass", "2026-08-29T09:00:00.000Z"),
      "PWA-021": entry("fail", "2026-09-04T19:10:00.000Z", "request to join not visible"),
    }),
    [`qa/entries/${OTHER_ADDRESS}.json`]: shardBody(OTHER_ADDRESS, "Dida", {
      "ADM-004": entry("fail", "2026-09-04T20:00:00.000Z"),
    }),
  });

describe("run index migration", () => {
  beforeEach(() => {
    blob.get.mockReset();
    blob.put.mockReset();
  });

  it("migrates legacy shards into an open Run 1 byte for byte, and a second migration changes nothing", async () => {
    const store = legacyStore();
    const first = await ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW);

    expect(first.index.runs).toHaveLength(1);
    expect(first.index.runs[0]).toMatchObject({
      id: "run-1",
      n: 1,
      label: "Baseline",
      legacy: true,
      openedAt: "2026-08-29T09:00:00.000Z",
      openedBy: null,
      environment: "beta",
      window: { from: "2026-08-29T09:00:00.000Z", to: "2026-09-04T20:00:00.000Z" },
    });
    expect(first.index.runs[0].closedAt).toBeUndefined();
    for (const address of [ADDRESS, OTHER_ADDRESS]) {
      expect(store.objects.get(runShardPath("run-1", address))?.body).toBe(
        store.objects.get(`qa/entries/${address}.json`)?.body,
      );
    }
    // Every migration write is create-only; the legacy path is never written.
    expect(store.puts.every((write) => write.options.allowOverwrite === false)).toBe(true);
    expect(store.puts.some((write) => write.pathname.startsWith("qa/entries/"))).toBe(false);

    const putsAfterFirst = store.puts.length;
    const second = await ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => "2026-09-07T11:00:00.000Z");
    expect(second.index).toEqual(first.index);
    expect(second.etag).toBe(first.etag);
    expect(store.puts).toHaveLength(putsAfterFirst);
  });

  it("migrates an empty store into a Run 1 with no window", async () => {
    memoryBlob();
    const { index } = await ensureRunIndex([ADDRESS], () => NOW);
    expect(index.runs[0]).toMatchObject({ id: "run-1", openedAt: NOW, window: null, legacy: true });
  });

  it("finishes a migration another request started, leaving one index", async () => {
    const store = legacyStore();
    // A crash after copying one shard but before the index write: the copy
    // already exists, so the next request must treat "exists" as done.
    store.objects.set(runShardPath("run-1", ADDRESS), {
      body: store.objects.get(`qa/entries/${ADDRESS}.json`)?.body ?? "",
      etag: "etag-copied",
    });
    const [a, b] = await Promise.all([
      ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW),
      ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW),
    ]);
    expect(a.index).toEqual(b.index);
    expect(store.puts.filter((write) => write.pathname === RUN_INDEX_PATH)).toHaveLength(2);
    expect(store.index()?.runs).toHaveLength(1);
  });

  it("treats an unreadable index as a store failure, never as an absent one", async () => {
    const store = legacyStore();
    store.objects.set(RUN_INDEX_PATH, { body: "{not json", etag: "etag-bad" });
    await expect(ensureRunIndex([ADDRESS], () => NOW)).rejects.toThrow(/run index is unreadable/);
    expect(store.puts).toHaveLength(0);

    store.objects.set(RUN_INDEX_PATH, { body: JSON.stringify({ version: 1, updatedAt: NOW, runs: [] }), etag: "e" });
    await expect(ensureRunIndex([ADDRESS], () => NOW)).rejects.toThrow(/run index is unreadable/);

    blob.get.mockRejectedValue(new Error("store down"));
    await expect(ensureRunIndex([ADDRESS], () => NOW)).rejects.toThrow(/run index could not be read/);
  });
});

describe("run index shape", () => {
  const index = () => ({
    version: 1,
    updatedAt: NOW,
    runs: [
      {
        id: "run-1",
        n: 1,
        label: "Baseline",
        legacy: true,
        openedAt: "2026-08-29T09:00:00.000Z",
        openedBy: null,
        closedAt: NOW,
        closedBy: ADDRESS,
        environment: "beta",
        catalog: null,
        builds: {},
        window: { from: "2026-08-29T09:00:00.000Z", to: NOW },
      },
      {
        id: "run-2",
        n: 2,
        label: "Re-QA 2026-09-08",
        openedAt: NOW,
        openedBy: ADDRESS,
        environment: "beta",
        catalog: { revision: "abc123", activeCases: 150 },
        builds: { client: "d4d860573" },
        window: null,
      },
    ],
  });

  it("accepts an index with exactly one open run, the newest", () => {
    expect(runIndexShapeError(index())).toBeNull();
  });

  it("refuses zero or two open runs and a malformed record", () => {
    const none = index();
    none.runs[1] = { ...none.runs[1], closedAt: NOW, closedBy: ADDRESS, window: { from: NOW, to: NOW } };
    expect(runIndexShapeError(none)).toMatch(/no open run/);

    const two = index();
    delete (two.runs[0] as { closedAt?: string }).closedAt;
    delete (two.runs[0] as { closedBy?: string }).closedBy;
    expect(runIndexShapeError(two)).toMatch(/more than one open run/);

    const wrongOrder = index();
    wrongOrder.runs.reverse();
    expect(runIndexShapeError(wrongOrder)).toMatch(/out of order/);

    const malformed = index();
    (malformed.runs[1] as { environment: string }).environment = "staging";
    expect(runIndexShapeError(malformed)).toMatch(/run-2 has no valid environment/);
    expect(runIndexShapeError({ version: 2, updatedAt: NOW, runs: index().runs })).toMatch(/version/);
    expect(runIndexShapeError(null)).toMatch(/not an object/);
  });

  it("rolls the open run over into a closed record and its successor", () => {
    const current = { version: 1 as const, updatedAt: NOW, runs: [index().runs[0]] };
    delete (current.runs[0] as { closedAt?: string }).closedAt;
    delete (current.runs[0] as { closedBy?: string }).closedBy;
    current.runs[0].window = { from: "2026-08-29T09:00:00.000Z", to: "2026-09-04T20:00:00.000Z" };
    const later = "2026-09-08T15:00:00.000Z";
    const { index: next, closed, opened } = rolloverIndex(current, {
      label: "Re-QA 2026-09-08",
      environment: "beta",
      builds: { client: "d4d860573" },
      catalog: null,
      by: OTHER_ADDRESS,
      now: later,
    });
    expect(closed).toMatchObject({
      id: "run-1",
      closedAt: later,
      closedBy: OTHER_ADDRESS,
      // The legacy baseline keeps its earliest entry as the start of its window.
      window: { from: "2026-08-29T09:00:00.000Z", to: later },
    });
    expect(opened).toMatchObject({ id: "run-2", n: 2, openedAt: later, openedBy: OTHER_ADDRESS, window: null });
    expect(next.runs.map((run) => run.id)).toEqual(["run-1", "run-2"]);
    expect(runIndexShapeError(next)).toBeNull();
  });

  it("takes the legacy run's start and window from the earliest and latest entries", () => {
    const record = legacyRunRecord(
      [
        { entries: { A: { at: "2026-09-01T00:00:00.000Z" }, B: { at: "2026-08-20T00:00:00.000Z" } } },
        null,
        { entries: { C: { at: "2026-09-05T00:00:00.000Z" } } },
      ],
      NOW,
    );
    expect(record.openedAt).toBe("2026-08-20T00:00:00.000Z");
    expect(record.window).toEqual({ from: "2026-08-20T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" });
  });
});

describe("state endpoint runs", () => {
  beforeEach(() => {
    blob.get.mockReset();
    blob.put.mockReset();
  });

  const rolledOver = () => {
    const store = legacyStore();
    const first = { ...legacyRunRecord([], "2026-08-29T09:00:00.000Z"), closedAt: NOW, closedBy: ADDRESS };
    first.window = { from: "2026-08-29T09:00:00.000Z", to: NOW };
    const index: RunIndex = {
      version: 1,
      updatedAt: NOW,
      runs: [
        first,
        {
          id: "run-2",
          n: 2,
          label: "Re-QA 2026-09-08",
          openedAt: NOW,
          openedBy: ADDRESS,
          environment: "beta",
          catalog: null,
          builds: {},
          window: null,
        },
      ],
    };
    store.objects.set(RUN_INDEX_PATH, { body: JSON.stringify(index), etag: "etag-index" });
    store.objects.set(runShardPath("run-1", ADDRESS), {
      body: store.objects.get(`qa/entries/${ADDRESS}.json`)?.body ?? "",
      etag: "etag-run1-afo",
    });
    return store;
  };

  it("serves the open run by default, a closed run on ?run=, and keeps the legacy response fields", async () => {
    const store = rolledOver();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      const open = await (await handler(await signedAs(ADDRESS))).json();
      expect(Object.keys(open).sort()).toEqual(
        ["address", "entries", "named", "openRun", "readAt", "run", "runs", "team", "you"].sort(),
      );
      expect(open.run).toBe("run-2");
      expect(open.openRun).toBe("run-2");
      expect(open.entries).toEqual({});
      expect(open.runs.map((run: { id: string; closedByLabel: string | null }) => [run.id, run.closedByLabel])).toEqual([
        ["run-1", "0x2aa6…d35e"],
        ["run-2", null],
      ]);

      const closed = await (await handler(await signedAs(ADDRESS, { path: "/api/state?run=run-1" }))).json();
      expect(closed.run).toBe("run-1");
      expect(closed.entries["PWA-021"].Afo.s).toBe("fail");
      expect(store.puts).toHaveLength(0);

      const missing = await handler(await signedAs(ADDRESS, { path: "/api/state?run=run-9" }));
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ openRun: "run-2" });
    });
  });

  it("refuses a write to a closed run with the open run's id and leaves the closed shard untouched", async () => {
    const store = rolledOver();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      const refused = await handler(
        await signedAs(ADDRESS, {
          method: "POST",
          body: JSON.stringify({ run: "run-1", entries: { "PWA-021": { s: "pass" } } }),
        }),
      );
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({ reason: "closed", openRun: "run-2", closedAt: NOW });
      expect(store.objects.get(runShardPath("run-1", ADDRESS))?.etag).toBe("etag-run1-afo");
      expect(store.puts).toHaveLength(0);

      const unknown = await handler(
        await signedAs(ADDRESS, { method: "POST", body: JSON.stringify({ run: "run-7", entries: {} }) }),
      );
      expect(unknown.status).toBe(409);
      expect(await unknown.json()).toMatchObject({ reason: "unknown", openRun: "run-2" });

      const malformed = await handler(
        await signedAs(ADDRESS, { method: "POST", body: JSON.stringify({ run: "latest", entries: {} }) }),
      );
      expect(malformed.status).toBe(400);
    });
  });

  it("writes to the open run when the body names no run, and to the open run by id", async () => {
    const store = rolledOver();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      const legacyPage = await handler(
        await signedAs(ADDRESS, { method: "POST", body: JSON.stringify({ entries: { "PUB-001": { s: "pass" } } }) }),
      );
      expect(await legacyPage.json()).toMatchObject({ ok: true, run: "run-2", count: 1 });
      expect(store.json(runShardPath("run-2", ADDRESS)).entries["PUB-001"].s).toBe("pass");

      const named = await handler(
        await signedAs(ADDRESS, {
          method: "POST",
          body: JSON.stringify({ run: "run-2", entries: { "PWA-021": { s: "pass", n: "join visible now" } } }),
        }),
      );
      expect(await named.json()).toMatchObject({ ok: true, run: "run-2", count: 2 });
      expect(store.json(runShardPath("run-1", ADDRESS)).entries["PWA-021"].s).toBe("fail");
    });
  });

  it("re-targets a save whose run closed between the index check and the shard write, leaving the closed shard as it was", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      await ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW);
      const closedBefore = store.objects.get(runShardPath("run-1", ADDRESS))?.body;
      // The save reads the index (run-1 open), then a teammate's rollover lands
      // before the save's shard write does.
      store.onNextPut(async (pathname) => {
        expect(pathname).toBe(runShardPath("run-1", ADDRESS));
        const rolled = await rollover(
          await signedAs(OTHER_ADDRESS, {
            path: "/api/runs",
            method: "POST",
            body: JSON.stringify({ action: "rollover", label: "Re-QA", environment: "beta" }),
          }),
        );
        expect(rolled.status).toBe(200);
      });
      const response = await handler(
        await signedAs(ADDRESS, {
          method: "POST",
          body: JSON.stringify({ run: "run-1", entries: { "PWA-021": { s: "pass", n: "join visible now" } } }),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, run: "run-2", retargeted: true });
      // The closed run reads exactly as it did at close; the delta lives in the open run.
      expect(store.objects.get(runShardPath("run-1", ADDRESS))?.body).toBe(closedBefore);
      expect(store.json(runShardPath("run-2", ADDRESS)).entries["PWA-021"]).toMatchObject({ s: "pass", n: "join visible now" });
    });
  });

  it("migrates on the first request and answers from Run 1", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      const first = await (await handler(await signedAs(OTHER_ADDRESS))).json();
      expect(first.openRun).toBe("run-1");
      expect(first.you).toBe("Dida");
      expect(first.named).toBe(true);
      expect(first.entries["ADM-004"].Dida.s).toBe("fail");
      expect(store.index()?.runs[0]).toMatchObject({ id: "run-1", legacy: true });
    });
  });
});

describe("rollover endpoint", () => {
  beforeEach(() => {
    blob.get.mockReset();
    blob.put.mockReset();
  });

  const rolloverRequest = (address: string, body: unknown, origin = ORIGIN) =>
    signedAs(address, { path: "/api/runs", method: "POST", body: JSON.stringify(body) }).then((request) => {
      if (origin !== ORIGIN) request.headers.set("origin", origin);
      return request;
    });

  it("closes the open run and opens its successor in one conditional write, carrying names along", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      const response = await rolloverRequest(OTHER_ADDRESS, {
        action: "rollover",
        label: "  Re-QA   2026-09-08 ",
        environment: "beta",
        builds: { client: "D4D860573", admin: "" },
        catalog: { revision: "abc123def456", activeCases: 156 },
      }).then(rollover);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.closed).toMatchObject({ id: "run-1", closedBy: OTHER_ADDRESS });
      expect(body.opened).toMatchObject({
        id: "run-2",
        label: "Re-QA 2026-09-08",
        environment: "beta",
        builds: { client: "d4d860573" },
        catalog: { revision: "abc123def456", activeCases: 156 },
        openedBy: OTHER_ADDRESS,
      });
      expect(body.openRun).toBe("run-2");

      const indexWrites = store.puts.filter((write) => write.pathname === RUN_INDEX_PATH);
      expect(indexWrites.at(-1)?.options).toMatchObject({ allowOverwrite: true, ifMatch: expect.any(String) });
      expect(store.index()?.runs.map((run) => run.id)).toEqual(["run-1", "run-2"]);
      for (const [address, person] of [
        [ADDRESS, "Afo"],
        [OTHER_ADDRESS, "Dida"],
      ]) {
        expect(store.json(runShardPath("run-2", address))).toMatchObject({ address, person, entries: {} });
      }
      // The closed run's shards are untouched by the rollover.
      expect(store.json(runShardPath("run-1", ADDRESS)).entries["PWA-021"].s).toBe("fail");
    });
  });

  it("lets one of two concurrent rollovers win and answers the other with the fresh index", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      await ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW);
      store.gate(RUN_INDEX_PATH, 2);
      const body = { action: "rollover", label: "Re-QA", environment: "beta" };
      const [a, b] = await Promise.all([
        rolloverRequest(ADDRESS, body).then(rollover),
        rolloverRequest(OTHER_ADDRESS, body).then(rollover),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);
      const loser = a.status === 409 ? a : b;
      expect(await loser.json()).toMatchObject({ openRun: "run-2" });
      expect(store.index()?.runs).toHaveLength(2);
    });
  });

  it("refuses a rollover that names a run other than the one that is open", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS, OTHER_ADDRESS], async () => {
      await ensureRunIndex([ADDRESS, OTHER_ADDRESS], () => NOW);
      const first = await rollover(
        await rolloverRequest(ADDRESS, { action: "rollover", label: "Re-QA", environment: "beta", expectedOpenRun: "run-1" }),
      );
      expect(first.status).toBe(200);
      // A tab that still shows Run 1 as open retries: it must not close Run 2.
      const stale = await rollover(
        await rolloverRequest(ADDRESS, { action: "rollover", label: "Again", environment: "beta", expectedOpenRun: "run-1" }),
      );
      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({ reason: "stale", openRun: "run-2" });
      expect(store.index()?.runs).toHaveLength(2);
      const malformed = await rollover(
        await rolloverRequest(ADDRESS, { action: "rollover", label: "Again", environment: "beta", expectedOpenRun: "latest" }),
      );
      expect(malformed.status).toBe(400);
    });
  });

  it("rejects a cross-origin, signed-out, or malformed rollover without touching the store", async () => {
    const store = legacyStore();
    await withConfig([ADDRESS], async () => {
      const body = { action: "rollover", label: "Re-QA", environment: "beta" };
      expect((await rollover(await rolloverRequest(ADDRESS, body, "https://evil.greengoods.app"))).status).toBe(403);
      const signedOut = new Request(`${ORIGIN}/api/runs`, {
        method: "POST",
        headers: { origin: ORIGIN },
        body: JSON.stringify(body),
      });
      expect((await rollover(signedOut)).status).toBe(401);
      expect((await rollover(await rolloverRequest(ADDRESS, { ...body, label: "   " }))).status).toBe(400);
      expect((await rollover(await rolloverRequest(ADDRESS, { ...body, environment: "staging" }))).status).toBe(400);
      expect((await rollover(await rolloverRequest(ADDRESS, { ...body, builds: { client: "main" } }))).status).toBe(400);
      expect((await rollover(await rolloverRequest(ADDRESS, { action: "close" }))).status).toBe(400);
      expect(store.puts.filter((write) => write.pathname === RUN_INDEX_PATH && write.options.ifMatch)).toHaveLength(0);
    });
  });
});

describe("QA app Blob writes", () => {
  beforeEach(() => {
    blob.get.mockReset();
    blob.put.mockReset();
  });

  it("merges two first writers instead of letting a later create erase the first", async () => {
    let stored: StoredBlob | null = null;
    let etag = 0;
    let initialReads = 0;
    let releaseInitialReads = () => {};
    const bothInitialReadsStarted = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });

    blob.get.mockImplementation(async () => {
      if (!stored && initialReads < 2) {
        initialReads++;
        if (initialReads === 2) releaseInitialReads();
        await bothInitialReadsStarted;
        return null;
      }
      if (!stored) return null;
      return { statusCode: 200, stream: stored.body, blob: { etag: stored.etag } };
    });

    blob.put.mockImplementation(async (_pathname, body, options) => {
      if (options.allowOverwrite === false && stored) throw new Error("pathname already exists");
      if (options.ifMatch && options.ifMatch !== stored?.etag) throw new BlobPreconditionFailedError("etag mismatch");
      stored = { body: String(body), etag: `etag-${++etag}` };
      return {};
    });

    const [phone, laptop] = await Promise.all([
      applyDelta(ADDRESS, { "PUB-001": { s: "pass" } }, "Afo", "run-2"),
      applyDelta(ADDRESS, { "PUB-002": { n: "laptop note" } }, "Afo", "run-2"),
    ]);

    expect(phone.entries).toHaveProperty("PUB-001");
    expect(laptop.entries).toHaveProperty("PUB-002");
    expect(JSON.parse(stored?.body ?? "{}").entries).toMatchObject({
      "PUB-001": { s: "pass" },
      "PUB-002": { n: "laptop note" },
    });
    expect(blob.put.mock.calls.every((call) => call[0] === runShardPath("run-2", ADDRESS))).toBe(true);
    expect(blob.put.mock.calls.slice(0, 2).every((call) => call[2].allowOverwrite === false)).toBe(true);
    expect(blob.put.mock.calls.some((call) => call[2].allowOverwrite === true && call[2].ifMatch)).toBe(true);
  });
});

describe("shard shape validation", () => {
  const entry = { s: "pass", n: "", at: "2026-08-30T10:00:00.000Z" };
  const shard = (overrides: Record<string, unknown> = {}) => ({
    address: ADDRESS,
    person: "Afo",
    updatedAt: "2026-08-30T10:00:00.000Z",
    entries: {},
    ...overrides,
  });

  it("accepts a shard this endpoint can vouch for", () => {
    expect(shardShapeError(ADDRESS, shard({ entries: { "PUB-001": entry } }))).toBeNull();
    expect(shardShapeError(ADDRESS, shard())).toBeNull();
    // A note with no verdict yet is a legitimate in-progress entry.
    expect(
      shardShapeError(ADDRESS, shard({ entries: { "PUB-001": { ...entry, s: "" } } })),
    ).toBeNull();
  });

  it("rejects a malformed entry rather than serving it to the checklist", () => {
    // GET hands what it read straight to the page, which reads `e.s` off it —
    // one bad entry took the board down for everyone in a live session.
    expect(shardShapeError(ADDRESS, shard({ entries: { "PUB-001": null } }))).toMatch(
      /PUB-001 is not an object/,
    );
    expect(shardShapeError(ADDRESS, shard({ entries: { "PUB-001": { n: "x", at: "t" } } }))).toMatch(
      /PUB-001 has no valid status/,
    );
    expect(
      shardShapeError(ADDRESS, shard({ entries: { "PUB-001": { ...entry, s: "maybe" } } })),
    ).toMatch(/PUB-001 has no valid status/);
    expect(shardShapeError(ADDRESS, shard({ entries: { "PUB-001": { s: "pass", at: "t" } } }))).toMatch(
      /PUB-001 has no valid note/,
    );
    expect(shardShapeError(ADDRESS, shard({ entries: { "PUB-001": { s: "pass", n: "" } } }))).toMatch(
      /PUB-001 has no valid timestamp/,
    );
  });

  it("rejects a shard that is not one, or is filed under the wrong owner", () => {
    expect(shardShapeError(ADDRESS, null)).toMatch(/not an object/);
    expect(shardShapeError(ADDRESS, [])).toMatch(/not an object/);
    expect(shardShapeError(ADDRESS, shard({ address: OTHER_ADDRESS }))).toMatch(/owner as/);
    // A display name is a label; it can never make a shard belong to someone else.
    expect(shardShapeError(ADDRESS, shard({ person: "Gui" }))).toBeNull();
    expect(shardShapeError(ADDRESS, shard({ person: 42 }))).toMatch(/display name/);
    expect(shardShapeError(ADDRESS, shard({ updatedAt: "not-a-date" }))).toMatch(/update timestamp/);
    expect(shardShapeError(ADDRESS, shard({ entries: null }))).toMatch(/no entries object/);
    expect(shardShapeError(ADDRESS, shard({ entries: [] }))).toMatch(/no entries object/);
  });

  it("does not write a case id the shard reader would later reject", () => {
    const delta = sanitizeDelta({ "": { s: "pass" } });
    expect(Object.keys(delta)).toEqual([]);
    expect(shardShapeError(ADDRESS, shard({ entries: mergeDelta({}, delta) }))).toBeNull();
  });
});

describe("display labels", () => {
  it("uses a saved name everywhere and falls back only for unnamed addresses", () => {
    expect(
      displayLabels([
        { address: ADDRESS, person: "Afo" },
        { address: OTHER_ADDRESS, person: "" },
      ]),
    ).toEqual(["Afo", "0x2268…6b56"]);
  });

  it("keeps same-name address shards distinct", () => {
    const labels = displayLabels([
      { address: ADDRESS, person: "Afo" },
      { address: OTHER_ADDRESS, person: "afo" },
    ]);
    expect(new Set(labels.map((label) => label.toLowerCase())).size).toBe(2);
    expect(labels.every((label) => label.includes("…"))).toBe(true);
  });
});
