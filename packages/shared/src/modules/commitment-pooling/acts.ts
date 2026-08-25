/**
 * What a commitment offers its reader, and to whom.
 *
 * One source of truth for seat × phase. It lived in two places — the detail
 * screen's action bar and the inbox's "needs you" count — and they had already
 * drifted: the inbox omitted EVIDENCE_SUBMITTED, so a member with work ready to
 * send saw no marker on the one surface built to tell them.
 *
 * Derived from the axes rather than from state ids: phase decides whether an
 * affordance exists at all, seat decides whose it is. Inferring seat from an id
 * is what produced the defects the seat axis exists to prevent.
 *
 * @module modules/commitment-pooling/acts
 */

import type { CommitmentDerivedState, CommitmentReadModel } from "./types";
import type { CommitmentSeat } from "./selectors";

/** Mirrors CommitmentPoolingCommonLib: a roster the contract will not grow past. */
export const MAX_CONTRIBUTORS_PER_COMMITMENT = 40;
/** Mirrors CommitmentPoolingCommonLib: linked work, counted as required and as attached. */
export const MAX_LINKED_WORKS_PER_COMMITMENT = 40;

export type CommitmentActKind =
  | "takeUp"
  | "askToTakeUp"
  | "withdraw"
  | "addProof"
  | "sendForConfirmation"
  | "confirm"
  | "offerAgain";

/** Nothing is offered to anyone once a commitment has stopped moving. */
const TERMINAL = new Set<CommitmentDerivedState>([
  "FULFILLED",
  "RECONCILED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
]);

/**
 * Whether the record has stopped moving (kept, withdrawn, lapsed, or held
 * under review). Copy that urges the next step must not render on these.
 */
export function isTerminalCommitmentState(state: CommitmentDerivedState): boolean {
  return TERMINAL.has(state);
}

/** Settled: nothing further happens on its own. Narrower than terminal — a
 * disputed record is held, not settled, so it stays in every live list. */
const SETTLED = new Set<CommitmentDerivedState>([
  "FULFILLED",
  "RECONCILED",
  "CANCELLED",
  "EXPIRED",
]);

export function isSettledCommitmentState(state: CommitmentDerivedState): boolean {
  return SETTLED.has(state);
}

const PRE_ACCEPTANCE = new Set<CommitmentDerivedState>(["OFFERED", "REQUESTED"]);

/**
 * Work is happening. ACCEPTED is included for safety rather than need: today
 * `deriveCommitmentState` collapses it into ACTIVE, EVIDENCE_SUBMITTED or
 * PARTIALLY_APPROVED, so it never reaches here — but the band table answers for
 * it, and an act table that disagreed with the band table is exactly the kind of
 * split this module exists to close.
 */
const IN_PROGRESS = new Set<CommitmentDerivedState>(["ACCEPTED", "ACTIVE", "PARTIALLY_APPROVED"]);

// PARTIALLY_APPROVED is a deliberate disagreement with the drawn reference,
// which shows no bar on either of its two rows. The spec gates evidence attach
// to Active / EvidenceSubmitted / PartiallyApproved, and a provider whose work
// is only part approved plainly still has some to do, so a dead screen there
// reads as the drawing being conservative rather than as a rule. Recorded here
// rather than left as silent drift: if the drawing is right, this is the line
// to change.

export interface CommitmentActInput {
  commitment: Pick<CommitmentReadModel, "derivedState" | "claimMode"> &
    Partial<Pick<CommitmentReadModel, "commitmentType">>;
  seat: CommitmentSeat | null;
  /** True while an act for this commitment is still waiting to send. */
  hasPendingJob?: boolean;
}

/**
 * The single act this commitment offers this reader, or null.
 *
 * Null is a real answer, not a gap. A seat with nothing to do gets no bar
 * rather than a disabled one: the provider of a commitment awaiting someone
 * else's confirmation is asking where it has got to, and a greyed-out Confirm
 * answers a question they did not ask.
 */
export function selectCommitmentActKind(input: CommitmentActInput): CommitmentActKind | null {
  const { commitment, seat, hasPendingJob } = input;
  const phase = commitment.derivedState;

  // An unauthenticated reader is not a bystander: the difference decides
  // whether a screen offers acts at all.
  if (!seat) return null;
  // The act has already been taken and is waiting to send. Offering it again is
  // how one commitment becomes two.
  if (hasPendingJob) return null;

  if (phase === "EXPIRED") return seat === "provider" ? "offerAgain" : null;
  if (TERMINAL.has(phase)) return null;

  if (PRE_ACCEPTANCE.has(phase)) {
    // Direction already names the creator, so they read as provider on an Offer
    // and confirmer on a Request. Either way the act is to take it back.
    if (seat === "provider" || seat === "confirmer") return "withdraw";
    return commitment.claimMode === "APPROVAL_GATED" ? "askToTakeUp" : "takeUp";
  }

  if (IN_PROGRESS.has(phase)) {
    // The people doing the work add proof. The confirmer is waiting; a
    // bystander has no relationship to act on yet.
    return seat === "provider" || seat === "contributor" ? "addProof" : null;
  }

  if (phase === "EVIDENCE_SUBMITTED") {
    // Garden work is never sent by hand: the contract refuses it outright
    // (ConfirmLib, WorkApprovalRequired) and moves the commitment itself once
    // the work approvals arrive. Until then the team keeps adding proof.
    if (commitment.commitmentType === "DOMAIN_IMPACT") {
      return seat === "provider" || seat === "contributor" ? "addProof" : null;
    }
    // Sending settles the team and the credit record, so only the lead may do
    // it. Someone on the team never sends, and never confirms.
    return seat === "provider" ? "sendForConfirmation" : null;
  }

  if (phase === "READY_FOR_CONFIRMATION") {
    // The provider cannot confirm their own commitment, which is why this is
    // the confirmer's alone rather than a disabled button on both.
    return seat === "confirmer" ? "confirm" : null;
  }

  return null;
}

/**
 * Whether an eligible reader may join the team.
 *
 * Offered beside the team rather than in the action bar: it is not the screen's
 * act, and it earns no credit on its own. It lives here rather than in the
 * client so it reuses IN_PROGRESS — the same question, asked once. A second
 * copy of that set is how the badge and the bar came to disagree in round 2.
 */
export function canJoinTeam(input: {
  commitment: Pick<
    CommitmentReadModel,
    "derivedState" | "contributorPolicy" | "contributorsFrozen" | "contributorCount"
  >;
  seat: CommitmentSeat | null;
  /**
   * Whether the reader holds a role in the garden providing the work. An open
   * policy opens the team to that garden's people, not to everyone: the
   * contract refuses a contributor from outside it, so a reader who is not a
   * member is offered nothing rather than an act that reverts.
   */
  isGardenMember: boolean;
}): boolean {
  const { commitment, seat, isGardenMember } = input;
  if (seat !== "bystander") return false;
  if (!isGardenMember) return false;
  // A full roster takes nobody (TooManyContributors), however open the policy.
  if (commitment.contributorCount >= MAX_CONTRIBUTORS_PER_COMMITMENT) return false;
  if (commitment.contributorsFrozen) return false;
  if (commitment.contributorPolicy !== "OPEN") return false;
  return IN_PROGRESS.has(commitment.derivedState);
}

/**
 * Whether the reader may link one of their works to this commitment.
 *
 * Garden work only, by the people doing it, while it is still moving, and
 * only up to the contract's ceiling: the forty-first link reverts
 * (TooManyLinkedWorks), and every active attribution counts towards it,
 * not only the approved ones.
 */
export function canLinkWork(input: {
  commitment: Pick<CommitmentReadModel, "derivedState" | "commitmentType" | "contributorsFrozen">;
  seat: CommitmentSeat | null;
  /** Attributions currently linked, whatever their approval state. */
  linkedCount: number;
}): boolean {
  const { commitment, seat, linkedCount } = input;
  if (commitment.commitmentType !== "DOMAIN_IMPACT") return false;
  if (seat !== "provider" && seat !== "contributor") return false;
  if (commitment.contributorsFrozen) return false;
  if (linkedCount >= MAX_LINKED_WORKS_PER_COMMITMENT) return false;
  return (
    IN_PROGRESS.has(commitment.derivedState) || commitment.derivedState === "EVIDENCE_SUBMITTED"
  );
}

/**
 * Acts that are the reader's own option rather than something waiting on them.
 *
 * Withdrawing an untaken offer is always available to whoever made it, and
 * offering a lapsed one again is an invitation, not an obligation. Counting
 * either as "needs you" badges every commitment a member has ever made and
 * sorts it above the ones actually waiting — which is the opposite of what the
 * count is for.
 */
const ELECTIVE = new Set<CommitmentActKind>(["withdraw", "offerAgain", "takeUp", "askToTakeUp"]);

/**
 * Whether this commitment is waiting on this reader specifically.
 *
 * A narrower question than "what can I do here", and deliberately so: the
 * action bar offers everything available, while the badge counts only what
 * somebody else is held up by.
 */
export function commitmentNeedsSeat(input: CommitmentActInput): boolean {
  const kind = selectCommitmentActKind(input);
  return kind !== null && !ELECTIVE.has(kind);
}
