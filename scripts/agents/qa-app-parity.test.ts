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
import { mergeDelta as mergeLocal, sanitizeDelta as sanitizeLocal } from "../../packages/qa/dev.mjs";

const EARLIER = "2026-08-30T10:00:00.000Z";
const LATER = "2026-08-30T11:00:00.000Z";

const entry = (s: string, n: string, at = LATER) => ({ s, n, at });

const SANITIZE_CASES: Array<[string, unknown]> = [
  ["a normal verdict and note", { "PUB-001": entry("pass", "looks right") }],
  ["a tombstone (tester cleared the case)", { "PUB-001": entry("", "") }],
  ["an unknown status", { "PUB-001": entry("maybe", "note") }],
  ["a non-object entry", { "PUB-001": "nope" }],
  ["an over-long case id", { ["X".repeat(80)]: entry("pass", "note") }],
  ["a missing timestamp", { "PUB-001": { s: "fail", n: "no at" } }],
  ["a null payload", null],
];

const MERGE_CASES: Array<[string, Record<string, ReturnType<typeof entry>>, Record<string, ReturnType<typeof entry>>]> = [
  ["adds a new case", { "PUB-001": entry("pass", "a") }, { "PUB-002": entry("fail", "b") }],
  ["newer write wins", { "PUB-001": entry("pass", "old", EARLIER) }, { "PUB-001": entry("fail", "new", LATER) }],
  ["older write is ignored", { "PUB-001": entry("fail", "new", LATER) }, { "PUB-001": entry("pass", "stale", EARLIER) }],
  ["a tombstone deletes", { "PUB-001": entry("pass", "a", EARLIER) }, { "PUB-001": entry("", "", LATER) }],
  ["a stale tombstone does not delete", { "PUB-001": entry("pass", "a", LATER) }, { "PUB-001": entry("", "", EARLIER) }],
];

describe("QA app merge rules — deployed function vs local server", () => {
  it.each(SANITIZE_CASES)("sanitizeDelta agrees on %s", (_label, payload) => {
    expect(sanitizeLocal(payload)).toEqual(sanitizeDeployed(payload));
  });

  it.each(MERGE_CASES)("mergeDelta agrees when it %s", (_label, existing, delta) => {
    expect(mergeLocal(existing, delta)).toEqual(mergeDeployed(existing, delta));
  });

  it("both treat a tombstone as a delete, not an empty entry", () => {
    const existing = { "PUB-001": entry("pass", "recorded", EARLIER) };
    const delta = { "PUB-001": entry("", "", LATER) };
    expect(mergeDeployed(existing, delta)).toEqual({});
    expect(mergeLocal(existing, delta)).toEqual({});
  });

  it("both keep an untouched case when a delta names only another", () => {
    // The delta contract: a save must never imply anything about cases it omits.
    const existing = { "PUB-001": entry("pass", "keep me", EARLIER) };
    const delta = { "PUB-002": entry("fail", "new", LATER) };
    expect(Object.keys(mergeDeployed(existing, delta)).sort()).toEqual(["PUB-001", "PUB-002"]);
    expect(mergeLocal(existing, delta)).toEqual(mergeDeployed(existing, delta));
  });
});
