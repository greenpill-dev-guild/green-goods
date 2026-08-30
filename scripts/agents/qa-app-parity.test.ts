import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

/**
 * The QA app's merge rules exist twice on purpose: once in the deployed Vercel
 * function (packages/qa/api/state.ts) and once in the local server
 * (packages/qa/dev.mjs), which cannot share a module without making the
 * function's bundle depend on resolution outside its deploy root.
 *
 * That duplication is only safe while the two agree. Local runs are used to
 * prove two-tester behaviour before a session; if the copies drift, a local
 * run proves something the deployment would not do. These tests are the guard.
 */

import {
  mergeDelta as mergeDeployed,
  sanitizeDelta as sanitizeDeployed,
} from "../../packages/qa/api/state";
import {
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
});

describe("local server failure parity", () => {
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
