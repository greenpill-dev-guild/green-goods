import { describe, expect, it } from "vitest";

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  type Catalog,
  type CatalogCase,
  filterCases,
  groupByArea,
  howToCheck,
  loadCatalog,
  parseArgs,
  projectRow,
  reserveOutputPath,
  resolveSurfaceFilter,
  RUN_SHEET_COLUMNS,
  validateCatalog,
  validateSelectors,
} from "./qa-workbook-build";

function makeCase(overrides: Partial<CatalogCase> = {}): CatalogCase {
  return {
    id: "ADM-001",
    tab: "Admin Dashboard",
    platform: "Chromium Desktop",
    priority: "P0",
    area: "Shell",
    scenario: "Admin hub loads",
    preconditions: ["Admin URL available"],
    steps: ["Open /hub", "Inspect shell"],
    expected: "Shell loads",
    evidence: "Screenshot",
    role: "steward",
    kind: "journey",
    status: "active",
    source: "sheet-v1.1",
    ...overrides,
  };
}

describe("qa-test-catalog.json", () => {
  it("loads and validates the real catalog", async () => {
    const catalog = await loadCatalog();
    expect(catalog.version).toBe(2);
    expect(catalog.cases.length).toBeGreaterThanOrEqual(120);
    // Docs is a first-class surface with content-truth cases of its own.
    expect(filterCases(catalog.cases, { tabs: ["Docs"] }).length).toBeGreaterThanOrEqual(13);
    // Retired rows stay forever (never delete, never reuse ids).
    expect(catalog.cases.some((testCase) => testCase.status === "retired")).toBe(true);
  });
});

describe("validateCatalog", () => {
  const tabs = ["Public Website", "PWA", "Admin Dashboard", "Docs"];

  it("accepts a well-formed catalog", () => {
    const catalog: Catalog = { version: 2, tabs, cases: [makeCase()] };
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("rejects duplicate ids, wrong-tab prefixes, and empty steps", () => {
    const catalog: Catalog = {
      version: 2,
      tabs,
      cases: [
        makeCase(),
        makeCase({ scenario: "duplicate id" }),
        makeCase({ id: "PUB-001", tab: "Docs", scenario: "prefix on wrong tab" }),
        makeCase({ id: "ADM-002", steps: [], scenario: "empty steps" }),
      ],
    };
    const problems = validateCatalog(catalog);
    expect(problems.some((problem) => problem.includes("duplicate id"))).toBe(true);
    expect(problems.some((problem) => problem.includes("does not belong on tab"))).toBe(true);
    expect(problems.some((problem) => problem.includes("empty steps"))).toBe(true);
  });

  it("requires a capability flag on installed-device rows but not desktop PWA journeys", () => {
    const unflagged = makeCase({ id: "PWA-IOS-099", tab: "PWA" });
    const flagged = makeCase({ id: "PWA-IOS-098", tab: "PWA", requiresDevice: true });
    const desktopJourney = makeCase({ id: "PWA-099", tab: "PWA" });
    const problems = validateCatalog({
      version: 2,
      tabs,
      cases: [unflagged, flagged, desktopJourney],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/PWA-IOS-099.*requiresProduction or requiresDevice/);
  });

  it("binds prefixes to the merged tabs and frees retired rows from tab checks", () => {
    const onPwa = makeCase({ id: "PWA-ROLE-001", tab: "PWA", requiresDevice: true });
    const onAdmin = makeCase({ id: "PWA-ROLE-009", tab: "Admin Dashboard", requiresDevice: true });
    const retiredLegacy = makeCase({
      id: "XPLAT-001",
      tab: "Cross Surface",
      status: "retired",
    });
    expect(validateCatalog({ version: 2, tabs, cases: [onPwa, retiredLegacy] })).toEqual([]);
    expect(validateCatalog({ version: 2, tabs, cases: [onAdmin] })).not.toEqual([]);
  });

  it("still validates the immutable definition of retired rows", () => {
    // Retirement frees a row from current-tab membership, never from content
    // integrity — the audit record must stay readable.
    const gutted = makeCase({
      id: "XPLAT-002",
      tab: "Cross Surface",
      status: "retired",
      steps: [],
      expected: "",
    });
    const problems = validateCatalog({ version: 2, tabs, cases: [gutted] });
    expect(problems.some((problem) => problem.includes("empty steps"))).toBe(true);
    expect(problems.some((problem) => problem.includes("empty expected"))).toBe(true);
  });

  it("rejects the legacy 'transaction' tag on active rows", () => {
    const legacy = makeCase({ tags: ["transaction"] });
    const canonical = makeCase({ id: "ADM-002", tags: ["tx"] });
    const problems = validateCatalog({ version: 2, tabs, cases: [legacy, canonical] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/legacy tag 'transaction'/);
  });
});

describe("howToCheck", () => {
  it("folds needs, numbered steps, and capture into one readable cell", () => {
    const cell = howToCheck(makeCase());
    expect(cell).toBe(
      "Needs: steward account; Admin URL available\n1. Open /hub\n2. Inspect shell\nCapture: Screenshot",
    );
  });

  it("omits the needs line for role none/any with no preconditions", () => {
    const cell = howToCheck(makeCase({ role: "none", preconditions: [], evidence: "" }));
    expect(cell).toBe("1. Open /hub\n2. Inspect shell");
  });

  it("keeps multi-word roles verbatim instead of appending 'account'", () => {
    const cell = howToCheck(
      makeCase({ role: "wallet with funds", preconditions: [], evidence: "" }),
    );
    expect(cell).toContain("Needs: wallet with funds");
    expect(cell).not.toContain("account");
  });
});

describe("projectRow", () => {
  it("emits exactly the 8 run-sheet columns with result columns empty", () => {
    const row = projectRow(makeCase());
    expect(row).toHaveLength(RUN_SHEET_COLUMNS.length);
    expect(row[0]).toBe("ADM-001");
    expect(row[1]).toBe("P0");
    expect(row[2]).toBe("Admin hub loads");
    expect(row[3]).toContain("1. Open /hub");
    expect(row[4]).toBe("Shell loads");
    expect(row[5]).toBe(""); // Result
    expect(row[6]).toBe(""); // Severity
    expect(row[7]).toBe(""); // Notes
  });

  it("pre-fills the notes column for requiresProduction cases", () => {
    const row = projectRow(makeCase({ requiresProduction: true }));
    expect(row[7]).toContain("Can't run on localhost");
  });

  it("prefers a case-specific production reason over the generic note", () => {
    const row = projectRow(
      makeCase({ requiresProduction: true, requiresProductionReason: "Needs the public URL" }),
    );
    expect(row[7]).toBe("Needs the public URL");
  });

  it("pre-marks requiresProduction cases Blocked only in local runs", () => {
    const testCase = makeCase({ requiresProduction: true });
    expect(projectRow(testCase, { localRun: true })[5]).toBe("Blocked");
    expect(projectRow(testCase)[5]).toBe(""); // production-run sheets stay executable
    expect(projectRow(makeCase(), { localRun: true })[5]).toBe(""); // local cases unaffected
  });

  it("pre-marks requiresDevice cases Blocked locally with the device note", () => {
    const testCase = makeCase({ requiresDevice: true });
    const localRow = projectRow(testCase, { localRun: true });
    expect(localRow[5]).toBe("Blocked");
    expect(localRow[7]).toContain("real installed device");
    expect(projectRow(testCase)[5]).toBe(""); // executable on a real device run
  });
});

describe("groupByArea", () => {
  it("groups by area preserving first-appearance order", () => {
    const cases = [
      makeCase({ id: "ADM-001", area: "Shell" }),
      makeCase({ id: "ADM-002", area: "Routing" }),
      makeCase({ id: "ADM-003", area: "Shell" }),
    ];
    const groups = groupByArea(cases);
    expect(groups.map((group) => group.area)).toEqual(["Shell", "Routing"]);
    expect(groups[0].cases.map((c) => c.id)).toEqual(["ADM-001", "ADM-003"]);
  });
});

describe("filterCases", () => {
  const cases = [
    makeCase(),
    makeCase({ id: "DOCS-001", tab: "Docs", tags: ["navigation"] }),
    makeCase({ id: "ADM-099", status: "retired", scenario: "retired case" }),
  ];

  it("always excludes retired cases", () => {
    expect(filterCases(cases).map((c) => c.id)).toEqual(["ADM-001", "DOCS-001"]);
  });

  it("filters by tab, id, and tag", () => {
    expect(filterCases(cases, { tabs: ["Docs"] }).map((c) => c.id)).toEqual(["DOCS-001"]);
    expect(filterCases(cases, { ids: ["ADM-001"] }).map((c) => c.id)).toEqual(["ADM-001"]);
    expect(filterCases(cases, { tags: ["navigation"] }).map((c) => c.id)).toEqual(["DOCS-001"]);
  });
});

describe("reserveOutputPath", () => {
  it("returns the first candidate the reserver claims, suffixing past losses", () => {
    const claimed = new Set(["/tmp/qa/sheet-2026-08-31.xlsx", "/tmp/qa/sheet-2026-08-31-2.xlsx"]);
    const reserve = (p: string) => !claimed.has(p);
    expect(reserveOutputPath("/tmp/qa/sheet-2026-08-31.xlsx", reserve)).toBe(
      "/tmp/qa/sheet-2026-08-31-3.xlsx",
    );
    expect(reserveOutputPath("/tmp/qa/fresh.xlsx", reserve)).toBe("/tmp/qa/fresh.xlsx");
  });

  it("claims the path on disk with an exclusive create so a racer cannot reuse it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "qa-reserve-"));
    try {
      const base = path.join(dir, "sheet.xlsx");
      const first = reserveOutputPath(base);
      expect(first).toBe(base);
      expect(existsSync(first)).toBe(true); // the reservation itself creates the file
      const second = reserveOutputPath(base);
      expect(second).toBe(path.join(dir, "sheet-2.xlsx"));
      expect(existsSync(second)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("validateSelectors", () => {
  const cases = [
    makeCase({ tags: ["dialog"] }),
    makeCase({ id: "ADM-099", status: "retired", scenario: "retired case" }),
  ];

  it("accepts known ids and tags", () => {
    expect(validateSelectors(cases, { ids: ["ADM-001"], tags: ["dialog"] })).toEqual([]);
  });

  it("names every unmatched or retired selector instead of silently dropping it", () => {
    const problems = validateSelectors(cases, { ids: ["ADM-001", "TYPO-999", "ADM-099"], tags: ["nope"] });
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/TYPO-999: no such case id/);
    expect(problems.join("\n")).toMatch(/ADM-099: case is retired/);
    expect(problems.join("\n")).toMatch(/--tag nope: no active case/);
  });
});

describe("resolveSurfaceFilter", () => {
  const tabs = ["Public Website", "PWA", "Admin Dashboard", "Docs"];

  it("resolves aliases and exact tab names", () => {
    expect(resolveSurfaceFilter("pwa", tabs)).toEqual(["PWA"]);
    expect(resolveSurfaceFilter("admin,docs", tabs)).toEqual(["Admin Dashboard", "Docs"]);
    expect(resolveSurfaceFilter("Public Website", tabs)).toEqual(["Public Website"]);
    expect(resolveSurfaceFilter("all", tabs)).toEqual(tabs);
  });

  it("rejects unknown surfaces", () => {
    expect(() => resolveSurfaceFilter("phone", tabs)).toThrow(/unknown surface/);
    expect(() => resolveSurfaceFilter("all,phone", tabs)).toThrow(/unknown surface/);
  });

  it("fails loudly on the retired ios/android platform aliases", () => {
    // Post tab-merge these cannot narrow to a platform; a silent whole-tab
    // result would make a device run sheet misleading.
    expect(() => resolveSurfaceFilter("ios", tabs)).toThrow(/unknown surface/);
    expect(() => resolveSurfaceFilter("android", tabs)).toThrow(/unknown surface/);
  });
});

describe("parseArgs", () => {
  it.each(["--surface", "--cases", "--tag", "--out"])(
    "rejects another flag as the value for %s",
    (flag) => {
      expect(() => parseArgs([flag, "--local"])).toThrow(`missing value for '${flag}'`);
    },
  );
});
