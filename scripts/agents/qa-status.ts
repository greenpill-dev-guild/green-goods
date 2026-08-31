#!/usr/bin/env bun
/**
 * Print privacy-safe coverage from the QA app's live private store.
 *
 * The report contains catalog IDs, verdict counts, entry timestamps, and
 * optional Linear issue keys. It never projects notes or shard owners.
 *
 *   bun run qa:status [--stale-days 30] [--issues tmp/qa-status-issues.json]
 */

import { readFileSync } from "node:fs";

import { loadCatalog, type CatalogCase } from "./qa-workbook-build";
import {
  mergeShards,
  rollupVerdict,
  summarize,
  type MergedEntries,
} from "./qa-state";
import { readShards, resolveBlobToken } from "./qa-state-pull";

export const DEFAULT_STALE_DAYS = 30;

export type IssueMap = Record<string, string[]>;

interface CliOptions {
  staleDays: number;
  issuesPath?: string;
}

interface ReportOptions {
  staleDays?: number;
  issues?: IssueMap;
  now?: Date;
}

export interface StaleCase {
  id: string;
  lastEntryAt: string;
}

const CASE_ID = /^[A-Z][A-Z0-9-]*-\d+$/;
const ISSUE_KEY = /^[A-Z][A-Z0-9]*-\d+$/;

export function parseArgs(argv: string[]): CliOptions {
  let staleDays = DEFAULT_STALE_DAYS;
  let issuesPath: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag !== "--stale-days" && flag !== "--issues") {
      throw new Error(`unknown argument '${flag}' — expected --stale-days or --issues`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for '${flag}'`);
    if (flag === "--stale-days") {
      staleDays = Number(value);
      if (!Number.isInteger(staleDays) || staleDays <= 0) {
        throw new Error("--stale-days must be a positive whole number");
      }
    } else {
      issuesPath = value;
    }
    index++;
  }
  return { staleDays, issuesPath };
}

/** Parse only case IDs and Linear-style issue keys; arbitrary text never reaches the report. */
export function parseIssueMap(text: string): IssueMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // JSON parser diagnostics may quote the offending input. Keep the CLI's
    // privacy boundary intact even when the agent-produced file is malformed.
    throw new Error("issues file is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("issues file must contain an object mapping Test IDs to issue-key arrays");
  }

  const issues: IssueMap = {};
  for (const [caseId, value] of Object.entries(parsed)) {
    if (!CASE_ID.test(caseId)) throw new Error("issues map contains an invalid Test ID");
    if (!Array.isArray(value) || value.some((key) => typeof key !== "string" || !ISSUE_KEY.test(key))) {
      throw new Error("issues map contains an invalid issue key");
    }
    issues[caseId] = [...new Set(value)];
  }
  return issues;
}

export function findStaleCases(
  cases: CatalogCase[],
  merged: MergedEntries,
  staleDays: number,
  now: Date = new Date(),
): StaleCase[] {
  const cutoff = now.getTime() - staleDays * 24 * 60 * 60 * 1000;
  return cases.flatMap((testCase) => {
    const timestamps = Object.values(merged[testCase.id] ?? {})
      .map((entry) => Date.parse(entry.at))
      .filter(Number.isFinite);
    if (!timestamps.length) return [];
    const latest = Math.max(...timestamps);
    if (latest >= cutoff) return [];
    return [{ id: testCase.id, lastEntryAt: new Date(latest).toISOString() }];
  });
}

function renderCaseList(
  heading: string,
  lines: string[],
): string[] {
  return [
    `${heading} (${lines.length})`,
    ...(lines.length ? lines.map((line) => `- ${line}`) : ["- None"]),
  ];
}

export function buildStatusReport(
  cases: CatalogCase[],
  merged: MergedEntries,
  options: ReportOptions = {},
): string {
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const issues = options.issues ?? {};
  const now = options.now ?? new Date();
  const summary = summarize(cases, merged);
  const neverWalked = cases.filter((testCase) => !merged[testCase.id]).map((testCase) => testCase.id);
  const stale = findStaleCases(cases, merged, staleDays, now);
  const failing = cases.filter((testCase) => rollupVerdict(merged[testCase.id]) === "Fail");
  const blocked = cases.filter((testCase) => rollupVerdict(merged[testCase.id]) === "Blocked");

  const lines = [
    `QA status — ${summary.recorded}/${summary.total} active cases walked`,
    `Recency uses each case's latest entry timestamp, not a build SHA. Stale means older than ${staleDays} days.`,
    "",
    "| Surface | Walked | Pass | Fail | Blocked | N/A | No verdict |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...Object.entries(summary.perTab).map(
      ([tab, tabSummary]) =>
        `| ${tab} | ${tabSummary.recorded}/${tabSummary.total} | ${tabSummary.pass} | ${tabSummary.fail} | ${tabSummary.blocked} | ${tabSummary.na} | ${tabSummary.noVerdict} |`,
    ),
    "",
    ...renderCaseList("Never walked", neverWalked),
    "",
    ...renderCaseList(
      `Stale by entry timestamp (>${staleDays} days)`,
      stale.map(({ id, lastEntryAt }) => `${id} — last entry ${lastEntryAt}`),
    ),
    "",
    ...renderCaseList(
      "Failing",
      failing.map((testCase) => {
        const openIssues = issues[testCase.id] ?? [];
        return openIssues.length
          ? `${testCase.id} — open issues: ${openIssues.join(", ")}`
          : testCase.id;
      }),
    ),
    "",
    ...renderCaseList(
      "Blocked",
      blocked.map((testCase) => testCase.id),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const token = resolveBlobToken();
  const catalog = await loadCatalog();
  const active = catalog.cases.filter((testCase) => testCase.status !== "retired");
  let shards;
  try {
    shards = await readShards(token);
  } catch {
    // qa:pull owns shard-level diagnostics. Status output remains identity-free.
    throw new Error("the QA store could not be read; run bun run qa:pull for shard-level diagnostics");
  }
  const issues = options.issuesPath
    ? parseIssueMap(readFileSync(options.issuesPath, "utf8"))
    : {};
  process.stdout.write(
    buildStatusReport(active, mergeShards(shards), {
      issues,
      staleDays: options.staleDays,
    }),
  );
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(
      `qa:status failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
