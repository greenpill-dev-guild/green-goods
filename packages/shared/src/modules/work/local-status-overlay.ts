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

import type { Work, WorkDisplayStatus } from "../../types/domain";

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
 * back to pending because one request failed.
 */
export function resolveWorkStatus(
  indexedStatus: IndexedWorkStatus,
  cached: OverlayWork | undefined,
  now: number = Date.now()
): WorkDisplayStatus {
  if (indexedStatus === null) return cached?.status ?? "pending";
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
