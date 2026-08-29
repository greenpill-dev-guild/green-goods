#!/usr/bin/env bun
/**
 * Green Goods QA test-sheet generator.
 *
 * Projects scripts/data/qa-test-catalog.json (the upstream scenario source of
 * truth) into a simple, human-first spreadsheet: an Overview tab (purpose,
 * run info filled once, how-to, live per-surface counts) plus one tab per
 * surface with plain-language columns and area section rows. Defect records
 * stay in the private "Green Goods v1.1 QA" Sheet — this sheet is the
 * walk-through checklist and result tracker.
 *
 * Output is a working artifact, never committed: filled sheets carry run
 * results and belong in the private Drive QA folder.
 *
 *   bun run qa:workbook [--surface <tab|alias>[,...]] [--cases <ID>[,...]]
 *                       [--tag <tag>[,...]] [--out <path>]
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const RUN_SHEET_COLUMNS = [
  "ID",
  "Pri",
  "What we're checking",
  "How to check",
  "What should happen",
  "Result",
  "Severity",
  "Notes / evidence",
] as const;

export const RESULT_VALUES = ["Pass", "Fail", "Blocked", "N/A"] as const;
export const SEVERITY_VALUES = ["P0", "P1", "P2", "P3"] as const;

export const TAB_PREFIXES: Record<string, readonly string[]> = {
  "PUB-": ["Public Website"],
  "PWA-IOS-": ["PWA iOS"],
  "PWA-AND-": ["PWA Android"],
  "PWA-ROLE-": ["PWA iOS", "PWA Android"],
  "ADM-": ["Admin Dashboard"],
  "XPLAT-": ["Cross Surface"],
  "DOCS-": ["Docs"],
};

const SURFACE_ALIASES: Record<string, string[]> = {
  website: ["Public Website"],
  public: ["Public Website"],
  pwa: ["PWA iOS", "PWA Android"],
  ios: ["PWA iOS"],
  android: ["PWA Android"],
  admin: ["Admin Dashboard"],
  cross: ["Cross Surface"],
  docs: ["Docs"],
};

const TAB_COLORS: Record<string, string> = {
  "Public Website": "1A7544",
  "PWA iOS": "2E7D6B",
  "PWA Android": "3E8E5A",
  "Admin Dashboard": "5B7553",
  "Cross Surface": "8A7F5C",
  Docs: "6B8E9E",
};

const REQUIRES_PRODUCTION_NOTE = "Can't run on localhost — needs a production install/passkey";

export interface CatalogCase {
  id: string;
  tab: string;
  platform: string;
  priority: string;
  area: string;
  scenario: string;
  preconditions: string[];
  steps: string[];
  expected: string;
  evidence: string;
  role: string;
  tags?: string[];
  requiresProduction?: boolean;
  status: "active" | "retired";
  source: string;
}

export interface Catalog {
  version: number;
  tabs: string[];
  cases: CatalogCase[];
}

/** "How to check": needs line, numbered steps, capture line — one readable cell. */
export function howToCheck(testCase: CatalogCase): string {
  const lines: string[] = [];
  const needs = [
    testCase.role !== "none" && testCase.role !== "any" ? `${testCase.role} account` : "",
    ...testCase.preconditions,
  ].filter(Boolean);
  if (needs.length > 0) lines.push(`Needs: ${needs.join("; ")}`);
  testCase.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  if (testCase.evidence.trim()) lines.push(`Capture: ${testCase.evidence}`);
  return lines.join("\n");
}

/** One catalog case -> the 8-cell run-sheet row. Result columns stay empty. */
export function projectRow(testCase: CatalogCase): string[] {
  return [
    testCase.id,
    testCase.priority,
    testCase.scenario,
    howToCheck(testCase),
    testCase.expected,
    "", // Result
    "", // Severity
    testCase.requiresProduction ? REQUIRES_PRODUCTION_NOTE : "",
  ];
}

/** Group a tab's cases by area, preserving first-appearance order. */
export function groupByArea(cases: CatalogCase[]): Array<{ area: string; cases: CatalogCase[] }> {
  const groups: Array<{ area: string; cases: CatalogCase[] }> = [];
  for (const testCase of cases) {
    const group = groups.find((candidate) => candidate.area === testCase.area);
    if (group) group.cases.push(testCase);
    else groups.push({ area: testCase.area, cases: [testCase] });
  }
  return groups;
}

export function resolveSurfaceFilter(raw: string, knownTabs: string[]): string[] {
  const tabs = new Set<string>();
  for (const token of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (token.toLowerCase() === "all") return [...knownTabs];
    const aliased = SURFACE_ALIASES[token.toLowerCase()];
    const exact = knownTabs.find((tab) => tab.toLowerCase() === token.toLowerCase());
    for (const tab of aliased ?? (exact ? [exact] : [])) tabs.add(tab);
    if (!aliased && !exact) {
      throw new Error(
        `unknown surface '${token}' — use a tab name (${knownTabs.join(", ")}) or alias (${Object.keys(SURFACE_ALIASES).join(", ")})`,
      );
    }
  }
  return [...tabs];
}

export function filterCases(
  cases: CatalogCase[],
  filter: { tabs?: string[]; ids?: string[]; tags?: string[] } = {},
): CatalogCase[] {
  return cases.filter((testCase) => {
    if (testCase.status === "retired") return false;
    if (filter.tabs?.length && !filter.tabs.includes(testCase.tab)) return false;
    if (filter.ids?.length && !filter.ids.includes(testCase.id)) return false;
    if (filter.tags?.length && !filter.tags.some((tag) => testCase.tags?.includes(tag))) {
      return false;
    }
    return true;
  });
}

export function validateCatalog(catalog: Catalog): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const testCase of catalog.cases) {
    if (seen.has(testCase.id)) problems.push(`duplicate id: ${testCase.id}`);
    seen.add(testCase.id);
    if (!catalog.tabs.includes(testCase.tab)) {
      problems.push(`${testCase.id}: unknown tab '${testCase.tab}'`);
    }
    const prefix = Object.keys(TAB_PREFIXES).find((candidate) => testCase.id.startsWith(candidate));
    if (!prefix) {
      problems.push(`${testCase.id}: id has no registered prefix`);
    } else if (!TAB_PREFIXES[prefix].includes(testCase.tab)) {
      problems.push(`${testCase.id}: prefix ${prefix} does not belong on tab '${testCase.tab}'`);
    }
    if (!SEVERITY_VALUES.includes(testCase.priority as (typeof SEVERITY_VALUES)[number])) {
      problems.push(`${testCase.id}: priority '${testCase.priority}' not in ${SEVERITY_VALUES.join("/")}`);
    }
    if (!["active", "retired"].includes(testCase.status)) {
      problems.push(`${testCase.id}: status '${testCase.status}' not active|retired`);
    }
    if (testCase.status === "active") {
      if (!testCase.steps.length || testCase.steps.some((step) => !step.trim())) {
        problems.push(`${testCase.id}: empty steps`);
      }
      if (!testCase.expected.trim()) problems.push(`${testCase.id}: empty expected`);
      if (!testCase.scenario.trim()) problems.push(`${testCase.id}: empty scenario`);
    }
  }
  return problems;
}

export async function loadCatalog(
  catalogPath = path.join(scriptDir, "..", "data", "qa-test-catalog.json"),
): Promise<Catalog> {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;
  const problems = validateCatalog(catalog);
  if (problems.length > 0) {
    throw new Error(`qa-test-catalog.json invalid:\n- ${problems.join("\n- ")}`);
  }
  return catalog;
}

const BRAND_GREEN = "FF1A7544";
const AREA_LINEN = "FFF5F1E8";
const INK_SOFT = "FF6B6B6B";

async function writeWorkbook(
  catalog: Catalog,
  cases: CatalogCase[],
  outPath: string,
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "green-goods qa:workbook";

  const includedTabs = catalog.tabs.filter((tab) => cases.some((c) => c.tab === tab));
  const tabRanges = new Map<string, { first: number; last: number }>();

  // Created first so it is the first tab; content is filled after the
  // surface tabs exist and their row ranges are known.
  const overview = workbook.addWorksheet("Overview", {
    properties: { tabColor: { argb: BRAND_GREEN } },
  });

  // ── Surface tabs ──────────────────────────────────────────────────────
  for (const tab of includedTabs) {
    const sheet = workbook.addWorksheet(tab, {
      views: [{ state: "frozen", ySplit: 1 }],
      properties: { tabColor: { argb: `FF${TAB_COLORS[tab] ?? "1A7544"}` } },
    });

    const header = sheet.addRow([...RUN_SHEET_COLUMNS]);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
    header.height = 22;

    const widths = [13, 5, 38, 52, 40, 10, 9, 30];
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });

    let firstCaseRow = 0;
    let lastCaseRow = 0;
    for (const group of groupByArea(cases.filter((c) => c.tab === tab))) {
      const areaRow = sheet.addRow([group.area]);
      sheet.mergeCells(areaRow.number, 1, areaRow.number, RUN_SHEET_COLUMNS.length);
      areaRow.font = { bold: true, color: { argb: "FF3D3A33" } };
      areaRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AREA_LINEN } };
      areaRow.height = 20;

      for (const testCase of group.cases) {
        const row = sheet.addRow(projectRow(testCase));
        if (firstCaseRow === 0) firstCaseRow = row.number;
        lastCaseRow = row.number;
        row.alignment = { vertical: "top" };
        for (const column of [3, 4, 5, 8]) {
          row.getCell(column).alignment = { wrapText: true, vertical: "top" };
        }
        row.getCell(2).alignment = { horizontal: "center", vertical: "top" };
        if (testCase.priority === "P0") row.getCell(2).font = { bold: true };
        if (testCase.requiresProduction) row.getCell(8).font = { italic: true, color: { argb: INK_SOFT } };
        row.getCell(6).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${RESULT_VALUES.join(",")}"`],
        };
        row.getCell(7).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${SEVERITY_VALUES.join(",")}"`],
        };
      }
    }
    tabRanges.set(tab, { first: firstCaseRow, last: lastCaseRow });
  }

  // ── Overview content ──────────────────────────────────────────────────
  overview.getColumn(1).width = 22;
  overview.getColumn(2).width = 16;
  for (let column = 3; column <= 8; column++) overview.getColumn(column).width = 11;

  const title = overview.addRow(["Green Goods QA Test Sheet"]);
  title.font = { bold: true, size: 16, color: { argb: BRAND_GREEN } };
  overview.addRow([
    "Walk each surface tab top to bottom, mark Result as you go, note anything you see.",
  ]).font = { italic: true, color: { argb: INK_SOFT } };
  overview.addRow([]);

  const runInfoHeader = overview.addRow(["This run"]);
  runInfoHeader.font = { bold: true };
  for (const label of ["Date", "Build / commit", "Tester", "Environment", "Device / browser"]) {
    const row = overview.addRow([label, ""]);
    row.getCell(1).font = { color: { argb: INK_SOFT } };
    row.getCell(2).border = { bottom: { style: "thin", color: { argb: "FFBBBBBB" } } };
  }
  overview.addRow([]);

  const howHeader = overview.addRow(["How to use"]);
  howHeader.font = { bold: true };
  for (const rule of [
    "Result: Pass, Fail, Blocked, or N/A. Leave blank until you actually run it.",
    "Severity (P0–P3) only on Fails. Any open P0 fail blocks release.",
    "Every Fail gets a note and a screenshot or recording.",
    "Rows marked “Can't run on localhost” need the production app (installs, passkeys).",
    "Bugs graduate to the Green Goods v1.1 QA sheet and Linear via triage — this sheet is the walk.",
  ]) {
    overview.addRow([`•  ${rule}`]);
  }
  overview.addRow([]);

  const summaryHeader = overview.addRow([
    "Surface",
    "Cases",
    "Pass",
    "Fail",
    "Blocked",
    "N/A",
    "Open P0",
  ]);
  summaryHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let column = 1; column <= 7; column++) {
    summaryHeader.getCell(column).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_GREEN },
    };
  }
  for (const tab of includedTabs) {
    const range = tabRanges.get(tab);
    if (!range || range.first === 0) continue;
    const results = `'${tab}'!$F$${range.first}:$F$${range.last}`;
    const severities = `'${tab}'!$G$${range.first}:$G$${range.last}`;
    overview.addRow([
      tab,
      cases.filter((c) => c.tab === tab).length,
      { formula: `COUNTIF(${results},"Pass")` },
      { formula: `COUNTIF(${results},"Fail")` },
      { formula: `COUNTIF(${results},"Blocked")` },
      { formula: `COUNTIF(${results},"N/A")` },
      { formula: `COUNTIFS(${results},"Fail",${severities},"P0")` },
    ]);
  }
  overview.addRow([]);
  overview.addRow([
    "Test definitions are versioned in the repo (scripts/data/qa-test-catalog.json).",
  ]).font = { italic: true, size: 9, color: { argb: INK_SOFT } };

  mkdirSync(path.dirname(outPath), { recursive: true });
  await workbook.xlsx.writeFile(outPath);
}

function parseArgs(argv: string[]): {
  surface?: string;
  cases?: string[];
  tags?: string[];
  out?: string;
} {
  const parsed: { surface?: string; cases?: string[]; tags?: string[]; out?: string } = {};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--surface" && value) {
      parsed.surface = value;
      index++;
    } else if (flag === "--cases" && value) {
      parsed.cases = value.split(",").map((id) => id.trim()).filter(Boolean);
      index++;
    } else if (flag === "--tag" && value) {
      parsed.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      index++;
    } else if (flag === "--out" && value) {
      parsed.out = value;
      index++;
    } else {
      throw new Error(`unknown argument '${flag}' — see the header comment for usage`);
    }
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog();
  const tabs = args.surface ? resolveSurfaceFilter(args.surface, catalog.tabs) : undefined;
  const cases = filterCases(catalog.cases, { tabs, ids: args.cases, tags: args.tags });
  if (cases.length === 0) {
    console.error("qa:workbook: no cases match the given filters");
    process.exit(1);
  }
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.resolve(
    args.out ?? path.join(scriptDir, "..", "..", "tmp", "qa", `green-goods-qa-test-sheet-${date}.xlsx`),
  );
  await writeWorkbook(catalog, cases, outPath);
  const tabCounts = catalog.tabs
    .map((tab) => ({ tab, count: cases.filter((c) => c.tab === tab).length }))
    .filter(({ count }) => count > 0)
    .map(({ tab, count }) => `${tab} ${count}`)
    .join(", ");
  console.log(`qa:workbook: wrote ${cases.length} cases (${tabCounts}) to ${outPath}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`qa:workbook: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
