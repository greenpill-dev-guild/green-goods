import type { Address } from "../../types/domain";
import type { CommitmentReadModel } from "./types";

export type ConfirmQueueEligibility =
  | "ORDINARY"
  | "POOL_FALLBACK"
  | "PROTOCOL_FALLBACK"
  | "DISPUTED";

export interface ConfirmQueueProjectionRow {
  commitment: CommitmentReadModel;
  /** The garden whose authority performs the confirmation or dispute act. */
  garden: Address;
  gardenName: string;
  eligibility: ConfirmQueueEligibility;
  title: string | null;
  poolGarden?: Address | null;
  /** The pool's garden by name, when the commitment lives outside the confirming garden. */
  poolGardenName?: string | null;
  canDispute?: boolean;
}

export interface ConfirmQueueProjectionInput {
  groups: ReadonlyArray<{
    garden: Address;
    gardenName: string;
    rows: ReadonlyArray<{
      commitment: CommitmentReadModel;
      poolGarden?: Address | null;
      poolGardenName?: string | null;
      canDispute?: boolean;
    }>;
  }>;
  fallback?: ReadonlyArray<{
    commitment: CommitmentReadModel;
    path: "POOL_FALLBACK" | "PROTOCOL_FALLBACK";
    garden: Address;
    gardenName: string;
    poolGarden?: Address | null;
    poolGardenName?: string | null;
    canDispute?: boolean;
  }>;
  disputed?: ReadonlyArray<{
    commitment: CommitmentReadModel;
    garden: Address;
    gardenName: string;
  }>;
}

type MetadataTitleMap = ReadonlyMap<string, { title?: string | null }>;

export function selectConfirmQueueRows(input: {
  toConfirm: ConfirmQueueProjectionInput;
  byCID: MetadataTitleMap;
  search: string;
  include?: readonly ConfirmQueueEligibility[];
}): ConfirmQueueProjectionRow[] {
  const { toConfirm, byCID, search, include } = input;
  const titleOf = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && byCID.get(commitment.metadataCID.trim())?.title) ?? null;

  const ordinary = toConfirm.groups.flatMap((group) =>
    group.rows.map((row) => ({
      commitment: row.commitment,
      garden: group.garden,
      gardenName: group.gardenName,
      eligibility: "ORDINARY" as const,
      title: titleOf(row.commitment),
      poolGarden: row.poolGarden,
      poolGardenName: row.poolGardenName,
      canDispute: row.canDispute,
    }))
  );
  const fallback = (toConfirm.fallback ?? []).map((row) => ({
    commitment: row.commitment,
    garden: row.garden,
    gardenName: row.gardenName,
    eligibility: row.path,
    title: titleOf(row.commitment),
    poolGarden: row.poolGarden,
    poolGardenName: row.poolGardenName,
    canDispute: row.canDispute,
  }));
  const disputed = (toConfirm.disputed ?? []).map((row) => ({
    commitment: row.commitment,
    garden: row.garden,
    gardenName: row.gardenName,
    eligibility: "DISPUTED" as const,
    title: titleOf(row.commitment),
    poolGarden: row.garden,
    poolGardenName: row.gardenName,
    canDispute: true,
  }));
  const included = include ? new Set(include) : null;
  const rows = [...ordinary, ...fallback, ...disputed].filter(
    (row) => !included || included.has(row.eligibility)
  );
  return rows.filter((row) => matchesConfirmSearch(row, search));
}

/** Whether a row answers the Hub's search: its title, its garden, or its pool's garden. */
export function matchesConfirmSearch(
  row: Pick<ConfirmQueueProjectionRow, "title" | "gardenName" | "poolGardenName">,
  search: string
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    (row.title ?? "").toLowerCase().includes(needle) ||
    row.gardenName.toLowerCase().includes(needle) ||
    (row.poolGardenName ?? "").toLowerCase().includes(needle)
  );
}

/*
 * The queue held steady for one visit (PRD-1045), the way Waiting for
 * approval is: every row seen keeps its place in the order it was first seen,
 * a row confirmed here turns into its outcome in place and stays until the
 * steward leaves the tab, and a row that leaves the queue with no decision
 * here was settled elsewhere and stays as gone. Copies of a group are rows of
 * their own, confirmed one by one.
 */

/** The key a row, and a decision on it, go by: the confirming garden and the promise. */
export function confirmRowKey(
  row: Pick<ConfirmQueueProjectionRow, "garden" | "commitment">
): string {
  return `${row.garden.toLowerCase()}:${row.commitment.id}`;
}

export interface ConfirmVisitEntry<R> {
  key: string;
  /** The row as last read, kept once the queue stops listing it. */
  row: R;
}

/**
 * The visit after a settled read: known rows keep their place with the row as
 * now read, and rows not seen before join the end.
 */
export function reconcileConfirmVisit<
  R extends Pick<ConfirmQueueProjectionRow, "garden" | "commitment">,
>(entries: readonly ConfirmVisitEntry<R>[], live: readonly R[]): ConfirmVisitEntry<R>[] {
  const byKey = new Map(live.map((row) => [confirmRowKey(row), row]));
  const next = entries.map((entry) => {
    const row = byKey.get(entry.key);
    return row && row !== entry.row ? { key: entry.key, row } : entry;
  });
  const known = new Set(next.map((entry) => entry.key));
  for (const [key, row] of byKey) {
    if (!known.has(key)) next.push({ key, row });
  }
  return next;
}

/** A confirmation made here this visit: landed, or queued on this device to send. */
export interface ConfirmDecision {
  kind: "confirmed" | "queued";
  /** When it settled, in milliseconds. */
  at: number;
}

export type ConfirmRowState =
  | { status: "waiting" }
  | { status: "confirmed"; at: number }
  | { status: "queued"; at: number }
  | { status: "gone" };

/** Where one row stands this visit: this visit's decision, then whether the queue still lists it. */
export function confirmRowState(
  key: string,
  input: { live: ReadonlySet<string>; decisions: Readonly<Record<string, ConfirmDecision>> }
): ConfirmRowState {
  const decision = input.decisions[key];
  if (decision) return { status: decision.kind, at: decision.at };
  return input.live.has(key) ? { status: "waiting" } : { status: "gone" };
}
