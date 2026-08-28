import { describe, expect, it } from "vitest";

import {
  type Catalog,
  type CatalogCase,
  DEFECTS_TAB_COLUMNS,
  filterCases,
  loadCatalog,
  projectRow,
  resolveSurfaceFilter,
  surfaceColumnValue,
  TEST_TAB_COLUMNS,
  validateCatalog,
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

describe("projectRow", () => {
  it("emits exactly the 20 test-tab columns with run columns empty", () => {
    const row = projectRow(makeCase());
    expect(row).toHaveLength(TEST_TAB_COLUMNS.length);
    expect(row[0]).toBe("ADM-001");
    expect(row[7]).toBe("Open /hub; Inspect shell");
    // QA Owner, Device/Browser, Build/Commit, Result, Severity, Defect Link,
    // Retest Result, Retest Date stay empty in a generated workbook.
    for (const index of [10, 11, 13, 14, 15, 16, 18, 19]) {
      expect(row[index]).toBe("");
    }
  });

  it("maps PWA tabs to the 'PWA' surface column value", () => {
    expect(surfaceColumnValue("PWA iOS")).toBe("PWA");
    expect(surfaceColumnValue("PWA Android")).toBe("PWA");
    expect(surfaceColumnValue("Docs")).toBe("Docs");
    const row = projectRow(makeCase({ id: "PWA-IOS-001", tab: "PWA iOS" }));
    expect(row[1]).toBe("PWA");
  });

  it("pre-fills the notes column for requiresProduction cases", () => {
    const row = projectRow(makeCase({ requiresProduction: true }));
    expect(row[17]).toContain("Requires production origin");
    expect(projectRow(makeCase())[17]).toBe("");
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

describe("schemas", () => {
  it("keeps the sheet-schema column contracts", () => {
    expect(TEST_TAB_COLUMNS).toHaveLength(20);
    expect(DEFECTS_TAB_COLUMNS).toHaveLength(22);
    expect(TEST_TAB_COLUMNS[16]).toBe("Defect Link");
    expect(DEFECTS_TAB_COLUMNS[21]).toBe("Linear URL");
  });
});
