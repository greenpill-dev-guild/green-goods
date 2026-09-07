import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

/**
 * The QA app's merge rules exist twice on purpose: once in the deployed Vercel
 * function (packages/qa/api/state.ts) and once in the local server
 * (packages/qa/dev.mjs), which cannot share a module without making the
 * function's bundle depend on resolution outside its deploy root. (The run
 * lifecycle IS shared — both import packages/qa/runs.ts — so only the store
 * and the merge rules are duplicated.)
 *
 * That duplication is only safe while the two agree. Local runs are used to
 * prove two-tester behaviour before a session; if the copies drift, a local
 * run proves something the deployment would not do. These tests are the guard.
 */

// dev.mjs resolves its state directory when it loads, so point it at a
// throwaway directory before the import below runs (vi.hoisted runs first).
const devStateDir = vi.hoisted(() => {
  const dir = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "qa-dev-parity-"));
  process.env.QA_DEV_STATE_DIR = dir;
  return dir;
});

import {
  displayLabels as displayDeployed,
  mergeDelta as mergeDeployed,
  sanitizeDelta as sanitizeDeployed,
} from "../../packages/qa/api/state";
import { displayLabels as displayPulled } from "./qa-state";
import {
  devAddress,
  handleRuns,
  handleState,
  mergeDelta as mergeLocal,
  sanitizeDelta as sanitizeLocal,
} from "../../packages/qa/dev.mjs";

const EARLIER = "2026-08-30T10:00:00.000Z";
const LATER = "2026-08-30T11:00:00.000Z";
/** The instant the server "receives" a write in these tests. */
const STAMP = "2026-08-30T12:00:00.000Z";

const entry = (s: string, n: string, at = LATER) => ({ s, n, at });
type Entry = ReturnType<typeof entry>;
type EntryPatch = { s?: string; n?: string; delete?: true };

const SANITIZE_CASES: Array<[string, unknown]> = [
  ["a normal verdict and note", { "PUB-001": entry("pass", "looks right") }],
  ["a status-only patch", { "PUB-001": { s: "pass" } }],
  ["a note-only patch", { "PUB-001": { n: "looks right" } }],
  ["an explicit delete", { "PUB-001": { delete: true } }],
  ["a legacy tombstone", { "PUB-001": entry("", "") }],
  ["an unknown status", { "PUB-001": entry("maybe", "note") }],
  ["a non-object entry", { "PUB-001": "nope" }],
  ["an empty case id", { "": entry("pass", "note") }],
  ["an over-long case id", { ["X".repeat(80)]: entry("pass", "note") }],
  ["a missing timestamp", { "PUB-001": { s: "fail", n: "no at" } }],
  ["a null payload", null],
];

const MERGE_CASES: Array<[string, Record<string, Entry>, Record<string, EntryPatch>]> = [
  ["adds a new case", { "PUB-001": entry("pass", "a") }, { "PUB-002": { s: "fail", n: "b" } }],
  ["the arriving status wins", { "PUB-001": entry("pass", "old", EARLIER) }, { "PUB-001": { s: "fail" } }],
  ["a status patch preserves the note", { "PUB-001": entry("pass", "phone note", EARLIER) }, { "PUB-001": { s: "fail" } }],
  ["a note patch preserves the status", { "PUB-001": entry("pass", "old", EARLIER) }, { "PUB-001": { n: "laptop note" } }],
  ["clearing status preserves a concurrent note", { "PUB-001": entry("pass", "laptop note", EARLIER) }, { "PUB-001": { s: "" } }],
  ["clearing the final field removes the empty case", { "PUB-001": entry("pass", "", EARLIER) }, { "PUB-001": { s: "" } }],
  ["an explicit delete removes the case", { "PUB-001": entry("pass", "a", EARLIER) }, { "PUB-001": { delete: true } }],
];

describe("QA app merge rules — deployed function vs local server", () => {
  it.each(SANITIZE_CASES)("sanitizeDelta agrees on %s", (_label, payload) => {
    expect(sanitizeLocal(payload)).toEqual(sanitizeDeployed(payload));
  });

  it("rejects an empty case id and safely retains a prototype-shaped id", () => {
    expect(Object.keys(sanitizeDeployed({ "": { s: "pass" } }))).toEqual([]);
    expect(Object.keys(sanitizeLocal({ "": { s: "pass" } }))).toEqual([]);

    const prototypeCase = JSON.parse('{"__proto__":{"s":"pass"}}');
    expect(Object.keys(sanitizeDeployed(prototypeCase))).toEqual(["__proto__"]);
    expect(Object.keys(sanitizeLocal(prototypeCase))).toEqual(["__proto__"]);
  });

  it.each(MERGE_CASES)("mergeDelta agrees when it %s", (_label, existing, delta) => {
    // Both stamp arrival time; pass the same instant so the comparison is of
    // the merge rules and not of two clock reads a millisecond apart.
    expect(mergeLocal(existing, delta, STAMP)).toEqual(mergeDeployed(existing, delta, STAMP));
  });

  it("both restamp a written entry with arrival time, discarding the client's", () => {
    const existing = {};
    const delta = { "PUB-001": { s: "pass", n: "typed on a skewed laptop" } };
    expect(mergeDeployed(existing, delta, STAMP)["PUB-001"].at).toBe(STAMP);
    expect(mergeLocal(existing, delta, STAMP)["PUB-001"].at).toBe(STAMP);
  });

  it("both treat an explicit delete as removal, not an empty entry", () => {
    const existing = { "PUB-001": entry("pass", "recorded", EARLIER) };
    const delta = { "PUB-001": { delete: true as const } };
    expect(mergeDeployed(existing, delta, STAMP)).toEqual({});
    expect(mergeLocal(existing, delta, STAMP)).toEqual({});
  });

  it("both keep an untouched case when a delta names only another", () => {
    // The delta contract: a save must never imply anything about cases it omits.
    const existing = { "PUB-001": entry("pass", "keep me", EARLIER) };
    const delta = { "PUB-002": { s: "fail", n: "new" } };
    expect(Object.keys(mergeDeployed(existing, delta, STAMP)).sort()).toEqual(["PUB-001", "PUB-002"]);
    expect(mergeLocal(existing, delta, STAMP)).toEqual(mergeDeployed(existing, delta, STAMP));
  });

  it("keeps a phone verdict and laptop note regardless of arrival order", () => {
    const phoneFirst = mergeDeployed(
      mergeDeployed({}, { "PUB-001": { s: "pass" } }, EARLIER),
      { "PUB-001": { n: "laptop note" } },
      LATER,
    );
    const laptopFirst = mergeDeployed(
      mergeDeployed({}, { "PUB-001": { n: "laptop note" } }, EARLIER),
      { "PUB-001": { s: "pass" } },
      LATER,
    );
    expect(phoneFirst["PUB-001"]).toMatchObject({ s: "pass", n: "laptop note" });
    expect(laptopFirst["PUB-001"]).toMatchObject({ s: "pass", n: "laptop note" });
  });

  it("converts the previous page's empty-entry tombstone into an explicit delete", () => {
    expect(sanitizeDeployed({ "PUB-001": entry("", "", EARLIER) })).toEqual({
      "PUB-001": { delete: true },
    });
  });

  it("disambiguates colliding display names the same way in the app and pull", () => {
    const shards = [
      { address: "0x2aa64e6d80390f5c017f0313cb908051be2fd35e", person: "Afo" },
      { address: "0x22682c3d3848294ff9bcbf3f0ddf48a605446b56", person: "afo" },
    ];
    expect(displayDeployed(shards)).toEqual(displayPulled(shards));
    expect(new Set(displayDeployed(shards).map((label) => label.toLowerCase())).size).toBe(2);
  });
});

function fakeResponse() {
  return {
    status: 0,
    body: "",
    writeHead(status: number) {
      this.status = status;
    },
    end(payload: string) {
      this.body = payload ?? "";
    },
  };
}

/** A request the local handlers can read: method, url, optional cookie, optional JSON body. */
function localRequest(method: string, url: string, body?: unknown, person = "Afo") {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as Parameters<
    typeof handleState
  >[0] & { method: string; url: string; headers: Record<string, string> };
  request.method = method;
  request.url = `${url}${url.includes("?") ? "&" : "?"}as=${person}`;
  request.headers = {};
  return request;
}

async function call(handler: typeof handleState, request: ReturnType<typeof localRequest>) {
  const response = fakeResponse();
  await handler(request, response as unknown as Parameters<typeof handleState>[1]);
  return { status: response.status, body: JSON.parse(response.body) };
}

describe("local server run lifecycle parity", () => {
  it("migrates tmp/qa shards into an open Run 1, rolls over, refuses the closed run, and carries names", async () => {
    // A pre-runs local store: one shard per tester directly under the state dir.
    const legacy = {
      person: "Afo",
      updatedAt: "2026-09-04T22:00:00.000Z",
      entries: { "PWA-021": { s: "fail", n: "request to join not visible", at: "2026-09-04T19:10:00.000Z" } },
    };
    writeFileSync(path.join(devStateDir, "Afo.json"), `${JSON.stringify(legacy, null, 2)}\n`);

    const first = await call(handleState, localRequest("GET", "/api/state"));
    expect(first.status).toBe(200);
    expect(Object.keys(first.body).sort()).toEqual(
      ["address", "entries", "named", "openRun", "readAt", "run", "runs", "team", "you"].sort(),
    );
    expect(first.body.openRun).toBe("run-1");
    expect(first.body.runs[0]).toMatchObject({ id: "run-1", legacy: true, openedAt: "2026-09-04T19:10:00.000Z" });
    expect(first.body.entries["PWA-021"].Afo.s).toBe("fail");
    // The legacy file is untouched; Run 1 holds a byte-identical copy.
    expect(readFileSync(path.join(devStateDir, "runs", "run-1", "Afo.json"), "utf8")).toBe(
      readFileSync(path.join(devStateDir, "Afo.json"), "utf8"),
    );

    const refusedShape = await call(handleRuns, localRequest("POST", "/api/runs", { action: "rollover", label: " " }));
    expect(refusedShape.status).toBe(400);

    const rolled = await call(
      handleRuns,
      localRequest("POST", "/api/runs", { action: "rollover", label: "Re-QA 2026-09-08", environment: "beta" }, "Gui"),
    );
    expect(rolled.status).toBe(200);
    expect(rolled.body.closed).toMatchObject({ id: "run-1", closedBy: devAddress("Gui") });
    expect(rolled.body.opened).toMatchObject({ id: "run-2", openedBy: devAddress("Gui"), environment: "beta" });
    // Names carry into the new run as empty shards, like the deployed function.
    expect(existsSync(path.join(devStateDir, "runs", "run-2", "Afo.json"))).toBe(true);

    const closed = await call(
      handleState,
      localRequest("POST", "/api/state", { run: "run-1", entries: { "PWA-021": { s: "pass" } } }),
    );
    expect(closed.status).toBe(409);
    expect(closed.body).toMatchObject({ reason: "closed", openRun: "run-2" });

    const open = await call(
      handleState,
      localRequest("POST", "/api/state", { run: "run-2", entries: { "PWA-021": { s: "pass" } } }),
    );
    expect(open.body).toMatchObject({ ok: true, run: "run-2" });

    const compared = await call(handleState, localRequest("GET", "/api/state?run=run-1"));
    expect(compared.body.run).toBe("run-1");
    expect(compared.body.entries["PWA-021"].Afo.s).toBe("fail");
    expect(compared.body.runs.map((run: { id: string; closedByLabel: string | null }) => [run.id, run.closedByLabel])).toEqual([
      ["run-1", "Gui"],
      ["run-2", null],
    ]);
  });
});

describe("local server failure parity", () => {

  it("answers an unreadable request instead of taking the rehearsal server down", async () => {
    // `createServer` ignores the promise handleState returns, so a rejection
    // escaping it is an unhandled rejection — which ends the process on current
    // Node and drops a live QA session. The deployed function answers 503 here;
    // the local server has to do the same, so this must RESOLVE.
    const request = Readable.from(
      (async function* () {
        throw new Error("client aborted mid-body");
      })(),
    ) as unknown as Parameters<typeof handleState>[0];
    request.method = "POST";

    const response = fakeResponse();
    await handleState(request, response as unknown as Parameters<typeof handleState>[1]);

    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: "the request could not be read" });
  });
});
