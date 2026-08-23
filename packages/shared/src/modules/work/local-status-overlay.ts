/**
 * Local status overlay resolution.
 *
 * A work item's status has two sources: the status the indexer computes from
 * on-chain approvals, and a locally cached overlay the approval hooks write
 * while a decision is in flight or freshly confirmed.
 *
 * The overlay exists only to cover indexer lag. It must not outlive that
 * purpose — a cached "approved" that survives a dropped transaction shows an
 * steward a decision that never landed on chain.
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
   * their queued job completes.
   */
  _pendingUntilMs?: number;
  /** Hash of the submitted transaction, once one exists. */
  _txHash?: string;
};

/**
 * How long a locally recorded decision keeps precedence over the indexer.
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
 * Offline jobs (pending with no deadline) stay live until their queued job
 * completes. Everything else expires, so a dropped or reverted transaction
 * falls back to indexed truth instead of sticking resolved forever.
 */
export function isLocalOverlayLive(
  cached: OverlayWork | undefined,
  now: number = Date.now()
): boolean {
  if (!cached) return false;
  if (cached._isPending && cached._pendingUntilMs === undefined) return true;
  return (cached._pendingUntilMs ?? 0) > now;
}

/**
 * Resolve which status to display for a work item.
 *
 * The indexer wins the moment it reports a terminal decision — that is the
 * signal the overlay was waiting for. The overlay only fills the gap while the
 * indexer still reports `pending`, and only until its deadline passes.
 */
export function resolveWorkStatus(
  computedStatus: WorkDisplayStatus,
  cached: OverlayWork | undefined,
  now: number = Date.now()
): WorkDisplayStatus {
  if (computedStatus !== "pending") return computedStatus;
  if (!isLocalOverlayLive(cached, now)) return computedStatus;
  return cached?.status ?? computedStatus;
}
