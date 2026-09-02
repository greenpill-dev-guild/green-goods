import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildReportModel, parseArgs, parseWindow, renderReport, resultsNotes, runReport } from "./qa-report";
import { mergeShards, type Shard } from "./qa-state";
import type { Catalog, CatalogCase } from "./qa-workbook-build";

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
// The snapshot must postdate the window, or the report clamps the window to the pull time.
const PULLED_AT = "2026-09-02T19:40:00.000Z";
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

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT });

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

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT });

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

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT });

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

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT });

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

    const model = buildReportModel(cases, merged, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT });

    expect(model.testers).toEqual({
      count: 2,
      perPerson: { Afo: { touched: 2, decided: 1 }, Gui: { touched: 1, decided: 1 } },
    });
  });
});

const KINDS = [
  { id: "journey", label: "Journey", verifies: "A person completes a flow" },
  { id: "transaction", label: "Transaction", verifies: "Real wallet writes" },
  { id: "content", label: "Content & vocabulary", verifies: "Copy holds" },
];

function model(cases: CatalogCase[], shards: Shard[], extra: Partial<Parameters<typeof buildReportModel>[2]> = {}) {
  return buildReportModel(cases, mergeShards(shards), { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT, ...extra });
}

describe("QA report rendering", () => {
  it("renders the parent template's results line shape and drops zero segments", () => {
    const p0 = ["pass", "pass", "pass", "fail", "blocked", "", ""];
    const p1 = ["pass", "fail", "blocked", "na", "note", "", "", "", ""];
    const cases = [
      ...p0.map((_, index) => makeCase({ id: `PUB-00${index + 1}`, priority: "P0" })),
      ...p1.map((_, index) => makeCase({ id: `PUB-10${index + 1}`, priority: "P1" })),
      makeCase({ id: "PUB-201", priority: "P2" }),
      makeCase({ id: "PUB-202", priority: "P2" }),
    ];
    const entries: Record<string, { s: string; n: string; at: string }> = {};
    p0.forEach((status, index) => {
      if (status) entries[`PUB-00${index + 1}`] = { s: status, n: "", at: IN_WINDOW };
    });
    p1.forEach((status, index) => {
      if (status === "note") entries[`PUB-10${index + 1}`] = { s: "", n: "seen", at: IN_WINDOW };
      else if (status) entries[`PUB-10${index + 1}`] = { s: status, n: "", at: IN_WINDOW };
    });

    const report = renderReport(model(cases, [shard("Afo", entries)]), { kinds: KINDS }, { variant: "private" });

    expect(report).toContain(
      "## Results by priority\n- P0: 5/7 — 3 pass · 1 fail · 1 blocked\n- P1: 5/9 — 1 pass · 1 fail · 1 blocked · 1 n/a · 1 noted only\n- P2: 0/2\n",
    );
  });

  it("labels kinds from the catalog, in catalog order", () => {
    const cases = [
      makeCase({ id: "PUB-001", kind: "content" }),
      makeCase({ id: "PUB-002", kind: "journey", priority: "P1" }),
      makeCase({ id: "PUB-003", kind: "transaction", priority: "P2" }),
    ];
    const report = renderReport(
      model(cases, [shard("Afo", { "PUB-001": { s: "pass", n: "", at: IN_WINDOW }, "PUB-002": { s: "fail", n: "", at: IN_WINDOW } })]),
      { kinds: KINDS },
      { variant: "public" },
    );

    expect(report).toContain("## Results by kind\n- Journey: 1/1 — 1 fail\n- Transaction: 0/1\n- Content & vocabulary: 1/1 — 1 pass\n");
  });

  it("keeps notes and testers private, and lets no label, note, or address into the public variant", () => {
    const cases = [makeCase({ area: "Garden Discovery" }), makeCase({ id: "PUB-002" })];
    const shards: Shard[] = [
      shard("Afo", { "PUB-001": { s: "fail", n: "wallet 0xdeadbeef prompted twice", at: IN_WINDOW } }),
      { address: "0x1234567890abcdef1234567890abcdef12345678", entries: { "PUB-002": { s: "pass", n: "", at: IN_WINDOW } } },
    ];

    const privateReport = renderReport(model(cases, shards), { kinds: KINDS }, { variant: "private" });
    const publicReport = renderReport(model(cases, shards), { kinds: KINDS }, { variant: "public" });

    expect(privateReport).toContain("- `PUB-001` · P0 · Journey · Garden Discovery — Fail — Afo: wallet 0xdeadbeef prompted twice");
    expect(privateReport).toContain("- Afo: 1 touched · 1 decided");
    expect(privateReport).toContain("- 0x1234…5678: 1 touched · 1 decided");
    expect(publicReport).toContain("- `PUB-001` · P0 · Journey · Garden Discovery — Fail\n");
    expect(publicReport).toContain("## Testers\n- 2 testers\n");
    for (const secret of ["Afo", "0x", "prompted twice"]) expect(publicReport).not.toContain(secret);
  });
});

describe("QA report delta and gaps", () => {
  it("compares standing verdicts against a previous snapshot and reports unknown ids", () => {
    const cases = ["PUB-001", "PUB-002", "PUB-003", "PUB-004", "PUB-005"].map((id) => makeCase({ id }));
    const previous = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "fail", n: "", at: BEFORE_WINDOW },
        "PUB-002": { s: "pass", n: "", at: BEFORE_WINDOW },
        "PUB-003": { s: "blocked", n: "", at: BEFORE_WINDOW },
        "PUB-004": { s: "fail", n: "", at: BEFORE_WINDOW },
        "XPLAT-001": { s: "fail", n: "", at: BEFORE_WINDOW },
      }),
    ]);
    const current = [
      shard("Afo", {
        "PUB-001": { s: "pass", n: "", at: IN_WINDOW },
        "PUB-002": { s: "fail", n: "", at: IN_WINDOW },
        "PUB-003": { s: "blocked", n: "", at: BEFORE_WINDOW },
        "PUB-004": { s: "fail", n: "", at: IN_WINDOW },
        "PUB-005": { s: "blocked", n: "", at: IN_WINDOW },
      }),
    ];
    const baseline = "tmp/qa-session/2026-08-31/qa-state.json";

    const built = model(cases, current, { previous: { path: baseline, entries: previous } });

    expect(built.delta).toEqual({
      baseline,
      newlyFailing: ["PUB-002"],
      newlyBlocked: ["PUB-005"],
      fixed: ["PUB-001"],
      stillFailing: ["PUB-004"],
      stillBlocked: ["PUB-003"],
      cleared: [],
      unknown: ["XPLAT-001"],
    });
    // The path and unknown ids are private detail; the public variant withholds them.
    const report = renderReport(built, { kinds: KINDS }, { variant: "private" });
    expect(report).toContain(`## Delta vs ${baseline}\n`);
    expect(report).toContain("- Fixed (1): `PUB-001`\n");
    expect(report).toContain("- Unknown or retired on one side (1): `XPLAT-001`\n");
  });

  it("names the missing baseline instead of faking a delta", () => {
    const report = renderReport(model([makeCase()], []), { kinds: KINDS }, { variant: "public" });
    expect(report).toContain("## Delta\n- No baseline supplied — pass --previous <earlier qa-state.json> to compare.\n");
  });

  it("groups never-walked cases by priority and measures staleness from the window end", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003", priority: "P1" })];
    const built = model(
      cases,
      [shard("Afo", { "PUB-001": { s: "pass", n: "", at: IN_WINDOW }, "PUB-002": { s: "pass", n: "", at: "2026-07-01T12:00:00.000Z" } })],
      { staleDays: 30 },
    );

    expect(built.gaps).toEqual({
      neverWalked: { P0: ["PUB-002"], P1: ["PUB-003"] },
      stale: [{ id: "PUB-002", lastEntryAt: "2026-07-01T12:00:00.000Z" }],
    });
    const report = renderReport(built, { kinds: KINDS }, { variant: "public" });
    expect(report).toContain("## Coverage gaps\n- Never walked this session: P0 (1) · P1 (1)\n- P0 not walked: `PUB-002`\n");
    expect(report).toContain("- Stale (>30 days by entry timestamp) (1): `PUB-002` — last entry 2026-07-01T12:00:00.000Z\n");
  });
});

describe("QA report CLI", () => {
  it("parses the full flag set", () => {
    expect(
      parseArgs([
        "--slug", "2026-09-02",
        "--window", "2026-09-02T17:45:00Z..2026-09-02T19:30:00Z",
        "--previous", "tmp/qa-session/2026-08-31/qa-state.json",
        "--build", "client=abc1234,admin=def5678",
        "--public",
        "--stale-days", "14",
        "--out", "tmp/qa-session/2026-09-02-call",
      ]),
    ).toEqual({
      slug: "2026-09-02",
      window: "2026-09-02T17:45:00Z..2026-09-02T19:30:00Z",
      previous: "tmp/qa-session/2026-08-31/qa-state.json",
      build: { client: "abc1234", admin: "def5678" },
      public: true,
      staleDays: 14,
      out: "tmp/qa-session/2026-09-02-call",
    });
    expect(parseArgs(["--slug", "2026-09-02"])).toEqual({ slug: "2026-09-02", public: false, staleDays: 30 });
  });

  it("rejects unknown flags, missing values, and malformed values before any file is touched", () => {
    expect(() => parseArgs([])).toThrow(/--slug/);
    expect(() => parseArgs(["--slug"])).toThrow(/missing value/);
    expect(() => parseArgs(["--slug", "2026-09-02", "--bogus"])).toThrow(/unknown argument/);
    expect(() => parseArgs(["--slug", "2026-09-02", "--stale-days", "0"])).toThrow(/--stale-days/);
    expect(() => parseArgs(["--slug", "2026-09-02", "--build", "web=abc"])).toThrow(/--build/);
  });

  it("writes report.md and, with --public, report.public.md beside the pulled session", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "qa-report-"));
    const sessionDir = path.join(root, "tmp", "qa-session", SLUG);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      path.join(sessionDir, "qa-state.json"),
      JSON.stringify({
        slug: SLUG,
        pulledAt: PULLED_AT,
        summary: {},
        entries: { "PUB-001": { Afo: { s: "fail", n: "PRIVATE NOTE CANARY", at: IN_WINDOW } } },
      }),
    );
    const catalog: Catalog = {
      version: 2,
      tabs: ["Public Website"],
      kinds: KINDS,
      statuses: [],
      cases: [makeCase(), makeCase({ id: "XPLAT-001", status: "retired" })],
    };

    const written = await runReport(parseArgs(["--slug", SLUG, "--window", "2026-09-02T17:45:00Z..2026-09-02T19:30:00Z", "--public"]), { catalog, repoRoot: root });

    expect(written).toEqual({ report: path.join(sessionDir, "report.md"), publicReport: path.join(sessionDir, "report.public.md") });
    const privateReport = readFileSync(written.report, "utf8");
    const publicReport = readFileSync(written.publicReport as string, "utf8");
    expect(privateReport).toContain("QA session 2026-09-02");
    expect(privateReport).toContain("PRIVATE NOTE CANARY");
    expect(privateReport).toContain("- P0: 1/1 — 1 fail");
    expect(publicReport).not.toContain("PRIVATE NOTE CANARY");
    expect(publicReport).not.toContain("Afo");
  });

  it("names qa:pull when the session has not been pulled, and never echoes a malformed state file", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "qa-report-"));
    const catalog: Catalog = { version: 2, tabs: ["Public Website"], kinds: KINDS, statuses: [], cases: [makeCase()] };

    await expect(runReport(parseArgs(["--slug", "2026-09-03"]), { catalog, repoRoot: root })).rejects.toThrow(/qa:pull --slug 2026-09-03/);

    const sessionDir = path.join(root, "tmp", "qa-session", "2026-09-03");
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(path.join(sessionDir, "qa-state.json"), "{ PRIVATE_CANARY: ");
    let message = "";
    try {
      await runReport(parseArgs(["--slug", "2026-09-03"]), { catalog, repoRoot: root });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("qa-state.json is not valid JSON");
  });
});

describe("QA report review hardening", () => {
  it("rejects a window whose values carry no time zone", () => {
    expect(() => parseWindow("2026-09-02T17:45:00..2026-09-02T19:30:00", SLUG)).toThrow(/time zone/);
    expect(parseWindow("2026-09-02T17:45:00+02:00..2026-09-02T19:30:00+02:00", SLUG).start).toBe("2026-09-02T15:45:00.000Z");
  });

  it("clamps a window that outlives the snapshot and says so in both variants", () => {
    const built = buildReportModel([makeCase()], mergeShards([]), {
      slug: SLUG,
      window: WINDOW,
      pulledAt: "2026-09-02T18:30:00.000Z",
    });
    expect(built.window).toMatchObject({ end: "2026-09-02T18:30:00.000Z", clampedTo: "2026-09-02T18:30:00.000Z" });
    expect(built.windowNote).toMatch(/clamped to the pull time/);
    expect(renderReport(built, { kinds: KINDS }, { variant: "public" })).toContain("Caveat: Window end clamped");
  });

  it("reports a baseline failure that was cleared without a pass instead of dropping it", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" })];
    const previous = mergeShards([
      shard("Afo", { "PUB-001": { s: "fail", n: "", at: BEFORE_WINDOW }, "PUB-002": { s: "blocked", n: "", at: BEFORE_WINDOW } }),
    ]);
    const current = [shard("Afo", { "PUB-001": { s: "", n: "looked at it", at: IN_WINDOW }, "PUB-002": { s: "na", n: "", at: IN_WINDOW } })];

    const built = model(cases, current, { previous: { path: "tmp/qa-session/2026-08-31/qa-state.json", entries: previous } });

    expect(built.delta).toMatchObject({ fixed: [], cleared: ["PUB-001", "PUB-002"], stillFailing: [], stillBlocked: [] });
    expect(renderReport(built, { kinds: KINDS }, { variant: "public" })).toContain("- Cleared without a pass (2): `PUB-001`, `PUB-002`\n");
  });

  it("flattens multiline notes and tester names so a note cannot forge a heading", () => {
    const report = renderReport(
      model([makeCase()], [shard("Afo\nGui", { "PUB-001": { s: "fail", n: "first line\n## Forged heading\n- forged item", at: IN_WINDOW } })]),
      { kinds: KINDS },
      { variant: "private" },
    );
    expect(report).toContain("— Fail — Afo / Gui: first line / ## Forged heading / - forged item");
    expect(report).not.toMatch(/^## Forged heading$/m);
    expect(report).not.toMatch(/^- forged item$/m);
    expect(report).toContain("- Afo / Gui: 1 touched · 1 decided");
  });

  it("tallies a tester named __proto__ without touching Object.prototype", () => {
    const built = model([makeCase()], [shard("__proto__", { "PUB-001": { s: "pass", n: "", at: IN_WINDOW } })]);
    expect(built.testers.count).toBe(1);
    expect(Object.hasOwn(built.testers.perPerson, "__proto__")).toBe(true);
    expect(built.testers.perPerson.__proto__).toEqual({ touched: 1, decided: 1 });
    expect(Object.hasOwn(Object.prototype, "touched")).toBe(false);
  });

  it("withholds unknown ids and the baseline path from the public variant", () => {
    const previous = mergeShards([shard("Afo", { "0xdeadbeefcafe": { s: "fail", n: "", at: BEFORE_WINDOW } })]);
    const baseline = "/home/afo/tmp/qa-session/2026-08-31/qa-state.json";
    const built = model([makeCase()], [], { previous: { path: baseline, entries: previous } });

    const privateReport = renderReport(built, { kinds: KINDS }, { variant: "private" });
    const publicReport = renderReport(built, { kinds: KINDS }, { variant: "public" });

    expect(privateReport).toContain(`## Delta vs ${baseline}`);
    expect(privateReport).toContain("`0xdeadbeefcafe`");
    expect(publicReport).toContain("## Delta vs previous snapshot\n");
    expect(publicReport).toContain("- Unknown or retired on one side (1): withheld in the public variant\n");
    for (const secret of ["0xdeadbeef", "/home/afo"]) expect(publicReport).not.toContain(secret);
  });

  it("refuses an output directory outside the gitignored tmp/ root", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "qa-report-"));
    const catalog: Catalog = { version: 2, tabs: ["Public Website"], kinds: KINDS, statuses: [], cases: [makeCase()] };
    await expect(runReport(parseArgs(["--slug", SLUG, "--out", "/elsewhere"]), { catalog, repoRoot: root })).rejects.toThrow(/tmp\//);
    await expect(runReport(parseArgs(["--slug", SLUG, "--out", "../outside"]), { catalog, repoRoot: root })).rejects.toThrow(/tmp\//);
  });

  it("prefers results.csv notes over the raw state, so redactions hold", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "qa-report-"));
    const sessionDir = path.join(root, "tmp", "qa-session", SLUG);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      path.join(sessionDir, "qa-state.json"),
      JSON.stringify({
        slug: SLUG,
        pulledAt: "2026-09-02T19:40:00.000Z",
        summary: {},
        entries: {
          "PUB-001": { Afo: { s: "fail", n: "PRIVATE NOTE CANARY", at: IN_WINDOW } },
          "PUB-002": { Afo: { s: "fail", n: "keep me", at: IN_WINDOW } },
          "PUB-003": { Afo: { s: "blocked", n: "erase me", at: IN_WINDOW } },
        },
      }),
    );
    writeFileSync(
      path.join(sessionDir, "results.csv"),
      'Test ID,Result,Severity,Notes\nPUB-001,Fail,,"Afo: redacted, wallet removed"\nPUB-003,Blocked,,\n',
    );
    const catalog: Catalog = {
      version: 2,
      tabs: ["Public Website"],
      kinds: KINDS,
      statuses: [],
      cases: [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003" })],
    };

    const written = await runReport(parseArgs(["--slug", SLUG, "--window", "2026-09-02T17:45:00Z..2026-09-02T19:30:00Z"]), { catalog, repoRoot: root });
    const report = readFileSync(written.report, "utf8");

    expect(report).toContain("Notes: results.csv for 2 case(s)");
    expect(report).toContain("`PUB-001` · P0 · Journey · Home — Fail — Afo: redacted, wallet removed");
    expect(report).toContain("`PUB-002` · P0 · Journey · Home — Fail — Afo: keep me");
    expect(report).toContain("`PUB-003` · P0 · Journey · Home — Blocked\n");
    for (const erased of ["PRIVATE NOTE CANARY", "erase me"]) expect(report).not.toContain(erased);
  });

  it("reads our own csv shape back, including quoted newlines and formula escapes", () => {
    const notes = resultsNotes('Test ID,Result,Severity,Notes\n"PUB-001",Fail,,"line one\nline ""two"""\n\'=1+1,Pass,,\'@note\n');
    expect(notes.get("PUB-001")).toBe('line one\nline "two"');
    expect(notes.get("=1+1")).toBe("@note");
    expect(() => resultsNotes("Result,Severity\nFail,")).toThrow(/Test ID and Notes/);
  });
});

describe("QA report second-round hardening", () => {
  it("rejects an impossible slug date instead of normalizing it", () => {
    expect(() => parseWindow(undefined, "2026-02-30")).toThrow(/real YYYY-MM-DD/);
    expect(parseWindow(undefined, "2026-02-28").end).toBe("2026-02-28T23:59:59.999Z");
  });

  it("keeps an untouched results.csv cell from attributing an old note to the session", () => {
    const cases = [makeCase()];
    const entries = mergeShards([
      shard("Afo", { "PUB-001": { s: "fail", n: "in the window", at: IN_WINDOW } }),
      shard("Gui", { "PUB-001": { s: "fail", n: "from last month", at: BEFORE_WINDOW } }),
    ]);
    // What qa:pull writes into results.csv for that row: every tester, no window.
    const untouched = new Map([["PUB-001", "Afo: in the window | Gui: from last month"]]);
    const edited = new Map([["PUB-001", "Afo: redacted"]]);

    const asPulled = buildReportModel(cases, entries, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT, noteOverrides: untouched });
    const redacted = buildReportModel(cases, entries, { slug: SLUG, window: WINDOW, pulledAt: PULLED_AT, noteOverrides: edited });

    expect(asPulled.issues[0].notes).toBe("Afo: in the window");
    expect(asPulled.notesFromResults).toBe(0);
    expect(redacted.issues[0].notes).toBe("Afo: redacted");
    expect(redacted.notesFromResults).toBe(1);
  });

  it("rejects a slug or build sha that is not an identifier before it can reach a header", () => {
    expect(() => parseArgs(["--slug", "Afo's call\n## Forged"])).toThrow(/--slug must be an identifier/);
    expect(() => parseArgs(["--slug", "2026-09-02", "--build", "client=0xdeadbeef wallet"])).toThrow(/hex commit shas/);
    expect(parseArgs(["--slug", "2026-09-02-2", "--build", "client=abc1234"]).build).toEqual({ client: "abc1234" });
  });
});

describe("QA report third-round hardening", () => {
  it("keeps build shas out of the public variant", () => {
    const built = model([makeCase()], [], { build: { client: "abc1234", admin: "def5678" } });
    expect(renderReport(built, { kinds: KINDS }, { variant: "private" })).toContain("Build under test: client `abc1234` · admin `def5678`");
    const publicReport = renderReport(built, { kinds: KINDS }, { variant: "public" });
    for (const sha of ["abc1234", "def5678", "Build under test"]) expect(publicReport).not.toContain(sha);
  });

  it("never turns a prototype-named kind with no cases into a results bucket", () => {
    const kinds = [...KINDS, { id: "constructor", label: "Constructor", verifies: "nothing" }];
    const report = renderReport(model([makeCase()], []), { kinds }, { variant: "public" });
    expect(report).toContain("## Results by kind\n- Journey: 0/1\n\n");
    expect(report).not.toContain("Constructor");
  });
});
