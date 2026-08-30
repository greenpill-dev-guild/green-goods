#!/usr/bin/env bun
/**
 * QA app session state — pure merge and projection helpers.
 *
 * The QA app (packages/qa-app) stores one JSON shard per tester, so two people
 * can record the same case at the same moment without either overwriting the
 * other. This module turns those shards back into the artifacts the qa-session
 * skill expects, and holds every rule that decides what a case's standing
 * verdict is. It is deliberately IO-free so the rules can be tested directly.
 *
 * Consumed by scripts/agents/qa-state-pull.ts.
 */

import type { CatalogCase } from "./qa-workbook-build";

/** The testers who can own a shard. Mirrors packages/qa-app/api/state.ts. */
export const ROSTER = ["Afo", "Nansel", "Gui"] as const;
export type Person = (typeof ROSTER)[number];

export interface Entry {
  s: string;
  n: string;
  at: string;
}

export interface Shard {
  person: string;
  updatedAt?: string;
  entries: Record<string, Entry>;
}

/** caseId -> person -> entry. */
export type MergedEntries = Record<string, Record<string, Entry>>;

/** Most severe verdict wins when testers disagree — a case one tester failed is a failure. */
const RANK: Record<string, number> = { fail: 4, blocked: 3, pass: 2, na: 1 };
const RESULT_LABEL: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  na: "N/A",
};

/** Fold every tester's shard into one case-keyed view. Shards never collide by construction. */
export function mergeShards(shards: Array<Shard | null | undefined>): MergedEntries {
  const merged: MergedEntries = {};
  for (const shard of shards) {
    if (!shard?.entries || typeof shard.person !== "string") continue;
    for (const [caseId, entry] of Object.entries(shard.entries)) {
      if (!entry || (!entry.s && !(entry.n || "").trim())) continue;
      (merged[caseId] ??= {})[shard.person] = entry;
    }
  }
  return merged;
}

/** The case's standing verdict as a run-sheet value, or "" when nobody recorded it. */
export function rollupVerdict(byPerson: Record<string, Entry> | undefined): string {
  const statuses = Object.values(byPerson ?? {})
    .map((entry) => entry.s)
    .filter((status) => Boolean(status) && status in RANK);
  if (!statuses.length) return "";
  const worst = statuses.sort((a, b) => RANK[b] - RANK[a])[0];
  return RESULT_LABEL[worst] ?? "";
}

/** RFC 4180: quote a field containing a comma, quote, or newline; double inner quotes. */
export function csvField(value: string): string {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Attribute every tester's note on one case, so a reader can tell who saw what.
 * Two testers disagreeing is signal, not noise — never collapse it to one voice.
 */
export function notesFor(byPerson: Record<string, Entry> | undefined): string {
  return Object.entries(byPerson ?? {})
    .filter(([, entry]) => (entry.n || "").trim())
    .map(([person, entry]) => `${person}: ${entry.n.trim()}`)
    .join(" | ");
}

/**
 * Project merged entries into the results.csv the qa-session skill consumes:
 * `Test ID, Result, Severity, Notes`. Only cases somebody actually recorded
 * appear — an untouched case is not a result. Severity defaults to the case's
 * catalog priority; a tester who disagrees says so in the note.
 */
export function toResultsCsv(cases: CatalogCase[], merged: MergedEntries): string {
  const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const rows = [["Test ID", "Result", "Severity", "Notes"].join(",")];
  for (const testCase of cases) {
    const byPerson = merged[testCase.id];
    if (!byPerson || !Object.keys(byPerson).length) continue;
    const result = rollupVerdict(byPerson);
    const severity = result === "Fail" || result === "Blocked" ? testCase.priority : "";
    rows.push(
      [
        csvField(testCase.id),
        csvField(result),
        csvField(severity),
        csvField(notesFor(byPerson)),
      ].join(","),
    );
  }
  // A recorded case that is no longer in the catalog would silently vanish;
  // surface it instead so the run sheet and the catalog stay reconcilable.
  for (const caseId of Object.keys(merged)) {
    if (byId.has(caseId)) continue;
    rows.push(
      [csvField(caseId), csvField(rollupVerdict(merged[caseId])), "", csvField(
        `UNKNOWN CASE — not in the catalog. ${notesFor(merged[caseId])}`,
      )].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

/** Per-tester and overall counts for the session receipt. */
export function summarize(cases: CatalogCase[], merged: MergedEntries) {
  const recorded = cases.filter((testCase) => merged[testCase.id]);
  const perPerson = Object.fromEntries(
    ROSTER.map((person) => [
      person,
      cases.filter((testCase) => merged[testCase.id]?.[person]).length,
    ]),
  );
  const tally = (result: string) =>
    recorded.filter((testCase) => rollupVerdict(merged[testCase.id]) === result).length;
  return {
    total: cases.length,
    recorded: recorded.length,
    // Untouched entirely — nobody has looked at these.
    untouched: cases.length - recorded.length,
    // Touched but not judged: a tester left a note without setting a verdict.
    // Kept separate so recorded === pass + fail + blocked + na + noVerdict.
    noVerdict: recorded.filter((testCase) => !rollupVerdict(merged[testCase.id])).length,
    pass: tally("Pass"),
    fail: tally("Fail"),
    blocked: tally("Blocked"),
    na: tally("N/A"),
    perPerson,
  };
}
