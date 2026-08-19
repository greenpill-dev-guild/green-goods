import type {
  CommitmentDerivedState,
  CommitmentReadModel,
  CommitmentSeat,
} from "@green-goods/shared";

/**
 * Which single act this screen offers, and to whom.
 *
 * Derived from the three axes the commitment view is decided by, never from a
 * state id: phase decides whether an affordance exists at all, seat decides
 * whose it is. Inferring seat from an id is what produced the audit's defects,
 * including a provider being asked to confirm work they are forbidden from
 * confirming.
 *
 * A seat with nothing to do here gets NO bar rather than a disabled one. The
 * provider of a commitment awaiting someone else's confirmation is asking
 * "where has this got to?", and a greyed-out Confirm answers a question they
 * did not ask.
 */
export type CommitmentActKind =
  | "takeUp"
  | "askToTakeUp"
  | "withdraw"
  | "addProof"
  | "sendForConfirmation"
  | "confirm"
  | "offerAgain";

export interface CommitmentAct {
  kind: CommitmentActKind;
  labelId: string;
  /** Destructive acts read as such and confirm before they run. */
  destructive?: boolean;
}

/** Nothing is offered to anyone once a commitment has stopped moving. */
const TERMINAL = new Set<CommitmentDerivedState>([
  "FULFILLED",
  "RECONCILED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
]);

const PRE_ACCEPTANCE = new Set<CommitmentDerivedState>(["OFFERED", "REQUESTED"]);
const IN_PROGRESS = new Set<CommitmentDerivedState>(["ACTIVE", "PARTIALLY_APPROVED"]);

export function selectCommitmentAct(input: {
  commitment: Pick<CommitmentReadModel, "derivedState" | "claimMode" | "contributorsFrozen">;
  seat: CommitmentSeat | null;
  /** True while an act for this commitment is still waiting to send. */
  hasPendingJob?: boolean;
}): CommitmentAct | null {
  const { commitment, seat, hasPendingJob } = input;
  const phase = commitment.derivedState;

  // An unauthenticated reader is not a bystander: they are offered nothing,
  // because the difference decides whether a screen offers acts at all.
  if (!seat) return null;

  // While something is queued the act has already been taken. Offering it again
  // is how one commitment becomes two.
  if (hasPendingJob) return null;

  if (phase === "EXPIRED") {
    return seat === "provider"
      ? { kind: "offerAgain", labelId: "app.commitment.act.offerAgain" }
      : null;
  }

  if (TERMINAL.has(phase)) return null;

  if (PRE_ACCEPTANCE.has(phase)) {
    // Direction already names the creator, so the person who made this reads as
    // provider on an Offer and confirmer on a Request. Either way the act is
    // the same one: take it back before anyone is relying on it.
    if (seat === "provider" || seat === "confirmer") {
      return { kind: "withdraw", labelId: "app.commitment.act.withdraw", destructive: true };
    }
    return commitment.claimMode === "APPROVAL_GATED"
      ? { kind: "askToTakeUp", labelId: "app.commitment.act.askToTakeUp" }
      : { kind: "takeUp", labelId: "app.commitment.act.takeUp" };
  }

  if (IN_PROGRESS.has(phase)) {
    // The people doing the work add proof. The confirmer is waiting, and a
    // bystander has no relationship to act on yet.
    return seat === "provider" || seat === "contributor"
      ? { kind: "addProof", labelId: "app.commitment.act.addProof" }
      : null;
  }

  if (phase === "EVIDENCE_SUBMITTED") {
    // Sending freezes the team and the credit record, so only the lead may do
    // it. A contributor never sends, and never confirms.
    return seat === "provider"
      ? { kind: "sendForConfirmation", labelId: "app.commitment.act.sendForConfirmation" }
      : null;
  }

  if (phase === "READY_FOR_CONFIRMATION") {
    // The provider cannot confirm their own commitment, which is why this is
    // the confirmer's rung alone rather than a disabled button on both.
    return seat === "confirmer" ? { kind: "confirm", labelId: "app.commitment.act.confirm" } : null;
  }

  return null;
}

/**
 * Whether an eligible reader may join the team.
 *
 * Joining is offered beside the team, not in the action bar: it is not the
 * screen's act, and it earns no credit on its own.
 */
export function canJoinTeam(input: {
  commitment: Pick<
    CommitmentReadModel,
    "derivedState" | "contributorPolicy" | "contributorsFrozen"
  >;
  seat: CommitmentSeat | null;
}): boolean {
  const { commitment, seat } = input;
  if (seat !== "bystander") return false;
  if (commitment.contributorsFrozen) return false;
  if (commitment.contributorPolicy !== "OPEN") return false;
  return IN_PROGRESS.has(commitment.derivedState) || commitment.derivedState === "ACCEPTED";
}
