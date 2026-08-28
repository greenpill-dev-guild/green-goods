#!/usr/bin/env bun
/**
 * Green Goods QA run-workbook generator.
 *
 * Projects scripts/data/qa-test-catalog.json (the upstream scenario source of
 * truth) into a per-run Excel workbook mirroring the "Green Goods v1.1 QA"
 * Google Sheet layout (see .claude/skills/qa-triage/sheet-schema.md): Guide,
 * Summary, one tab per surface (including Docs), and an empty Defects tab.
 *
 * Output is a working artifact, never committed: filled workbooks carry run
 * results and belong in the private Drive QA folder next to the Sheet.
 *
 *   bun run qa:workbook [--surface <tab|alias>[,...]] [--cases <ID>[,...]]
 *                       [--tag <tag>[,...]] [--out <path>]
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const TEST_TAB_COLUMNS = [
  "Test ID",
  "Surface",
  "Platform",
  "Priority",
  "Area",
  "Scenario",
  "Preconditions",
  "Steps",
  "Expected Result",
  "Required Evidence",
  "QA Owner",
  "Device/Browser",
  "Account/Role",
  "Build/Commit",
  "Result",
  "Severity",
  "Defect Link",
  "Notes",
  "Retest Result",
  "Retest Date",
] as const;

export const DEFECTS_TAB_COLUMNS = [
  "Defect ID",
  "Linked Test ID",
  "Severity",
  "Surface",
  "Title",
  "Owner",
  "Status",
  "Repro Steps",
  "Expected",
  "Actual",
  "Evidence Link",
  "Fix Owner",
  "Retest Owner",
  "Retest Result",
  "Release Decision",
  "Notes",
  "PostHog Hash",
  "PostHog Sessions 7d",
  "PostHog Users 7d",
  "PostHog Session ID",
  "PostHog Replay URL",
  "Linear URL",
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

const REQUIRES_PRODUCTION_NOTE =
  "Requires production origin (install/passkey) — cannot run on localhost dev";

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

/** The Surface COLUMN value differs from the tab name for the PWA tabs. */
export function surfaceColumnValue(tab: string): string {
  return tab === "PWA iOS" || tab === "PWA Android" ? "PWA" : tab;
}

/** One catalog case -> the 20-cell test-tab row. Run columns stay empty. */
export function projectRow(testCase: CatalogCase): string[] {
  return [
    testCase.id,
    surfaceColumnValue(testCase.tab),
    testCase.platform,
    testCase.priority,
    testCase.area,
    testCase.scenario,
    testCase.preconditions.join("; "),
    testCase.steps.join("; "),
    testCase.expected,
    testCase.evidence,
    "", // QA Owner
    "", // Device/Browser
    testCase.role === "none" ? "" : testCase.role,
    "", // Build/Commit
    "", // Result
    "", // Severity
    "", // Defect Link
    testCase.requiresProduction ? REQUIRES_PRODUCTION_NOTE : "",
    "", // Retest Result
    "", // Retest Date
  ];
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

const GUIDE_ROWS: string[][] = [
  ["Green Goods QA Run Workbook"],
  [
    "Generated from scripts/data/qa-test-catalog.json (the upstream scenario source of truth). " +
      "Use the surface tabs for execution and the Defects tab for follow-up. " +
      "Filled workbooks carry results and belong in the private Drive QA folder — never in git.",
  ],
  [],
  ["Rule", "How to use it"],
  ["Result values", "Use Pass, Fail, Blocked, or N/A only. Leave blank until the test is actually run."],
  ["Severity values", "Use P0, P1, P2, or P3 for failures. Leave blank for passing rows."],
  [
    "Evidence",
    "Every Fail needs a screenshot, video, console note, or defect link. Visual/device issues need screenshots or screen recordings.",
  ],
  ["P0 behavior", "Any open P0 failure blocks release until fixed or explicitly waived by the release owner."],
  ["PWA device proof", "PWA iOS and PWA Android tabs must be run on real installed devices when possible."],
  [
    "Localhost limits",
    "Rows noted 'Requires production origin' (installs, passkey ceremonies) cannot run against localhost dev — the passkey RP-ID is greengoods.app.",
  ],
  [
    "Mainnet safety",
    "Local dev:prod sessions run against real Arbitrum: connected-wallet transactions are real. Do not broadcast mainnet transactions or irreversible deploys unless explicitly authorized.",
  ],
  ["Retest", "After a fix, fill Retest Result and Retest Date. Do not overwrite the original failed Result."],
];

async function writeWorkbook(
  catalog: Catalog,
  cases: CatalogCase[],
  outPath: string,
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "green-goods qa:workbook";

  const guide = workbook.addWorksheet("Guide");
  for (const row of GUIDE_ROWS) guide.addRow(row);
  guide.getColumn(1).width = 22;
  guide.getColumn(2).width = 110;
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const includedTabs = catalog.tabs.filter((tab) => cases.some((c) => c.tab === tab));

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Green Goods QA Run Summary"]).font = { bold: true, size: 14 };
  summary.addRow([]);
  const summaryHeader = summary.addRow([
    "Surface",
    "Total Tests",
    "Passed",
    "Failed",
    "Blocked",
    "N/A",
    "P0 Open",
    "Owner Notes",
  ]);
  summaryHeader.font = { bold: true };
  for (const tab of includedTabs) {
    const count = cases.filter((c) => c.tab === tab).length;
    const range = `'${tab}'!$O$2:$O$${count + 1}`;
    const severityRange = `'${tab}'!$P$2:$P$${count + 1}`;
    summary.addRow([
      tab,
      count,
      { formula: `COUNTIF(${range},"Pass")` },
      { formula: `COUNTIF(${range},"Fail")` },
      { formula: `COUNTIF(${range},"Blocked")` },
      { formula: `COUNTIF(${range},"N/A")` },
      { formula: `COUNTIFS(${range},"Fail",${severityRange},"P0")` },
      "",
    ]);
  }
  summary.getColumn(1).width = 18;
  summary.getColumn(8).width = 40;

  for (const tab of includedTabs) {
    const sheet = workbook.addWorksheet(tab, { views: [{ state: "frozen", ySplit: 1 }] });
    const header = sheet.addRow([...TEST_TAB_COLUMNS]);
    header.font = { bold: true };
    const tabCases = cases.filter((c) => c.tab === tab);
    for (const testCase of tabCases) sheet.addRow(projectRow(testCase));

    const widths = [14, 14, 24, 8, 18, 44, 34, 54, 44, 28, 12, 16, 13, 13, 9, 9, 16, 30, 12, 12];
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    for (const column of [6, 7, 8, 9, 10, 18]) {
      sheet.getColumn(column).alignment = { wrapText: true, vertical: "top" };
    }
    const lastRow = tabCases.length + 1;
    for (let row = 2; row <= lastRow; row++) {
      for (const column of ["O", "S"]) {
        sheet.getCell(`${column}${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${RESULT_VALUES.join(",")}"`],
        };
      }
      sheet.getCell(`P${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${SEVERITY_VALUES.join(",")}"`],
      };
    }
  }

  const defects = workbook.addWorksheet("Defects", { views: [{ state: "frozen", ySplit: 1 }] });
  defects.addRow([...DEFECTS_TAB_COLUMNS]).font = { bold: true };
  DEFECTS_TAB_COLUMNS.forEach((_, index) => {
    defects.getColumn(index + 1).width = 18;
  });

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
    args.out ?? path.join(scriptDir, "..", "..", "tmp", "qa", `green-goods-qa-workbook-${date}.xlsx`),
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
