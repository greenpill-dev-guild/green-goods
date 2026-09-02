import { describe, expect, it } from "vitest";

import { mergeShards, summarize, type Shard } from "./qa-state";
import {
  buildStatusReport,
  findStaleCases,
  parseIssueMap,
} from "./qa-status";
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
    source: "qa-status-test",
    ...overrides,
  };
}

function shard(
  person: string,
  entries: Record<string, { s: string; n: string; at: string }>,
): Shard {
  return { person, entries };
}

describe("QA status per-surface coverage", () => {
  it("breaks the standing verdict summary down by catalog tab", () => {
    const cases = [
      makeCase(),
      makeCase({ id: "PUB-002" }),
      makeCase({ id: "ADM-001", tab: "Admin Dashboard" }),
    ];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "pass", n: "", at: "2026-08-29T12:00:00.000Z" },
        "ADM-001": { s: "blocked", n: "", at: "2026-08-29T12:00:00.000Z" },
      }),
      shard("Gui", {
        "PUB-001": { s: "fail", n: "", at: "2026-08-30T12:00:00.000Z" },
      }),
    ]);

    expect(summarize(cases, merged).perTab).toEqual({
      "Public Website": {
        total: 2,
        recorded: 1,
        untouched: 1,
        noVerdict: 0,
        pass: 0,
        fail: 1,
        blocked: 0,
        na: 0,
      },
      "Admin Dashboard": {
        total: 1,
        recorded: 1,
        untouched: 0,
        noVerdict: 0,
        pass: 0,
        fail: 0,
        blocked: 1,
        na: 0,
      },
    });
  });
});

describe("QA status recency", () => {
  it("uses the newest entry timestamp for a case and a caller-supplied age", () => {
    const cases = [makeCase(), makeCase({ id: "PUB-002" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "fail", n: "", at: "2026-06-01T12:00:00.000Z" },
        "PUB-002": { s: "pass", n: "", at: "2026-06-01T12:00:00.000Z" },
      }),
      shard("Gui", {
        "PUB-002": { s: "pass", n: "", at: "2026-08-20T12:00:00.000Z" },
      }),
    ]);

    expect(findStaleCases(cases, merged, 30, new Date("2026-08-30T12:00:00.000Z"))).toEqual([
      { id: "PUB-001", lastEntryAt: "2026-06-01T12:00:00.000Z" },
    ]);
  });
});

describe("QA status issue linkage", () => {
  it("renders agent-supplied open issue keys beside failing cases", () => {
    const cases = [makeCase(), makeCase({ id: "ADM-001", tab: "Admin Dashboard" })];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "fail", n: "", at: "2026-08-30T12:00:00.000Z" },
        "ADM-001": { s: "blocked", n: "", at: "2026-08-30T12:00:00.000Z" },
      }),
    ]);
    const issues = parseIssueMap(
      JSON.stringify({ "PUB-001": ["PRD-101", "PRD-102"], "ADM-001": ["PRD-103"] }),
    );

    const report = buildStatusReport(cases, merged, {
      issues,
      staleDays: 30,
      now: new Date("2026-08-30T12:00:00.000Z"),
    });

    expect(report).toContain("- PUB-001 — open issues: PRD-101, PRD-102");
    expect(report).toContain("- ADM-001");
    expect(report).not.toContain("ADM-001 — open issues");
  });

  it("rejects values that are not issue keys", () => {
    expect(() => parseIssueMap('{"PUB-001":["PRD-101","a private note"]}')).toThrow(
      /invalid issue key/i,
    );
  });
});

describe("QA status privacy", () => {
  it("does not echo private input when the issues file is malformed", () => {
    for (const privateValue of ["Afo", "Nansel", "Gui", "PRIVATE_NOTE_CANARY"]) {
      let message = "";
      try {
        parseIssueMap(`{"PUB-001":[${privateValue}]}`);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toBe("issues file is not valid JSON");
      expect(message).not.toContain(privateValue);
    }
  });

  it("cannot render tester names or notes", () => {
    const privateNote = "PRIVATE NOTE CANARY: wallet prompt showed twice";
    const cases = [makeCase()];
    const merged = mergeShards([
      shard("Afo", {
        "PUB-001": { s: "pass", n: "Afo note", at: "2026-08-30T10:00:00.000Z" },
      }),
      shard("Nansel", {
        "PUB-001": { s: "blocked", n: "Nansel note", at: "2026-08-30T11:00:00.000Z" },
      }),
      shard("Gui", {
        "PUB-001": { s: "fail", n: privateNote, at: "2026-08-30T12:00:00.000Z" },
      }),
    ]);

    const report = buildStatusReport(cases, merged, {
      issues: {},
      staleDays: 30,
      now: new Date("2026-08-30T12:00:00.000Z"),
    });

    expect(report).not.toContain(privateNote);
    for (const tester of ["Afo", "Nansel", "Gui"]) {
      expect(report).not.toContain(tester);
    }
    expect(report).not.toContain("perPerson");
    expect(report).toContain("PUB-001");
  });
});
