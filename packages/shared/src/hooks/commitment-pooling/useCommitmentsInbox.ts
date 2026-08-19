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
 * @module hooks/commitment-pooling/useCommitmentsInbox
 */

import { useMemo } from "react";

import {
  type CommitmentDerivedState,
  type CommitmentReadModel,
  type CommitmentSeat,
  selectCommitmentSeat,
} from "../../modules/commitment-pooling";
import type { Address } from "../../types/domain";
import { useCommitments } from "./useCommitmentPooling";

/** A commitment has settled when nothing further will happen to it on its own. */
const SETTLED_STATES = new Set<CommitmentDerivedState>([
  "FULFILLED",
  "RECONCILED",
  "CANCELLED",
  "EXPIRED",
]);

/**
 * What each seat is waiting to do, by phase. A seat with nothing to do here is a
 * deliberate answer rather than a missing one, so the absent combinations are as
 * meaningful as the present ones: a provider on a commitment awaiting someone
 * else's confirmation is asking "where has this got to?", not waiting to act.
 */
const ACT_BY_SEAT: Record<CommitmentSeat, ReadonlySet<CommitmentDerivedState>> = {
  provider: new Set<CommitmentDerivedState>(["ACTIVE", "PARTIALLY_APPROVED"]),
  confirmer: new Set<CommitmentDerivedState>(["READY_FOR_CONFIRMATION"]),
  contributor: new Set<CommitmentDerivedState>(["ACTIVE", "PARTIALLY_APPROVED"]),
  bystander: new Set<CommitmentDerivedState>(),
};

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
}: {
  chainId: number;
  viewer?: Address;
}): CommitmentsInbox {
  // Without a viewer there is no "mine" to scope to, and an unscoped read would
  // return every commitment on the chain rather than none. Signed out means no
  // inbox, so the query never runs.
  const query = useCommitments({ chainId, account: viewer }, { enabled: Boolean(viewer) });
  const { commitments } = query;

  const partitioned = useMemo(() => {
    const live: InboxCommitment[] = [];
    const settled: InboxCommitment[] = [];

    for (const commitment of viewer ? commitments : []) {
      const seat = seatOnOwnList(commitment, viewer);
      const isSettled = SETTLED_STATES.has(commitment.derivedState);
      const needsYou =
        !isSettled && seat !== null && ACT_BY_SEAT[seat].has(commitment.derivedState);
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
    return { live, settled, liveActCount, settledActCount };
  }, [commitments, viewer]);

  return {
    ...partitioned,
    totalActCount: partitioned.liveActCount + partitioned.settledActCount,
    availability: query.availability,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
