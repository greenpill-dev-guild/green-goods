import { describe, expect, it } from "vitest";

import {
  csvField,
  mergeShards,
  notesFor,
  rollupVerdict,
  summarize,
  toResultsCsv,
  type Shard,
} from "./qa-state";
import { loadCatalog, type CatalogCase } from "./qa-workbook-build";

function makeCase(overrides: Partial<CatalogCase> = {}): CatalogCase {
  return {
    id: "PUB-014",
    tab: "Public Website",
    platform: "Desktop Browser",
    priority: "P0",
    area: "Funding",
    scenario: "Donate end to end",
    preconditions: [],
    steps: ["Open /fund"],
    expected: "Two prompts complete",
    evidence: "Screenshot",
    role: "none",
    status: "active",
    source: "qa-session-2026-08-29",
    ...overrides,
  };
}

function shard(person: string, entries: Record<string, { s: string; n: string }>): Shard {
  return {
    person,
    updatedAt: "2026-08-30T10:00:00.000Z",
    entries: Object.fromEntries(
      Object.entries(entries).map(([id, e]) => [id, { ...e, at: "2026-08-30T10:00:00.000Z" }]),
    ),
  };
}

describe("mergeShards", () => {
  it("keeps BOTH testers' entries on the same case", () => {
    // The whole point of the sharded store: two people record one case and
    // neither is lost.
    const merged = mergeShards([
      shard("Afo", { "PUB-014": { s: "fail", n: "approve never fired" } }),
      shard("Gui", { "PUB-014": { s: "pass", n: "worked on Brave" } }),
    ]);
    expect(Object.keys(merged["PUB-014"]).sort()).toEqual(["Afo", "Gui"]);
    expect(merged["PUB-014"].Afo.s).toBe("fail");
    expect(merged["PUB-014"].Gui.s).toBe("pass");
  });

  it("ignores empty entries and malformed shards", () => {
    const merged = mergeShards([
      shard("Afo", { "PUB-001": { s: "", n: "   " } }),
      null,
      { person: "Gui" } as unknown as Shard,
      shard("Gui", { "PUB-002": { s: "pass", n: "" } }),
    ]);
    expect(merged["PUB-001"]).toBeUndefined();
    expect(merged["PUB-002"].Gui.s).toBe("pass");
  });
});

describe("rollupVerdict", () => {
  it("lets the most severe verdict stand when testers disagree", () => {
    const at = "2026-08-30T10:00:00.000Z";
    expect(rollupVerdict({ Afo: { s: "fail", n: "", at }, Gui: { s: "pass", n: "", at } })).toBe("Fail");
    expect(rollupVerdict({ Afo: { s: "blocked", n: "", at }, Gui: { s: "pass", n: "", at } })).toBe("Blocked");
    expect(rollupVerdict({ Afo: { s: "pass", n: "", at }, Gui: { s: "na", n: "", at } })).toBe("Pass");
  });

  it("returns empty when nobody recorded a verdict", () => {
    expect(rollupVerdict(undefined)).toBe("");
    expect(rollupVerdict({ Afo: { s: "", n: "just a note", at: "" } })).toBe("");
  });
});

describe("csvField", () => {
  it("quotes the punctuation dictated notes are full of", () => {
    // Real session notes are long prose with commas and quotes — an unquoted
    // field here would shift every later column.
    expect(csvField("plain")).toBe("plain");
    expect(csvField("footer becomes short, gap below")).toBe('"footer becomes short, gap below"');
    expect(csvField('he said "broken"')).toBe('"he said ""broken"""');
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("toResultsCsv", () => {
  it("emits the qa-session columns and attributes both testers' notes", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002", priority: "P1" })];
    const merged = mergeShards([
      shard("Afo", { "PUB-014": { s: "fail", n: "approve never fired, card stuck" } }),
      shard("Gui", { "PUB-014": { s: "pass", n: "fine on Brave" } }),
    ]);
    const csv = toResultsCsv(cases, merged);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Test ID,Result,Severity,Notes");
    expect(lines[1]).toBe('PUB-014,Fail,P0,"Afo: approve never fired, card stuck | Gui: fine on Brave"');
    // An untouched case is not a result.
    expect(csv).not.toContain("PUB-002");
  });

  it("surfaces a recorded case that is no longer in the catalog", () => {
    const csv = toResultsCsv([makeCase()], mergeShards([shard("Afo", { "GONE-001": { s: "pass", n: "" } })]));
    expect(csv).toContain("GONE-001");
    expect(csv).toContain("UNKNOWN CASE");
  });

  it("leaves severity blank for passing rows, and the note empty when nobody wrote one", () => {
    const csv = toResultsCsv([makeCase()], mergeShards([shard("Afo", { "PUB-014": { s: "pass", n: "" } })]));
    expect(csv.trim().split("\n")[1]).toBe("PUB-014,Pass,,");
  });
});

describe("notesFor", () => {
  it("keeps disagreement visible instead of collapsing it", () => {
    const at = "2026-08-30T10:00:00.000Z";
    expect(notesFor({ Afo: { s: "fail", n: "broken", at }, Gui: { s: "pass", n: "fine", at } })).toBe(
      "Afo: broken | Gui: fine",
    );
  });
});

describe("summarize", () => {
  it("counts per tester and rolls up the run", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" }), makeCase({ id: "PUB-003" })];
    const merged = mergeShards([
      shard("Afo", { "PUB-014": { s: "fail", n: "" }, "PUB-002": { s: "pass", n: "" } }),
      shard("Gui", { "PUB-014": { s: "pass", n: "" } }),
    ]);
    const summary = summarize(cases, merged);
    expect(summary).toMatchObject({ total: 3, recorded: 2, untouched: 1, fail: 1, pass: 1 });
    // The buckets must reconcile, or a receipt silently loses cases.
    expect(summary.pass + summary.fail + summary.blocked + summary.na + summary.noVerdict).toBe(
      summary.recorded,
    );
    expect(summary.perPerson).toMatchObject({ Afo: 2, Gui: 1, Nansel: 0 });
  });
});

describe("the real catalog", () => {
  it("projects a run sheet over live case definitions", async () => {
    const catalog = await loadCatalog();
    const active = catalog.cases.filter((testCase) => testCase.status !== "retired");
    const merged = mergeShards([shard("Afo", { [active[0].id]: { s: "pass", n: "walked it" } })]);
    const csv = toResultsCsv(active, merged);
    expect(csv).toContain(`${active[0].id},Pass,,Afo: walked it`);
    expect(csv).not.toContain("UNKNOWN CASE");
  });
});
