import type {
  CommitmentDerivedState,
  CommitmentReadModel,
} from "@green-goods/shared/commitment-pooling";

/** Where a season's or campaign's promises stand, in the words its promise rows use. */
export interface CyclePromiseStanding {
  /** Offered or asked for, and not taken up yet. */
  open: number;
  /** Taken up and underway: in progress, proof added or partly approved. */
  inProgress: number;
  /** Waiting on a decision: to be confirmed, or under review. */
  waiting: number;
  /** Withdrawn or lapsed without being kept. */
  ended: number;
}

const STANDING: Partial<Record<CommitmentDerivedState, keyof CyclePromiseStanding>> = {
  OFFERED: "open",
  REQUESTED: "open",
  ACCEPTED: "inProgress",
  ACTIVE: "inProgress",
  EVIDENCE_SUBMITTED: "inProgress",
  PARTIALLY_APPROVED: "inProgress",
  READY_FOR_CONFIRMATION: "waiting",
  DISPUTED: "waiting",
  CANCELLED: "ended",
  EXPIRED: "ended",
};

/**
 * Counts a season's or campaign's promises by where they stand (DL-169). Kept promises are left
 * to the cycle's own record, which counts them against the promises made ("3 of 7 kept"), and a
 * promise still being set up is not counted yet.
 */
export function cyclePromiseStanding(
  commitments: readonly Pick<CommitmentReadModel, "derivedState">[]
): CyclePromiseStanding {
  const standing: CyclePromiseStanding = { open: 0, inProgress: 0, waiting: 0, ended: 0 };
  for (const { derivedState } of commitments) {
    const place = STANDING[derivedState];
    if (place) standing[place] += 1;
  }
  return standing;
}
