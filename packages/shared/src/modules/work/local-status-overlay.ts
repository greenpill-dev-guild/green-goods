/**
 * Local status overlay resolution.
 *
 * A work item's status has two sources: the status the indexer computes from
 * on-chain approvals, and a locally cached overlay the approval hooks write
 * while a decision is in flight or freshly confirmed.
 *
 * The overlay exists only to cover indexer lag. It must not outlive that
 * purpose — a cached "approved" that survives a dropped transaction shows a
 * steward a decision that never landed on chain. A decision whose transaction
 * was confirmed on chain is different: the attestation exists, so the overlay
 * holds until the indexer reports it rather than until a clock runs out.
 *
 * @module modules/work/local-status-overlay
 */

import type { Work, WorkCard, WorkDisplayStatus } from "../../types/domain";
import type { EASWorkListRow } from "../../types/eas-responses";

/** Work carrying the approval hooks' local overlay markers. */
export type OverlayWork = Work & {
  /** Set while a submission is in flight, or while a queued offline job awaits sync. */
  _isPending?: boolean;
  /**
   * Wall-clock deadline after which the cached status stops outranking the
   * indexer. Left undefined for offline jobs, which stay authoritative until
   * their queued job completes, and for decisions confirmed on chain, which
   * stay authoritative until the indexer reports them.
   */
  _pendingUntilMs?: number;
  /** Hash of the submitted transaction, once one exists. */
  _txHash?: string;
};

type OverlayMarkers = Pick<OverlayWork, "_isPending" | "_pendingUntilMs" | "_txHash">;

/**
 * The status the indexer computed for a work, or `null` when the approvals
 * read failed and nothing is known about approvals this cycle.
 */
export type IndexedWorkStatus = WorkDisplayStatus | null;

/**
 * How long a locally recorded but unconfirmed decision keeps precedence over
 * the indexer.
 *
 * Comfortably past the last `INDEXER_LAG_SCHEDULE_MS` follow-up (15s), so the
 * indexer has answered well before the overlay lapses.
 */
export const LOCAL_OVERLAY_GRACE_MS = 60_000;

/** Deadline to stamp on an overlay written now. */
export function overlayDeadline(now: number = Date.now()): number {
  return now + LOCAL_OVERLAY_GRACE_MS;
}

/**
 * Whether a cached entry may still outrank the indexer.
 *
 * Entries without a deadline hold until the indexer reports: offline jobs
 * (pending with no deadline) until their queued job completes, and decisions
 * confirmed on chain (a transaction hash with no deadline) until the approval
 * is indexed. Everything else expires, so a dropped or reverted transaction
 * falls back to indexed truth instead of sticking resolved forever.
 */
export function isLocalOverlayLive(
  cached: OverlayWork | undefined,
  now: number = Date.now()
): boolean {
  if (!cached) return false;
  if (cached._pendingUntilMs === undefined) {
    return Boolean(cached._isPending) || Boolean(cached._txHash);
  }
  return cached._pendingUntilMs > now;
}

/**
 * Resolve which status to display for a work item.
 *
 * The indexer wins the moment it reports a terminal decision — that is the
 * signal the overlay was waiting for. The overlay only fills the gap while the
 * indexer still reports `pending`, and only while it is live.
 *
 * When the approvals read failed (`indexedStatus` is `null`) nothing new is
 * known, so the last displayed status stands: a reviewed work must never fall
 * back to pending because one request failed. The exception is an unconfirmed
 * decision whose deadline has lapsed: it never landed, so it cannot stand in
 * for what the indexer would say.
 */
export function resolveWorkStatus(
  indexedStatus: IndexedWorkStatus,
  cached: OverlayWork | undefined,
  now: number = Date.now()
): WorkDisplayStatus {
  if (indexedStatus === null) {
    const lapsed = cached?._pendingUntilMs !== undefined && cached._pendingUntilMs <= now;
    return lapsed ? "pending" : (cached?.status ?? "pending");
  }
  if (indexedStatus !== "pending") return indexedStatus;
  if (!isLocalOverlayLive(cached, now)) return indexedStatus;
  return cached?.status ?? indexedStatus;
}

/**
 * Overlay markers to carry onto a freshly indexed row.
 *
 * Kept only while the overlay is live and still the source of the displayed
 * status — that is, while the indexer has not reported the decision. Once it
 * has, or once the overlay lapsed, the row returns to indexed truth and the
 * markers go with it. Without this the markers were lost on the first refetch
 * after a decision, and the next one showed the work pending again.
 */
export function carryOverlayMarkers(
  cached: OverlayWork | undefined,
  indexedStatus: IndexedWorkStatus,
  now: number = Date.now()
): OverlayMarkers {
  if (!cached || !isLocalOverlayLive(cached, now)) return {};
  if (indexedStatus !== null && indexedStatus !== "pending") return {};
  const markers: OverlayMarkers = {};
  if (cached._isPending !== undefined) markers._isPending = cached._isPending;
  if (cached._pendingUntilMs !== undefined) markers._pendingUntilMs = cached._pendingUntilMs;
  if (cached._txHash !== undefined) markers._txHash = cached._txHash;
  return markers;
}

/** Statuses that only exist on this device, never in a garden's indexed read. */
const LOCAL_ONLY_STATUSES: readonly WorkDisplayStatus[] = [
  "syncing",
  "sync_failed",
  "offline",
  "uploading",
];

function isIndexedWork(work: OverlayWork): boolean {
  return !LOCAL_ONLY_STATUSES.includes(work.status) && !work.id.startsWith("0xoffline_");
}

/** The status one indexed row reports: `null` when its approvals could not be read. */
function indexedStatusOf(row: EASWorkListRow | undefined): IndexedWorkStatus {
  if (!row || row.approval === undefined) return null;
  if (row.approval === null) return "pending";
  return row.approval.approved ? "approved" : "rejected";
}

/**
 * Keep saved rows the indexer failed to return this cycle, so an empty or
 * partial read cannot wipe a collection someone is looking at.
 */
function reconcileIndexedWorkCollection(indexed: WorkCard[], saved: OverlayWork[]): WorkCard[] {
  if (saved.length === 0) return indexed;
  const indexedIds = new Set(indexed.map((work) => work.id));
  if (!saved.some((work) => !indexedIds.has(work.id))) return indexed;
  const reconciled = new Map(saved.map((work) => [work.id, work as WorkCard]));
  indexed.forEach((work) => reconciled.set(work.id, work));
  return Array.from(reconciled.values());
}

export interface GardenWorkRowsInput {
  /** The latest garden read, each row carrying its latest approval; undefined before the first read. */
  remote: EASWorkListRow[] | undefined;
  /** The rows last resolved for this garden, restored or kept from an earlier read. */
  saved: OverlayWork[] | undefined;
  /** Decisions the approval hooks wrote on this device. They outrank `saved`. */
  overlay: OverlayWork[] | undefined;
  now?: number;
}

export interface GardenWorkRows {
  rows: OverlayWork[];
  /** Rows whose review status is unknown: approvals unread, and nothing saved or decided here. */
  unknownIds: Set<string>;
}

/**
 * Resolve a garden's indexed read against what this device already knows.
 *
 * Every screen that lists a garden's work resolves it here, so a decision shows
 * the same status everywhere. Each row stands on its own approval read: a row
 * whose approvals failed keeps its last known status, and one with nothing
 * known is reported in `unknownIds` rather than guessed as pending.
 */
export function resolveGardenWorkRows({
  remote,
  saved,
  overlay,
  now = Date.now(),
}: GardenWorkRowsInput): GardenWorkRows {
  const savedRows = (saved ?? []).filter(isIndexedWork);
  const known = new Map(savedRows.map((work) => [work.id, work]));
  for (const work of overlay ?? []) {
    if (isIndexedWork(work)) known.set(work.id, work);
  }
  const remoteById = new Map((remote ?? []).map((row) => [row.id, row]));
  const indexedRows: WorkCard[] = (remote ?? []).map(({ approval: _approval, ...row }) => row);
  const collection =
    remote === undefined ? savedRows : reconcileIndexedWorkCollection(indexedRows, savedRows);

  const unknownIds = new Set<string>();
  const rows = collection.map((work): OverlayWork => {
    const remoteRow = remoteById.get(work.id);
    const indexedStatus = indexedStatusOf(remoteRow);
    const cached = known.get(work.id);
    if (indexedStatus === null && !cached) unknownIds.add(work.id);
    const reference = cached ?? (work as OverlayWork);
    const status = resolveWorkStatus(indexedStatus, reference, now);
    return {
      ...work,
      status,
      ...reviewOf(remoteRow, reference, status),
      ...carryOverlayMarkers(reference, indexedStatus, now),
    };
  });
  return { rows, unknownIds };
}

/**
 * The indexed decision a row shows: when it was indexed and the feedback the
 * gardener reads, else what the row already carried. A decision made on this
 * device has no indexed time until the indexer reports it, and a row that
 * shows no decision, such as a local one that lapsed back to pending, carries
 * no review at all.
 */
function reviewOf(
  row: EASWorkListRow | undefined,
  reference: OverlayWork,
  status: WorkDisplayStatus
): Pick<OverlayWork, "reviewedAt" | "reviewFeedback"> {
  if (status !== "approved" && status !== "rejected") return {};
  const reviewedAt = row?.approval ? row.approval.createdAt : reference.reviewedAt;
  const reviewFeedback = row?.approval ? row.approval.feedback?.trim() : reference.reviewFeedback;
  return {
    ...(typeof reviewedAt === "number" && reviewedAt > 0 ? { reviewedAt } : {}),
    ...(reviewFeedback ? { reviewFeedback } : {}),
  };
}

/**
 * Drop the in-flight flag from an optimistic overlay whose deadline has passed.
 *
 * Entries without a deadline are left alone: they are offline jobs or
 * confirmed decisions, and only the indexer retires those.
 */
export function clearLapsedOverlay<T extends OverlayWork>(work: T, now: number = Date.now()): T {
  if (!work._isPending || work._pendingUntilMs === undefined || work._pendingUntilMs > now) {
    return work;
  }
  return { ...work, _isPending: false, _pendingUntilMs: undefined };
}
