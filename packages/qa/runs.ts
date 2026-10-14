/**
 * Runs — one team pass over the catalog, versioned in the store.
 *
 * The QA app used to keep one verdict per case per tester and overwrite it on
 * re-record, so a re-QA erased the very session it was checking. A run makes
 * a pass immutable: testers record into the open run, a rollover closes it and
 * opens its successor in one conditional write, and the next pass compares
 * itself against the closed one. Exactly one run is open at any time.
 *
 * This module is pure — no Blob, no Node — so the deployed functions and the
 * local rehearsal server (`dev.mjs`, which imports it as `./runs.ts`) share one
 * definition of what a run is. It is written in erasable TypeScript only,
 * because Node strips the types at import time without a build step: no enums,
 * no namespaces, no constructor parameter properties.
 */

export const RUN_INDEX_PATH = "qa/runs.json";
export const LEGACY_SHARD_PREFIX = "qa/entries/";
export const FIRST_RUN_ID = "run-1";
export const LEGACY_RUN_LABEL = "Baseline";
export const ENVIRONMENTS = ["production", "beta", "local"];
export const BUILD_SURFACES = ["client", "admin", "website"];
export const MAX_LABEL_LENGTH = 60;

const RUN_ID = /^run-([1-9]\d{0,5})$/;
const BUILD_SHA = /^[0-9a-f]{7,40}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const MAX_REVISION_LENGTH = 64;
const MAX_RUNS = 10_000;

export type Environment = "production" | "beta" | "local";

/** Which catalog build the run opened with; `null` for the migrated baseline. */
export interface RunCatalog {
  revision: string;
  activeCases: number;
}

export interface RunBuilds {
  client?: string;
  admin?: string;
  website?: string;
}

/** The span of recording a closed run covers. */
export interface RunWindow {
  from: string;
  to: string;
}

export interface RunRecord {
  /** `run-N`; N is also carried as `n` so nothing parses the id back. */
  id: string;
  n: number;
  label: string;
  /** The migrated legacy store: last-known verdicts, not a dated walk. */
  legacy?: true;
  openedAt: string;
  /** Lowercase address, or null for the migrated baseline nobody opened. */
  openedBy: string | null;
  closedAt?: string;
  closedBy?: string;
  environment: Environment;
  catalog: RunCatalog | null;
  builds: RunBuilds;
  /** Null while open; set when the run closes. */
  window: RunWindow | null;
}

export interface RunIndex {
  version: 1;
  updatedAt: string;
  runs: RunRecord[];
}

export interface RolloverInput {
  label: string;
  environment: Environment;
  builds: RunBuilds;
  catalog: RunCatalog | null;
  /** Lowercase address of the tester rolling the run over. */
  by: string;
  now: string;
}

export function runShardPrefix(runId: string): string {
  return `qa/runs/${runId}/entries/`;
}

export function runShardPath(runId: string, address: string): string {
  return `${runShardPrefix(runId)}${address.toLowerCase()}.json`;
}

export function legacyShardPath(address: string): string {
  return `${LEGACY_SHARD_PREFIX}${address.toLowerCase()}.json`;
}

/** "Run 2 · Re-QA 2026-09-08" — the same phrase the page and the scripts print. */
export function describeRun(run: Pick<RunRecord, "n" | "label">): string {
  return `Run ${run.n} · ${run.label}`;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** The id when it is well-formed, else null. Never trusts the request's shape. */
export function validateRunId(value: unknown): string | null {
  return typeof value === "string" && RUN_ID.test(value) ? value : null;
}

export function validateEnvironment(value: unknown): Environment | null {
  return typeof value === "string" && ENVIRONMENTS.includes(value) ? (value as Environment) : null;
}

/** A label is a human phrase, so the only rules are "present" and "fits a line". */
export function cleanLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_LABEL_LENGTH) : "";
}

/**
 * Build SHAs are optional per surface; a present value must be a hex SHA so a
 * run never records "latest" or a branch name as its build under test.
 */
export function cleanBuilds(value: unknown): RunBuilds | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const builds: RunBuilds = {};
  for (const [surface, sha] of Object.entries(value as Record<string, unknown>)) {
    if (!BUILD_SURFACES.includes(surface)) return null;
    if (sha === undefined || sha === null || sha === "") continue;
    if (typeof sha !== "string" || !BUILD_SHA.test(sha.trim().toLowerCase())) return null;
    builds[surface as keyof RunBuilds] = sha.trim().toLowerCase();
  }
  return builds;
}

export function cleanCatalog(value: unknown): RunCatalog | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<RunCatalog>;
  if (typeof candidate.revision !== "string" || !candidate.revision.trim()) return null;
  if (candidate.revision.length > MAX_REVISION_LENGTH) return null;
  if (!Number.isInteger(candidate.activeCases) || (candidate.activeCases as number) < 0) return null;
  return { revision: candidate.revision, activeCases: candidate.activeCases as number };
}

function runRecordShapeError(run: unknown, position: number): string | null {
  if (!run || typeof run !== "object" || Array.isArray(run)) return `run ${position} is not an object`;
  const record = run as Partial<RunRecord>;
  const id = validateRunId(record.id);
  if (!id) return `run ${position} has an invalid id`;
  const n = Number(RUN_ID.exec(id)?.[1]);
  if (record.n !== n) return `${id} carries the wrong number`;
  if (typeof record.label !== "string" || !record.label.trim() || record.label.length > MAX_LABEL_LENGTH) {
    return `${id} has no valid label`;
  }
  if (record.legacy !== undefined && record.legacy !== true) return `${id} has an invalid legacy flag`;
  if (!validDate(record.openedAt)) return `${id} has no valid openedAt`;
  if (record.openedBy !== null && (typeof record.openedBy !== "string" || !ADDRESS.test(record.openedBy))) {
    return `${id} has no valid openedBy`;
  }
  if (record.closedAt !== undefined) {
    if (!validDate(record.closedAt)) return `${id} has an invalid closedAt`;
    if (Date.parse(record.closedAt) < Date.parse(record.openedAt)) return `${id} closes before it opens`;
    if (typeof record.closedBy !== "string" || !ADDRESS.test(record.closedBy)) return `${id} has no valid closedBy`;
  } else if (record.closedBy !== undefined) {
    return `${id} names a closer while open`;
  }
  if (!validateEnvironment(record.environment)) return `${id} has no valid environment`;
  if (record.catalog !== null && cleanCatalog(record.catalog) === null) return `${id} has an invalid catalog`;
  if (cleanBuilds(record.builds) === null || record.builds === undefined) return `${id} has invalid builds`;
  if (record.window !== null) {
    const window = record.window as Partial<RunWindow> | undefined;
    if (!window || typeof window !== "object" || !validDate(window.from) || !validDate(window.to)) {
      return `${id} has an invalid window`;
    }
    if (Date.parse(window.to) < Date.parse(window.from)) return `${id} has a window that ends before it starts`;
  }
  return null;
}

/**
 * Why a parsed index is not one, or null when it is fine.
 *
 * A malformed index would fail every poll for every tester, so the reader
 * refuses it the way a malformed shard is refused: a 503 is recoverable,
 * serving a broken run list to a live session is not. Exactly one run may be
 * open, and it must be the newest, so `openRun` is never ambiguous.
 */
export function runIndexShapeError(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "run index is not an object";
  const index = parsed as Partial<RunIndex>;
  if (index.version !== 1) return "run index has an unsupported version";
  if (!validDate(index.updatedAt)) return "run index has no valid updatedAt";
  if (!Array.isArray(index.runs) || index.runs.length === 0) return "run index has no runs";
  if (index.runs.length > MAX_RUNS) return "run index has too many runs";
  const seen = new Set<string>();
  let previousN = 0;
  let open = 0;
  for (const [position, run] of index.runs.entries()) {
    const problem = runRecordShapeError(run, position + 1);
    if (problem) return problem;
    const record = run as RunRecord;
    if (seen.has(record.id)) return `${record.id} appears twice`;
    seen.add(record.id);
    if (record.n <= previousN) return `${record.id} is out of order`;
    previousN = record.n;
    if (record.closedAt === undefined) open += 1;
  }
  if (open !== 1) return open === 0 ? "run index has no open run" : "run index has more than one open run";
  const last = index.runs[index.runs.length - 1] as RunRecord;
  if (last.closedAt !== undefined) return "the open run is not the newest run";
  return null;
}

/** The single open run. The index is validated before this is called. */
export function openRun(index: RunIndex): RunRecord {
  return index.runs[index.runs.length - 1];
}

export function findRun(index: RunIndex, runId: string): RunRecord | undefined {
  return index.runs.find((run) => run.id === runId);
}

/**
 * Run 1 as the migrated legacy store: last-known verdicts rather than a dated
 * walk, so its window is the span of everything ever recorded, and nobody is
 * recorded as having opened it.
 */
export function legacyRunRecord(
  shards: Array<{ entries: Record<string, { at: string }> } | null>,
  now: string,
): RunRecord {
  let from: string | null = null;
  let to: string | null = null;
  for (const shard of shards) {
    if (!shard) continue;
    for (const entry of Object.values(shard.entries)) {
      if (!validDate(entry.at)) continue;
      if (from === null || Date.parse(entry.at) < Date.parse(from)) from = entry.at;
      if (to === null || Date.parse(entry.at) > Date.parse(to)) to = entry.at;
    }
  }
  return {
    id: FIRST_RUN_ID,
    n: 1,
    label: LEGACY_RUN_LABEL,
    legacy: true,
    openedAt: from ?? now,
    openedBy: null,
    environment: "beta",
    catalog: null,
    builds: {},
    window: from && to ? { from, to } : null,
  };
}

export function initialIndex(first: RunRecord, now: string): RunIndex {
  return { version: 1, updatedAt: now, runs: [first] };
}

/**
 * Close the open run and open its successor in one new index.
 *
 * The caller writes the result conditionally on the ETag it read, so two
 * testers rolling over at once produce one winner and one refusal — never two
 * open runs and never a lost close. Closing never deletes anything.
 */
export function rolloverIndex(
  index: RunIndex,
  input: RolloverInput,
): { index: RunIndex; closed: RunRecord; opened: RunRecord } {
  const current = openRun(index);
  const closed: RunRecord = {
    ...current,
    closedAt: input.now,
    closedBy: input.by,
    // The legacy baseline's window starts at its earliest recorded entry; a
    // dated run's window is exactly the time it was open.
    window: { from: current.window?.from ?? current.openedAt, to: input.now },
  };
  const opened: RunRecord = {
    id: `run-${current.n + 1}`,
    n: current.n + 1,
    label: input.label,
    openedAt: input.now,
    openedBy: input.by,
    environment: input.environment,
    catalog: input.catalog,
    builds: input.builds,
    window: null,
  };
  return {
    index: { version: 1, updatedAt: input.now, runs: [...index.runs.slice(0, -1), closed, opened] },
    closed,
    opened,
  };
}
