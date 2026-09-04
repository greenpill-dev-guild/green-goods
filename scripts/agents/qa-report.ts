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
 *
 * `report.md` is the private variant: attributed notes and per-tester coverage,
 * kept under gitignored tmp/ behind the receipt's upload gate — `--out` cannot
 * leave that directory. Notes come from `results.csv` when the pull directory
 * has one: redactions and corrections live only there, so the raw state must
 * not reintroduce them. `--public` adds `report.public.md`, projected by the
 * qa:status rule — catalog IDs, counts, and timestamps only — for the docs
 * example and the Discord lede, nothing else.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Entry, type MergedEntries, notesFor, rollupVerdict } from "./qa-state";
import {
  acquirePrivateSessionLock,
  assertPrivateOutputPath,
  releasePrivateSessionLock,
  verifyPrivateArtifactSet,
  writePrivateFileAtomically,
} from "./qa-state-pull";
import { DEFAULT_STALE_DAYS, findStaleCases, type StaleCase } from "./qa-status";
import { type Catalog, type CatalogCase, loadCatalog, SEVERITY_VALUES } from "./qa-workbook-build";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.join(scriptDir, "..", "..");

export interface ReportWindow {
  start: string;
  end: string;
  /** Whether the caller scoped the session or the slug's calendar day stood in for it. */
  source: "flag" | "slug-day";
  /** Set when the end was pulled back to the snapshot time, so the report says what it covers. */
  clampedTo?: string;
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
  /** Attributed notes — private detail the public renderer never reads. */
  notes: string;
}

/** Standing verdicts compared case by case against an earlier pulled session. */
export interface ReportDelta {
  baseline: string;
  newlyFailing: string[];
  newlyBlocked: string[];
  fixed: string[];
  stillFailing: string[];
  stillBlocked: string[];
  /** Fail or Blocked in the baseline, now missing, note-only, or N/A — a cleared entry is not a fix. */
  cleared: string[];
  /** Keys on either side that are not active catalog cases — reported, never dropped, never published. */
  unknown: string[];
}

export interface ReportModel {
  slug: string;
  window: ReportWindow;
  windowNote?: string;
  pulledAt: string;
  build?: { client?: string; admin?: string };
  staleDays: number;
  /** How many issue notes came from results.csv rather than the raw state. */
  notesFromResults: number;
  byPriority: Record<string, Bucket>;
  byKind: Record<string, Bucket>;
  byTab: Record<string, Bucket>;
  issues: ReportIssue[];
  gaps: { neverWalked: Record<string, string[]>; stale: StaleCase[] };
  /** Fail or Blocked as standing verdict, but untouched inside the window. */
  standing: { failing: string[]; blocked: string[] };
  delta: ReportDelta | null;
  testers: { count: number; perPerson: Record<string, { touched: number; decided: number }> };
}

export interface ReportOptions {
  slug: string;
  pulledAt: string;
  window?: ReportWindow;
  build?: { client?: string; admin?: string };
  staleDays?: number;
  /**
   * An earlier qa-state.json to diff against. Shards keep one entry per case per
   * tester and a re-record overwrites the previous verdict, so this snapshot is
   * the only place a pre-session verdict survives.
   */
  previous?: { path: string; entries: MergedEntries };
  /**
   * Test ID → notes text from results.csv. results.csv is unwindowed, so a cell
   * only wins when it differs from what the raw state would have written there —
   * that is, when someone redacted or corrected it.
   */
  noteOverrides?: Map<string, string>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// A zone-less ISO string parses as host-local time, and the same command would
// then select different entries on different machines.
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * The store is long-lived and the pull merges every shard ever written, so only
 * entries inside the window are this session's verdicts. Without an explicit
 * window the slug's UTC day stands in, the same fallback the routine uses.
 */
export function parseWindow(flag: string | undefined, slug: string): ReportWindow {
  if (!flag) {
    const day = slug.slice(0, 10);
    // Round-trip the parse: "2026-02-30" would otherwise silently become March 2.
    const parsed = Date.parse(`${day}T00:00:00.000Z`);
    if (!DAY.test(day) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== day) {
      throw new Error(`slug '${slug}' does not start with a real YYYY-MM-DD date; pass --window`);
    }
    return { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z`, source: "slug-day" };
  }
  const parts = flag.split("..").map((part) => part.trim());
  if (parts.length !== 2 || !parts.every((part) => ZONED.test(part))) {
    throw new Error("--window must be <startISO>..<endISO>, each with a time zone (Z or ±HH:MM)");
  }
  const start = Date.parse(parts[0]);
  const end = Date.parse(parts[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("--window must be <startISO>..<endISO>, each with a time zone (Z or ±HH:MM)");
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

function compareStanding(cases: CatalogCase[], current: MergedEntries, previous: { path: string; entries: MergedEntries }): ReportDelta {
  const delta: ReportDelta = {
    baseline: previous.path,
    newlyFailing: [],
    newlyBlocked: [],
    fixed: [],
    stillFailing: [],
    stillBlocked: [],
    cleared: [],
    unknown: [],
  };
  for (const testCase of cases) {
    const before = rollupVerdict(previous.entries[testCase.id]);
    const now = rollupVerdict(current[testCase.id]);
    if (now === "Fail") (before === "Fail" ? delta.stillFailing : delta.newlyFailing).push(testCase.id);
    else if (now === "Blocked") (before === "Blocked" ? delta.stillBlocked : delta.newlyBlocked).push(testCase.id);
    else if (before === "Fail" || before === "Blocked") (now === "Pass" ? delta.fixed : delta.cleared).push(testCase.id);
  }
  const active = new Set(cases.map((testCase) => testCase.id));
  delta.unknown = [...new Set([...Object.keys(previous.entries), ...Object.keys(current)])]
    .filter((id) => !active.has(id))
    .sort();
  return delta;
}

export function buildReportModel(cases: CatalogCase[], entries: MergedEntries, options: ReportOptions): ReportModel {
  let window = options.window ?? parseWindow(undefined, options.slug);
  let windowNote: string | undefined;
  const pulledAtMs = Date.parse(options.pulledAt);
  if (!ZONED.test(options.pulledAt) || !Number.isFinite(pulledAtMs)) {
    throw new Error("snapshot pull time must be a valid timestamp with a time zone");
  }
  if (pulledAtMs < Date.parse(window.start)) {
    throw new Error("snapshot pull time precedes the report window");
  }
  // The routine pads the call end by an hour but pulls right away; a snapshot
  // cannot hold entries recorded after it, so say exactly what the report covers.
  if (Number.isFinite(pulledAtMs) && pulledAtMs < Date.parse(window.end)) {
    const clampedTo = new Date(pulledAtMs).toISOString();
    windowNote = `Window end clamped to the pull time ${clampedTo}: entries recorded after it are not in this snapshot — re-run qa:pull once the window has closed, then re-run this report.`;
    window = { ...window, end: clampedTo, clampedTo };
  }
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const session = new Map(cases.map((testCase) => [testCase.id, sessionEntries(entries[testCase.id], window)]));
  // null = nobody touched the case inside the window; "" = touched, no verdict yet.
  const verdictOf = (testCase: CatalogCase): string | null => {
    const byPerson = session.get(testCase.id) ?? {};
    return Object.keys(byPerson).length ? rollupVerdict(byPerson) : null;
  };
  const walked = cases.filter((testCase) => verdictOf(testCase) !== null);
  const untouched = cases.filter((testCase) => verdictOf(testCase) === null);

  let notesFromResults = 0;
  const issues = walked.flatMap((testCase): ReportIssue[] => {
    const verdict = verdictOf(testCase);
    if (verdict !== "Fail" && verdict !== "Blocked") return [];
    const cell = options.noteOverrides?.get(testCase.id);
    const override = cell !== undefined && cell !== notesFor(entries[testCase.id]) ? cell : undefined;
    if (override !== undefined) notesFromResults += 1;
    return [{
      id: testCase.id,
      priority: testCase.priority,
      kind: testCase.kind,
      area: testCase.area,
      verdict,
      notes: override ?? notesFor(session.get(testCase.id)),
    }];
  });

  const standingVerdict = (testCase: CatalogCase) => rollupVerdict(entries[testCase.id]);
  const neverWalked: Record<string, string[]> = {};
  for (const testCase of untouched) (neverWalked[testCase.priority] ??= []).push(testCase.id);

  // Tester labels are self-declared display names: a Map keeps "__proto__" a tester, not a prototype.
  const perPerson = new Map<string, { touched: number; decided: number }>();
  for (const byPerson of session.values()) {
    for (const [person, entry] of Object.entries(byPerson)) {
      const tally = perPerson.get(person) ?? { touched: 0, decided: 0 };
      tally.touched += 1;
      if (rollupVerdict({ [person]: entry })) tally.decided += 1;
      perPerson.set(person, tally);
    }
  }
  const sortedPeople = Object.fromEntries([...perPerson].sort(([a], [b]) => a.localeCompare(b)));

  return {
    slug: options.slug,
    window,
    windowNote,
    pulledAt: options.pulledAt,
    build: options.build,
    staleDays,
    notesFromResults,
    byPriority: groupBuckets(cases, (testCase) => testCase.priority, SEVERITY_VALUES, verdictOf),
    byKind: groupBuckets(cases, (testCase) => testCase.kind, [], verdictOf),
    byTab: groupBuckets(cases, (testCase) => testCase.tab, [...new Set(cases.map((testCase) => testCase.tab))], verdictOf),
    issues,
    gaps: { neverWalked, stale: findStaleCases(cases, entries, staleDays, new Date(window.end)) },
    standing: {
      failing: untouched.filter((testCase) => standingVerdict(testCase) === "Fail").map((testCase) => testCase.id),
      blocked: untouched.filter((testCase) => standingVerdict(testCase) === "Blocked").map((testCase) => testCase.id),
    },
    delta: options.previous ? compareStanding(cases, entries, options.previous) : null,
    testers: { count: perPerson.size, perPerson: sortedPeople },
  };
}

export interface RenderOptions {
  variant: "private" | "public";
}

const idList = (ids: string[]) => ids.map((id) => `\`${id}\``).join(", ");
const countedLine = (label: string, ids: string[]) => `- ${label} (${ids.length}): ${ids.length ? idList(ids) : "none"}`;
/** Notes and tester names are free text: a line break must never start a heading or list item. */
const oneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, " / ").trim();

/** The parent template's line shape: zero segments are dropped rather than rendered. */
function resultsLine(label: string, counts: Bucket): string {
  const segments = [
    counts.pass && `${counts.pass} pass`,
    counts.fail && `${counts.fail} fail`,
    counts.blocked && `${counts.blocked} blocked`,
    counts.na && `${counts.na} n/a`,
    counts.noted && `${counts.noted} noted only`,
  ].filter(Boolean);
  return `- ${label}: ${counts.walked}/${counts.total}${segments.length ? ` — ${segments.join(" · ")}` : ""}`;
}

export function renderReport(model: ReportModel, catalog: Pick<Catalog, "kinds">, options: RenderOptions): string {
  const isPublic = options.variant === "public";
  const kindLabel = (id: string) => catalog.kinds.find((kind) => kind.id === id)?.label ?? id;
  // hasOwn, not `in`: a declared kind named like an Object.prototype member must not become a bucket.
  const kindOrder = [
    ...catalog.kinds.map((kind) => kind.id).filter((id) => Object.hasOwn(model.byKind, id)),
    ...Object.keys(model.byKind).filter((id) => !catalog.kinds.some((kind) => kind.id === id)),
  ];
  // Build shas stay in the private report: the public projection is catalog ids, counts, and timestamps.
  const build =
    model.build && !isPublic
      ? [model.build.client && `client \`${model.build.client}\``, model.build.admin && `admin \`${model.build.admin}\``].filter(Boolean)
      : [];
  const header = [
    `QA session ${model.slug}`,
    `Window: ${model.window.start} – ${model.window.end} (${model.window.source === "flag" ? "from --window" : "slug day, UTC"}) · pulled ${model.pulledAt}`,
    ...(model.windowNote ? [`Caveat: ${model.windowNote}`] : []),
    ...(build.length ? [`Build under test: ${build.join(" · ")}`] : []),
    ...(!isPublic && model.notesFromResults
      ? [`Notes: results.csv for ${model.notesFromResults} case(s) — redactions and corrections honored`]
      : []),
  ];
  // P0 gaps are what a release sweep must see, so they are listed in full; the
  // lower bands are counts only — a lightly walked session would otherwise
  // print a hundred IDs inline.
  const neverWalked = Object.entries(model.gaps.neverWalked).sort(
    ([a], [b]) =>
      SEVERITY_VALUES.indexOf(a as (typeof SEVERITY_VALUES)[number]) -
      SEVERITY_VALUES.indexOf(b as (typeof SEVERITY_VALUES)[number]),
  );
  const neverWalkedCounts = neverWalked.map(([priority, ids]) => `${priority} (${ids.length})`);
  const neverWalkedP0 = model.gaps.neverWalked.P0 ?? [];
  const stale = model.gaps.stale.map(({ id, lastEntryAt }) => `\`${id}\` — last entry ${lastEntryAt}`);
  // Unknown keys and the baseline path are the two delta fields not drawn from the
  // catalog; the public variant carries their counts, never their text.
  const delta = model.delta
    ? [
        isPublic ? "## Delta vs previous snapshot" : `## Delta vs ${model.delta.baseline}`,
        countedLine("Newly failing", model.delta.newlyFailing),
        countedLine("Newly blocked", model.delta.newlyBlocked),
        countedLine("Fixed", model.delta.fixed),
        countedLine("Cleared without a pass", model.delta.cleared),
        countedLine("Still failing", model.delta.stillFailing),
        countedLine("Still blocked", model.delta.stillBlocked),
        ...(model.delta.unknown.length
          ? [
              isPublic
                ? `- Unknown or retired on one side (${model.delta.unknown.length}): withheld in the public variant`
                : countedLine("Unknown or retired on one side", model.delta.unknown),
            ]
          : []),
      ]
    : ["## Delta", "- No baseline supplied — pass --previous <earlier qa-state.json> to compare."];
  const testerCount = `- ${model.testers.count} ${model.testers.count === 1 ? "tester" : "testers"}`;

  const sections = [
    header,
    ["## Results by priority", ...Object.entries(model.byPriority).map(([priority, counts]) => resultsLine(priority, counts))],
    ["## Results by kind", ...kindOrder.map((id) => resultsLine(kindLabel(id), model.byKind[id]))],
    [
      "## Issues",
      ...(model.issues.length
        ? model.issues.map((issue) => {
            const line = `- \`${issue.id}\` · ${issue.priority} · ${kindLabel(issue.kind)} · ${issue.area} — ${issue.verdict}`;
            const notes = oneLine(issue.notes);
            return isPublic || !notes ? line : `${line} — ${notes}`;
          })
        : ["- None"]),
    ],
    [
      "## Coverage gaps",
      `- Never walked this session: ${neverWalkedCounts.length ? neverWalkedCounts.join(" · ") : "none"}`,
      ...(neverWalkedP0.length ? [`- P0 not walked: ${idList(neverWalkedP0)}`] : []),
      `- Stale (>${model.staleDays} days by entry timestamp) (${stale.length}): ${stale.length ? stale.join(", ") : "none"}`,
    ],
    delta,
    [
      "## Standing issues outside the window",
      countedLine("Failing", model.standing.failing),
      countedLine("Blocked", model.standing.blocked),
    ],
    [
      "## Testers",
      testerCount,
      ...(isPublic
        ? []
        : Object.entries(model.testers.perPerson).map(
            ([person, tally]) => `- ${oneLine(person)}: ${tally.touched} touched · ${tally.decided} decided`,
          )),
    ],
  ];
  return `${sections.map((lines) => `${lines.join("\n")}\n`).join("\n")}`;
}

export interface CliOptions {
  slug: string;
  window?: string;
  previous?: string;
  build?: { client?: string; admin?: string };
  public: boolean;
  staleDays: number;
  out?: string;
}

const VALUE_FLAGS = new Set(["--slug", "--window", "--previous", "--build", "--stale-days", "--out"]);
// Both values are printed in report headers, the public one included: keep them to identifiers.
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const COMMIT_SHA = /^[0-9a-f]{7,40}$/;

function parseBuild(value: string): { client?: string; admin?: string } {
  const build: { client?: string; admin?: string } = {};
  for (const pair of value.split(",")) {
    const [surface, sha] = pair.split("=");
    if ((surface !== "client" && surface !== "admin") || !COMMIT_SHA.test(sha?.trim() ?? "")) {
      throw new Error("--build must be client=<sha>,admin=<sha> (either or both, hex commit shas)");
    }
    build[surface] = sha.trim();
  }
  return build;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { slug: "", public: false, staleDays: DEFAULT_STALE_DAYS };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--public") {
      options.public = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) throw new Error(`unknown argument '${flag}'`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for '${flag}'`);
    index++;
    if (flag === "--slug") {
      if (!SLUG.test(value)) throw new Error("--slug must be an identifier (letters, digits, . _ -; max 64)");
      options.slug = value;
    }
    else if (flag === "--window") options.window = value;
    else if (flag === "--previous") options.previous = value;
    else if (flag === "--out") options.out = value;
    else if (flag === "--build") options.build = parseBuild(value);
    else {
      options.staleDays = Number(value);
      if (!Number.isInteger(options.staleDays) || options.staleDays <= 0) {
        throw new Error("--stale-days must be a positive whole number");
      }
    }
  }
  if (!options.slug) throw new Error("--slug is required");
  return options;
}

interface PulledState {
  slug?: string;
  pulledAt?: string;
  entries: MergedEntries;
}

/** Parse pulled state text without ever quoting its contents — notes live in there. */
function parseState(text: string, label: string): PulledState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  const entries = (parsed as { entries?: unknown } | null)?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error(`${label} has no entries object`);
  }
  return parsed as PulledState;
}

function readState(filePath: string, label: string): PulledState {
  return parseState(readFileSync(filePath, "utf8"), label);
}

/** Minimal RFC 4180 reader for our own results.csv: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** csvField prefixes a formula-looking cell with an apostrophe on the way out; take it off on the way in. */
const unescapeFormula = (value: string) => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

/**
 * Test ID → notes from results.csv. A row's Notes cell is authoritative even when
 * empty: the pull refuses to overwrite that file precisely because redactions and
 * corrections live only there.
 */
export function resultsNotes(text: string): Map<string, string> {
  const [header, ...rows] = parseCsv(text);
  const idAt = header?.indexOf("Test ID") ?? -1;
  const notesAt = header?.indexOf("Notes") ?? -1;
  if (idAt < 0 || notesAt < 0) throw new Error("results.csv has no Test ID and Notes columns");
  const notes = new Map<string, string>();
  for (const row of rows) {
    const id = unescapeFormula(row[idAt] ?? "").trim();
    if (id) notes.set(id, unescapeFormula(row[notesAt] ?? "").trim());
  }
  return notes;
}

export async function runReport(
  options: CliOptions,
  deps: { catalog: Catalog; repoRoot: string; afterSnapshotVerified?: () => void },
): Promise<{ report: string; publicReport?: string; windowNote?: string }> {
  const privateRoot = path.join(deps.repoRoot, "tmp");
  const outDir = path.resolve(deps.repoRoot, options.out ?? path.join("tmp", "qa-session", options.slug));
  const relativeToPrivateRoot = path.relative(privateRoot, outDir);
  if (
    relativeToPrivateRoot === ".." ||
    relativeToPrivateRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToPrivateRoot)
  ) {
    throw new Error("--out must stay under the repo's gitignored tmp/ directory — the report carries tester names and notes");
  }
  assertPrivateOutputPath(deps.repoRoot, outDir);
  const statePath = path.join(outDir, "qa-state.json");
  if (!existsSync(statePath)) {
    throw new Error(
      `${path.relative(deps.repoRoot, statePath)} is missing — run bun run qa:pull --slug ${options.slug} first`,
    );
  }
  const lock = acquirePrivateSessionLock(outDir, "qa:report");
  try {
    const stateText = readFileSync(statePath, "utf8");
    const state = parseState(stateText, "qa-state.json");
    if (state.slug !== options.slug) {
      throw new Error("qa-state.json belongs to a different session slug");
    }
    const resultsPath = path.join(outDir, "results.csv");
    const resultsText = existsSync(resultsPath) ? readFileSync(resultsPath, "utf8") : undefined;
    verifyPrivateArtifactSet(
      outDir,
      {
        "qa-state.json": stateText,
        ...(resultsText === undefined ? {} : { "results.csv": resultsText }),
      },
      undefined,
      lock,
    );
    deps.afterSnapshotVerified?.();
    const noteOverrides = resultsText === undefined ? undefined : resultsNotes(resultsText);
    let previous: ReportOptions["previous"];
    if (options.previous) {
      const previousPath = path.resolve(deps.repoRoot, options.previous);
      if (!existsSync(previousPath)) throw new Error(`--previous file ${options.previous} is missing`);
      previous = { path: options.previous, entries: readState(previousPath, "--previous file").entries };
    }
    const window = parseWindow(options.window, options.slug);
    const active = deps.catalog.cases.filter((testCase) => testCase.status !== "retired");
    const model = buildReportModel(active, state.entries, {
      slug: options.slug,
      pulledAt: state.pulledAt ?? "unknown",
      window,
      build: options.build,
      staleDays: options.staleDays,
      previous,
      noteOverrides,
    });

    const report = path.join(outDir, "report.md");
    writePrivateFileAtomically(report, renderReport(model, deps.catalog, { variant: "private" }));
    if (!options.public) return { report, windowNote: model.windowNote };
    const publicReport = path.join(outDir, "report.public.md");
    writePrivateFileAtomically(publicReport, renderReport(model, deps.catalog, { variant: "public" }));
    return { report, publicReport, windowNote: model.windowNote };
  } finally {
    releasePrivateSessionLock(lock);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog();
  const written = await runReport(options, { catalog, repoRoot: defaultRepoRoot });
  const relative = (target: string) => path.relative(defaultRepoRoot, target);
  if (written.windowNote) process.stderr.write(`qa:report: ${written.windowNote}\n`);
  process.stdout.write(
    `qa:report: wrote ${relative(written.report)}${written.publicReport ? ` and ${relative(written.publicReport)}` : ""}\n`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`qa:report failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
