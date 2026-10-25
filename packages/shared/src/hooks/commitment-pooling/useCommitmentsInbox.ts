/**
 * useCommitmentsInbox Hook
 *
 * The member's cross-garden commitments surface: everything they are a party to,
 * split by tense and sorted so what needs an act from them leads.
 *
 * Two rules this hook exists to keep in one place:
 *
 * 1. **Tense, not lifecycle.** "Live" is everything still moving; "Over time" is
 *    what has settled. Splitting here means the two tabs can never disagree about
 *    where a commitment lives.
 * 2. **A badge counts acts, never inventory.** Each tab reports what needs an act
 *    *on that tab*, and the header control carries their sum, so the two are
 *    derived from one number rather than computed twice.
 *
 * Given the active garden's scope (DL-129), both rules apply to the promises that
 * involve that garden: those in its pool, those its people work and those it pays
 * for. The queue's notices follow the pool of the promise waiting to send.
 *
 * @module hooks/commitment-pooling/useCommitmentsInbox
 */

import { useMemo } from "react";

import {
  type CommitmentReadModel,
  type CommitmentSeat,
  commitmentNeedsSeat,
  isSettledCommitmentState,
  selectCommitmentSeat,
} from "../../modules/commitment-pooling";
import type { Address } from "../../types/domain";
import { useCommitmentPools, useCommitments } from "./useCommitmentPooling";
import { useCommitmentQueueState } from "./useCommitmentQueueState";

export interface InboxCommitment {
  commitment: CommitmentReadModel;
  /** Where the reader sits. Null only when nobody is signed in. */
  seat: CommitmentSeat | null;
  /** Whether this row is waiting on the reader specifically. */
  needsYou: boolean;
}

export interface CommitmentsInbox {
  /** Still moving: taken up, in progress, awaiting confirmation, under review. */
  live: InboxCommitment[];
  /** Settled: kept, cancelled, lapsed, reconciled. */
  settled: InboxCommitment[];
  /** What needs an act on the Live tab. */
  liveActCount: number;
  /** What needs an act on the Over time tab. Settled work needs nothing. */
  settledActCount: number;
  /** The header control's number: the tabs' sum, so the two cannot disagree. */
  totalActCount: number;
  availability: ReturnType<typeof useCommitments>["availability"];
  isLoading: boolean;
  isError: boolean;
  /**
   * Commitment work that gave up trying to send. A job that dies terminally
   * leaves nothing on any surface — the commitment simply never appears — so
   * the count is surfaced here rather than left to be inferred from an absence.
   */
  failedJobCount: number;
  /** Which commitments those failures belong to, so a row can say so itself. */
  failedCommitmentIds: ReadonlySet<string>;
  /**
   * Failures no row can account for. A commitment that never reached the chain
   * has no id and therefore no row, so it is invisible unless something says so
   * — while the ones that do have rows already say it themselves.
   */
  unlistedFailureCount: number;
  /** A commitment composed on this phone and still waiting to be placed. */
  hasPendingCreate: boolean;
  /**
   * The queue could not be read at all. Distinct from an empty queue: a surface
   * that cannot tell them apart reports no failures precisely when it cannot
   * see any.
   */
  queueUnavailable: boolean;
  refetch: ReturnType<typeof useCommitments>["refetch"];
}

/**
 * Resolve the reader's seat on a row of their own account-scoped list.
 *
 * The list query returns a commitment only when the reader is one of its named
 * parties or is on its team, so a row that matches no party field is one they
 * joined. Passing the viewer as the team lets the shared selector express that
 * without a second query, and the party rungs still win because they are checked
 * first.
 *
 * This shortcut is only sound on an account-scoped list. A browse surface must
 * pass the real team, or every stranger reads as a contributor.
 */
function seatOnOwnList(
  commitment: CommitmentReadModel,
  viewer: Address | undefined
): CommitmentSeat | null {
  if (!viewer) return null;
  return selectCommitmentSeat({ commitment, contributors: [viewer], viewer });
}

export function useCommitmentsInbox({
  chainId,
  viewer,
  inScope,
}: {
  chainId: number;
  viewer?: Address;
  /** The active garden's scope (`useActiveGarden`); without it every garden's are listed. */
  inScope?: (gardens: readonly (string | null | undefined)[]) => boolean;
}): CommitmentsInbox {
  // Without a viewer there is no "mine" to scope to, and an unscoped read would
  // return every commitment on the chain rather than none. Signed out means no
  // inbox, so the query never runs.
  const query = useCommitments({ chainId, account: viewer }, { enabled: Boolean(viewer) });
  // A promise names its pool, and the pool names its garden.
  const pools = useCommitmentPools({ chainId }, { enabled: Boolean(inScope) });

  // Read from the queue rather than counted from events: a counter incremented
  // on job:failed never resets, is lost on unmount, and double-counts because
  // Home and the sheet both mount this hook.
  const { failedCount, failedCommitmentIds, hasPendingCreate, pendingCreates, isUnavailable } =
    useCommitmentQueueState(viewer);
  const { commitments } = query;

  const partitioned = useMemo(() => {
    const live: InboxCommitment[] = [];
    const settled: InboxCommitment[] = [];
    const poolGardens = new Map(
      (pools.data ?? []).map((pool) => [pool.poolId.toString(), pool.garden])
    );
    const poolGarden = (poolId: bigint | string | null | undefined) =>
      poolId === null || poolId === undefined ? null : (poolGardens.get(poolId.toString()) ?? null);
    const involvesScope = (commitment: CommitmentReadModel) =>
      !inScope ||
      inScope([poolGarden(commitment.poolId), commitment.providerGarden, commitment.payerGarden]);

    for (const commitment of viewer ? commitments.filter(involvesScope) : []) {
      const seat = seatOnOwnList(commitment, viewer);
      const isSettled = isSettledCommitmentState(commitment.derivedState);
      // Asked of the one act table, so this count and the detail screen's
      // action bar can never disagree about whether somebody is waiting.
      const needsYou = !isSettled && commitmentNeedsSeat({ commitment, seat });
      (isSettled ? settled : live).push({ commitment, seat, needsYou });
    }

    // What needs you leads, then the most recently touched. Sorting here rather
    // than per tab keeps one order across both.
    const byAttention = (left: InboxCommitment, right: InboxCommitment) => {
      if (left.needsYou !== right.needsYou) return left.needsYou ? -1 : 1;
      return Number(right.commitment.commitmentId - left.commitment.commitmentId);
    };
    live.sort(byAttention);
    settled.sort(byAttention);

    const liveActCount = live.filter((row) => row.needsYou).length;
    const settledActCount = settled.filter((row) => row.needsYou).length;

    // Never negative: every named failure is also counted in the total.
    const unlisted = Math.max(0, failedCount - failedCommitmentIds.size);
    if (!inScope) {
      const notices = { hasPendingCreate, unlistedFailureCount: unlisted };
      return { live, settled, liveActCount, settledActCount, ...notices };
    }
    // A promise still on the phone belongs to its pool's garden. A failure no
    // pool places, a series say, has nowhere else to be said, so it stays.
    const placed = (creation: { poolId: string }) => inScope([poolGarden(creation.poolId)]);
    const failedCreations = pendingCreates.filter((creation) => creation.failed);
    return {
      live,
      settled,
      liveActCount,
      settledActCount,
      hasPendingCreate: pendingCreates.some((creation) => !creation.failed && placed(creation)),
      unlistedFailureCount:
        failedCreations.filter(placed).length + Math.max(0, unlisted - failedCreations.length),
    };
  }, [
    commitments,
    viewer,
    inScope,
    pools.data,
    failedCount,
    failedCommitmentIds,
    hasPendingCreate,
    pendingCreates,
  ]);

  return {
    ...partitioned,
    totalActCount: partitioned.liveActCount + partitioned.settledActCount,
    availability: query.availability,
    // A scoped list waits for the pools, or it would show promises it cannot place yet.
    isLoading: query.isLoading || pools.isLoading,
    isError: query.isError,
    failedJobCount: failedCount,
    failedCommitmentIds,
    queueUnavailable: isUnavailable,
    refetch: query.refetch,
  };
}
