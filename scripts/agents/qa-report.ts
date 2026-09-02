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
 * kept under gitignored tmp/ behind the receipt's upload gate. `--public` adds
 * `report.public.md`, projected by the qa:status rule — catalog IDs, counts, and
 * timestamps only — for the docs example and the Discord lede, nothing else.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Entry, type MergedEntries, notesFor, rollupVerdict } from "./qa-state";
import { DEFAULT_STALE_DAYS, findStaleCases, type StaleCase } from "./qa-status";
import { type Catalog, type CatalogCase, loadCatalog, SEVERITY_VALUES } from "./qa-workbook-build";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.join(scriptDir, "..", "..");

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

/** Standing verdicts compared case by case against an earlier pulled session. */
export interface ReportDelta {
  baseline: string;
  newlyFailing: string[];
  newlyBlocked: string[];
  fixed: string[];
  stillFailing: string[];
  stillBlocked: string[];
  /** IDs on either side that are not active catalog cases — reported, never dropped. */
  unknown: string[];
}

export interface ReportModel {
  slug: string;
  window: ReportWindow;
  pulledAt: string;
  build?: { client?: string; admin?: string };
  staleDays: number;
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

function compareStanding(cases: CatalogCase[], current: MergedEntries, previous: { path: string; entries: MergedEntries }): ReportDelta {
  const delta: ReportDelta = {
    baseline: previous.path,
    newlyFailing: [],
    newlyBlocked: [],
    fixed: [],
    stillFailing: [],
    stillBlocked: [],
    unknown: [],
  };
  for (const testCase of cases) {
    const before = rollupVerdict(previous.entries[testCase.id]);
    const now = rollupVerdict(current[testCase.id]);
    if (now === "Fail") (before === "Fail" ? delta.stillFailing : delta.newlyFailing).push(testCase.id);
    else if (now === "Blocked") (before === "Blocked" ? delta.stillBlocked : delta.newlyBlocked).push(testCase.id);
    else if (now === "Pass" && (before === "Fail" || before === "Blocked")) delta.fixed.push(testCase.id);
  }
  const active = new Set(cases.map((testCase) => testCase.id));
  delta.unknown = [...new Set([...Object.keys(previous.entries), ...Object.keys(current)])]
    .filter((id) => !active.has(id))
    .sort();
  return delta;
}

export function buildReportModel(cases: CatalogCase[], entries: MergedEntries, options: ReportOptions): ReportModel {
  const window = options.window ?? parseWindow(undefined, options.slug);
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
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
    staleDays,
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
    testers: { count: Object.keys(sortedPeople).length, perPerson: sortedPeople },
  };
}

export interface RenderOptions {
  variant: "private" | "public";
}

const idList = (ids: string[]) => ids.map((id) => `\`${id}\``).join(", ");
const countedLine = (label: string, ids: string[]) => `- ${label} (${ids.length}): ${ids.length ? idList(ids) : "none"}`;

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
  const kindOrder = [
    ...catalog.kinds.map((kind) => kind.id).filter((id) => id in model.byKind),
    ...Object.keys(model.byKind).filter((id) => !catalog.kinds.some((kind) => kind.id === id)),
  ];
  const build = model.build
    ? [model.build.client && `client \`${model.build.client}\``, model.build.admin && `admin \`${model.build.admin}\``].filter(Boolean)
    : [];
  const header = [
    `QA session ${model.slug}`,
    `Window: ${model.window.start} – ${model.window.end} (${model.window.source === "flag" ? "from --window" : "slug day, UTC"}) · pulled ${model.pulledAt}`,
    ...(build.length ? [`Build under test: ${build.join(" · ")}`] : []),
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
  const delta = model.delta
    ? [
        `## Delta vs ${model.delta.baseline}`,
        countedLine("Newly failing", model.delta.newlyFailing),
        countedLine("Newly blocked", model.delta.newlyBlocked),
        countedLine("Fixed", model.delta.fixed),
        countedLine("Still failing", model.delta.stillFailing),
        countedLine("Still blocked", model.delta.stillBlocked),
        ...(model.delta.unknown.length ? [countedLine("Unknown or retired on one side", model.delta.unknown)] : []),
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
            return isPublic || !issue.notes ? line : `${line} — ${issue.notes}`;
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
        : Object.entries(model.testers.perPerson).map(([person, tally]) => `- ${person}: ${tally.touched} touched · ${tally.decided} decided`)),
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

function parseBuild(value: string): { client?: string; admin?: string } {
  const build: { client?: string; admin?: string } = {};
  for (const pair of value.split(",")) {
    const [surface, sha] = pair.split("=");
    if ((surface !== "client" && surface !== "admin") || !sha?.trim()) {
      throw new Error("--build must be client=<sha>,admin=<sha> (either or both)");
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
    if (flag === "--slug") options.slug = value;
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
  pulledAt?: string;
  entries: MergedEntries;
}

/** Parse a pulled state file without ever quoting its contents — notes live in there. */
function readState(filePath: string, label: string): PulledState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  const entries = (parsed as { entries?: unknown } | null)?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error(`${label} has no entries object`);
  }
  return parsed as PulledState;
}

export async function runReport(
  options: CliOptions,
  deps: { catalog: Catalog; repoRoot: string },
): Promise<{ report: string; publicReport?: string }> {
  const outDir = path.resolve(deps.repoRoot, options.out ?? path.join("tmp", "qa-session", options.slug));
  const statePath = path.join(outDir, "qa-state.json");
  if (!existsSync(statePath)) {
    throw new Error(
      `${path.relative(deps.repoRoot, statePath)} is missing — run bun run qa:pull --slug ${options.slug} first`,
    );
  }
  const state = readState(statePath, "qa-state.json");
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
  });

  const report = path.join(outDir, "report.md");
  writeFileSync(report, renderReport(model, deps.catalog, { variant: "private" }));
  if (!options.public) return { report };
  const publicReport = path.join(outDir, "report.public.md");
  writeFileSync(publicReport, renderReport(model, deps.catalog, { variant: "public" }));
  return { report, publicReport };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog();
  const written = await runReport(options, { catalog, repoRoot: defaultRepoRoot });
  const relative = (target: string) => path.relative(defaultRepoRoot, target);
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
