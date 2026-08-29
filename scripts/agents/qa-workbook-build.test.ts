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
    status: "active",
    source: "sheet-v1.1",
    ...overrides,
  };
}

describe("qa-test-catalog.json", () => {
  it("loads and validates the real catalog", async () => {
    const catalog = await loadCatalog();
    expect(catalog.version).toBe(1);
    expect(catalog.cases.length).toBeGreaterThanOrEqual(60);
    // Docs is a first-class surface with cases of its own.
    expect(filterCases(catalog.cases, { tabs: ["Docs"] }).length).toBeGreaterThanOrEqual(6);
  });
});

describe("validateCatalog", () => {
  const tabs = ["Public Website", "PWA iOS", "PWA Android", "Admin Dashboard", "Cross Surface", "Docs"];

  it("accepts a well-formed catalog", () => {
    const catalog: Catalog = { version: 1, tabs, cases: [makeCase()] };
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("rejects duplicate ids, wrong-tab prefixes, and empty steps", () => {
    const catalog: Catalog = {
      version: 1,
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

  it("allows the PWA-ROLE- prefix on both PWA tabs only", () => {
    const onIos = makeCase({ id: "PWA-ROLE-001", tab: "PWA iOS" });
    const onAndroid = makeCase({ id: "PWA-ROLE-004", tab: "PWA Android" });
    const onAdmin = makeCase({ id: "PWA-ROLE-009", tab: "Admin Dashboard" });
    expect(validateCatalog({ version: 1, tabs, cases: [onIos, onAndroid] })).toEqual([]);
    expect(validateCatalog({ version: 1, tabs, cases: [onAdmin] })).not.toEqual([]);
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
  const tabs = ["Public Website", "PWA iOS", "PWA Android", "Admin Dashboard", "Cross Surface", "Docs"];

  it("resolves aliases and exact tab names", () => {
    expect(resolveSurfaceFilter("pwa", tabs)).toEqual(["PWA iOS", "PWA Android"]);
    expect(resolveSurfaceFilter("admin,docs", tabs)).toEqual(["Admin Dashboard", "Docs"]);
    expect(resolveSurfaceFilter("Public Website", tabs)).toEqual(["Public Website"]);
    expect(resolveSurfaceFilter("all", tabs)).toEqual(tabs);
  });

  it("rejects unknown surfaces", () => {
    expect(() => resolveSurfaceFilter("phone", tabs)).toThrow(/unknown surface/);
  });
});
