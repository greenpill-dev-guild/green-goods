#!/usr/bin/env bun
/**
 * QA session report — one deterministic core for every session record.
 *
 * Reads the session `qa:pull` already wrote (tmp/qa-session/<slug>/qa-state.json)
 * and joins it to the catalog, so the results the qa-call-report routine,
 * `/qa-triage --call`, and the qa-session receipt embed come from one
 * computation instead of three hand-counts. The model and renderer are IO-free;
 * only the CLI at the bottom touches the filesystem, and nothing here reads the
 * Blob store.
 *
 *   bun run qa:report --slug <slug> [--window a..b] [--previous path]
 *     [--build client=sha,admin=sha] [--public] [--stale-days n] [--out dir]
 */

import { type Entry, type MergedEntries, notesFor, rollupVerdict } from "./qa-state";
import { DEFAULT_STALE_DAYS, findStaleCases, type StaleCase } from "./qa-status";
import { type CatalogCase, SEVERITY_VALUES } from "./qa-workbook-build";

export interface ReportWindow {
  start: string;
  end: string;
  /** Whether the caller scoped the session or the slug's calendar day stood in for it. */
  source: "flag" | "slug-day";
}

/** Session-scoped counts for one group of cases; `walked` always equals the verdict sum. */
export interface Bucket {
  total: number;
  walked: number;
  pass: number;
  fail: number;
  blocked: number;
  na: number;
  noted: number;
}

export interface ReportIssue {
  id: string;
  priority: string;
  kind: string;
  area: string;
  verdict: "Fail" | "Blocked";
  /** Attributed session notes — private detail the public renderer never reads. */
  notes: string;
}

export interface ReportModel {
  slug: string;
  window: ReportWindow;
  pulledAt: string;
  build?: { client?: string; admin?: string };
  byPriority: Record<string, Bucket>;
  byKind: Record<string, Bucket>;
  byTab: Record<string, Bucket>;
  issues: ReportIssue[];
  gaps: { neverWalked: Record<string, string[]>; stale: StaleCase[] };
  /** Fail or Blocked as standing verdict, but untouched inside the window. */
  standing: { failing: string[]; blocked: string[] };
  delta: null;
  testers: { count: number; perPerson: Record<string, { touched: number; decided: number }> };
}

export interface ReportOptions {
  slug: string;
  pulledAt: string;
  window?: ReportWindow;
  build?: { client?: string; admin?: string };
  staleDays?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The store is long-lived and the pull merges every shard ever written, so only
 * entries inside the window are this session's verdicts. Without an explicit
 * window the slug's UTC day stands in, the same fallback the routine uses.
 */
export function parseWindow(flag: string | undefined, slug: string): ReportWindow {
  if (!flag) {
    const day = slug.slice(0, 10);
    if (!DAY.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00.000Z`))) {
      throw new Error(`slug '${slug}' does not start with a YYYY-MM-DD date; pass --window`);
    }
    return { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z`, source: "slug-day" };
  }
  const parts = flag.split("..");
  const start = Date.parse(parts[0] ?? "");
  const end = Date.parse(parts[1] ?? "");
  if (parts.length !== 2 || !Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("--window must be <startISO>..<endISO>");
  }
  if (end < start) throw new Error("--window end precedes its start");
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), source: "flag" };
}

function inWindow(entry: Entry, window: ReportWindow): boolean {
  const at = Date.parse(entry.at);
  return Number.isFinite(at) && at >= Date.parse(window.start) && at <= Date.parse(window.end);
}

function sessionEntries(byPerson: Record<string, Entry> | undefined, window: ReportWindow): Record<string, Entry> {
  return Object.fromEntries(Object.entries(byPerson ?? {}).filter(([, entry]) => inWindow(entry, window)));
}

const VERDICT_FIELD: Record<string, keyof Bucket> = {
  Pass: "pass",
  Fail: "fail",
  Blocked: "blocked",
  "N/A": "na",
  "": "noted",
};

function bucket(cases: CatalogCase[], verdictOf: (testCase: CatalogCase) => string | null): Bucket {
  const counts: Bucket = { total: cases.length, walked: 0, pass: 0, fail: 0, blocked: 0, na: 0, noted: 0 };
  for (const testCase of cases) {
    const verdict = verdictOf(testCase);
    if (verdict === null) continue;
    counts.walked += 1;
    counts[VERDICT_FIELD[verdict]] += 1;
  }
  return counts;
}

function groupBuckets(
  cases: CatalogCase[],
  keyOf: (testCase: CatalogCase) => string,
  order: readonly string[],
  verdictOf: (testCase: CatalogCase) => string | null,
): Record<string, Bucket> {
  const present = new Set(cases.map(keyOf));
  const keys = [...order.filter((key) => present.has(key)), ...[...present].filter((key) => !order.includes(key)).sort()];
  return Object.fromEntries(keys.map((key) => [key, bucket(cases.filter((testCase) => keyOf(testCase) === key), verdictOf)]));
}

export function buildReportModel(cases: CatalogCase[], entries: MergedEntries, options: ReportOptions): ReportModel {
  const window = options.window ?? parseWindow(undefined, options.slug);
  const session = new Map(cases.map((testCase) => [testCase.id, sessionEntries(entries[testCase.id], window)]));
  // null = nobody touched the case inside the window; "" = touched, no verdict yet.
  const verdictOf = (testCase: CatalogCase): string | null => {
    const byPerson = session.get(testCase.id) ?? {};
    return Object.keys(byPerson).length ? rollupVerdict(byPerson) : null;
  };
  const walked = cases.filter((testCase) => verdictOf(testCase) !== null);
  const untouched = cases.filter((testCase) => verdictOf(testCase) === null);

  const issues = walked.flatMap((testCase): ReportIssue[] => {
    const verdict = verdictOf(testCase);
    if (verdict !== "Fail" && verdict !== "Blocked") return [];
    return [{
      id: testCase.id,
      priority: testCase.priority,
      kind: testCase.kind,
      area: testCase.area,
      verdict,
      notes: notesFor(session.get(testCase.id)),
    }];
  });

  const standingVerdict = (testCase: CatalogCase) => rollupVerdict(entries[testCase.id]);
  const neverWalked: Record<string, string[]> = {};
  for (const testCase of untouched) (neverWalked[testCase.priority] ??= []).push(testCase.id);

  const perPerson: Record<string, { touched: number; decided: number }> = {};
  for (const byPerson of session.values()) {
    for (const [person, entry] of Object.entries(byPerson)) {
      const tally = (perPerson[person] ??= { touched: 0, decided: 0 });
      tally.touched += 1;
      if (rollupVerdict({ [person]: entry })) tally.decided += 1;
    }
  }
  const sortedPeople = Object.fromEntries(Object.entries(perPerson).sort(([a], [b]) => a.localeCompare(b)));

  return {
    slug: options.slug,
    window,
    pulledAt: options.pulledAt,
    build: options.build,
    byPriority: groupBuckets(cases, (testCase) => testCase.priority, SEVERITY_VALUES, verdictOf),
    byKind: groupBuckets(cases, (testCase) => testCase.kind, [], verdictOf),
    byTab: groupBuckets(cases, (testCase) => testCase.tab, [...new Set(cases.map((testCase) => testCase.tab))], verdictOf),
    issues,
    gaps: {
      neverWalked,
      stale: findStaleCases(cases, entries, options.staleDays ?? DEFAULT_STALE_DAYS, new Date(window.end)),
    },
    standing: {
      failing: untouched.filter((testCase) => standingVerdict(testCase) === "Fail").map((testCase) => testCase.id),
      blocked: untouched.filter((testCase) => standingVerdict(testCase) === "Blocked").map((testCase) => testCase.id),
    },
    delta: null,
    testers: { count: Object.keys(sortedPeople).length, perPerson: sortedPeople },
  };
}
