import { describe, expect, it } from "vitest";

import { buildReportModel, parseWindow } from "./qa-report";
import { mergeShards, type Shard } from "./qa-state";
import type { CatalogCase } from "./qa-workbook-build";

function makeCase(overrides: Partial<CatalogCase> = {}): CatalogCase {
  return {
    id: "PUB-001",
    tab: "Public Website",
    platform: "Desktop Browser",
    priority: "P0",
    area: "Home",
    scenario: "Open the public home page",
    preconditions: [],
    steps: ["Open /"],
    expected: "The page is usable",
    evidence: "Screenshot",
    role: "none",
    kind: "journey",
    status: "active",
    source: "qa-report-test",
    ...overrides,
  };
}

function shard(
  person: string,
  entries: Record<string, { s: string; n: string; at: string }>,
): Shard {
  return { person, entries };
}

const SLUG = "2026-09-02";
const WINDOW = parseWindow("2026-09-02T17:45:00Z..2026-09-02T19:30:00Z", SLUG);
const IN_WINDOW = "2026-09-02T18:00:00.000Z";
const BEFORE_WINDOW = "2026-09-01T18:00:00.000Z";

function bucketSum(bucket: { pass: number; fail: number; blocked: number; na: number; noted: number }) {
  return bucket.pass + bucket.fail + bucket.blocked + bucket.na + bucket.noted;
}

describe("QA report session window", () => {
  it("defaults to the slug's UTC calendar day", () => {
    expect(parseWindow(undefined, "2026-09-02")).toEqual({
      start: "2026-09-02T00:00:00.000Z",
      end: "2026-09-02T23:59:59.999Z",
      source: "slug-day",
    });
    // A second same-day call keeps the date's day: the counter is the call's identity, not a date.
    expect(parseWindow(undefined, "2026-09-02-2").start).toBe("2026-09-02T00:00:00.000Z");
  });

  it("normalizes an explicit window and rejects a malformed or inverted one", () => {
    expect(WINDOW).toEqual({
      start: "2026-09-02T17:45:00.000Z",
      end: "2026-09-02T19:30:00.000Z",
      source: "flag",
    });
    expect(() => parseWindow("yesterday..today", SLUG)).toThrow(/--window/);
    expect(() => parseWindow("2026-09-02T19:30:00Z..2026-09-02T17:45:00Z", SLUG)).toThrow(/--window/);
  });

  it("counts only entries inside the window, inclusive at both ends", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "pass", n: "", at: WINDOW.start },
        "PUB-002": { s: "pass", n: "", at: WINDOW.end },
        "PUB-003": { s: "fail", n: "", at: "2026-09-02T19:30:01.000Z" },
      }),
    ]);

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: IN_WINDOW });

    expect(model.byPriority.P0.walked).toBe(2);
    expect(model.byPriority.P0.pass).toBe(2);
    expect(model.byPriority.P0.fail).toBe(0);
  });
});

describe("QA report buckets", () => {
  it("reconciles walked against verdicts per priority, kind, and tab", () => {
    const cases = [
      makeCase(),
      makeCase({ id: "PUB-002", kind: "transaction" }),
      makeCase({ id: "PUB-003", priority: "P1", kind: "content" }),
      makeCase({ id: "ADM-001", tab: "Admin Dashboard", priority: "P1", kind: "journey" }),
      makeCase({ id: "ADM-002", tab: "Admin Dashboard", priority: "P2", kind: "resilience" }),
    ];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "pass", n: "", at: IN_WINDOW },
        "PUB-002": { s: "blocked", n: "", at: IN_WINDOW },
        "PUB-003": { s: "", n: "looked odd but no verdict yet", at: IN_WINDOW },
        "ADM-001": { s: "na", n: "", at: IN_WINDOW },
      }),
      shard("Gui", {
        "PUB-001": { s: "fail", n: "", at: IN_WINDOW },
      }),
    ]);

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: IN_WINDOW });

    expect(model.byPriority.P0).toEqual({ total: 2, walked: 2, pass: 0, fail: 1, blocked: 1, na: 0, noted: 0 });
    expect(model.byPriority.P1).toEqual({ total: 2, walked: 2, pass: 0, fail: 0, blocked: 0, na: 1, noted: 1 });
    expect(model.byPriority.P2).toEqual({ total: 1, walked: 0, pass: 0, fail: 0, blocked: 0, na: 0, noted: 0 });
    for (const bucket of [...Object.values(model.byPriority), ...Object.values(model.byKind), ...Object.values(model.byTab)]) {
      expect(bucket.walked).toBe(bucketSum(bucket));
    }
    const kindWalked = Object.values(model.byKind).reduce((sum, bucket) => sum + bucket.walked, 0);
    const priorityWalked = Object.values(model.byPriority).reduce((sum, bucket) => sum + bucket.walked, 0);
    expect(kindWalked).toBe(priorityWalked);
    expect(model.byKind.transaction).toMatchObject({ total: 1, walked: 1, blocked: 1 });
    expect(model.byTab["Admin Dashboard"]).toMatchObject({ total: 2, walked: 1, na: 1 });
  });

  it("keeps a case touched only before the window out of the session and in standing state", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "fail", n: "", at: BEFORE_WINDOW },
        "PUB-002": { s: "blocked", n: "", at: BEFORE_WINDOW },
        "PUB-003": { s: "pass", n: "", at: BEFORE_WINDOW },
      }),
    ]);

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: IN_WINDOW });

    expect(model.byPriority.P0.walked).toBe(0);
    expect(model.standing).toEqual({ failing: ["PUB-001"], blocked: ["PUB-002"] });
    expect(model.delta).toBeNull();
  });
});

describe("QA report issues and testers", () => {
  it("lists fail and blocked cases with the session's attributed notes only", () => {
    const cases = [makeCase({ area: "Garden Discovery" }), makeCase({ id: "PUB-002", priority: "P1", kind: "transaction", area: "Funding" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "fail", n: "blank page on Safari", at: IN_WINDOW },
        "PUB-002": { s: "blocked", n: "no WETH in the QA wallet", at: IN_WINDOW },
      }),
      shard("Gui", {
        "PUB-001": { s: "pass", n: "worked for me last week", at: BEFORE_WINDOW },
      }),
    ]);

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: IN_WINDOW });

    expect(model.issues).toEqual([
      { id: "PUB-001", priority: "P0", kind: "journey", area: "Garden Discovery", verdict: "Fail", notes: "Afo: blank page on Safari" },
      { id: "PUB-002", priority: "P1", kind: "transaction", area: "Funding", verdict: "Blocked", notes: "Afo: no WETH in the QA wallet" },
    ]);
  });

  it("counts each tester's touched and decided cases inside the window", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "pass", n: "", at: IN_WINDOW },
        "PUB-002": { s: "", n: "note only", at: IN_WINDOW },
      }),
      shard("Gui", {
        "PUB-003": { s: "fail", n: "", at: IN_WINDOW },
      }),
      shard("Nansel", {
        "PUB-001": { s: "pass", n: "", at: BEFORE_WINDOW },
      }),
    ]);

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: IN_WINDOW });

    expect(model.testers).toEqual({
      count: 2,
      perPerson: { Afo: { touched: 2, decided: 1 }, Gui: { touched: 1, decided: 1 } },
    });
  });
});
