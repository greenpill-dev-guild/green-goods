/**
 * Commitment act permissions
 *
 * What the commitment inspector may offer, decided against the contract rather
 * than against the shape of the record: readiness for an ordinary submission
 * and for the steward override, who may raise or resolve a dispute, and the
 * full act table the panel renders from. Split out of `steward-selectors`,
 * which is at its source-structure cap.
 *
 * @module modules/commitment-pooling/commitment-act-permissions
 */

import type { Address } from "../../types/domain";
import {
  type CommitmentReadinessBlocker,
  isSameAccount,
  selectCommitmentReadiness,
} from "./selectors";
import type { CommitmentCycleRecord, CommitmentPoolRecord, CommitmentReadModel } from "./types";
import type { CommitmentDetail } from "./types-relations";

/**
 * Whether `submitForConfirmation` would clear every gate the chain applies, so
 * a console never queues a job the contract rejects outright: an Accepted
 * record in an Open pool and Open cycle, proof and verified credit present, a
 * required assessment attached, and a confirmer still reachable
 * (ConfirmLib.sol:29-58 through CreditLib.freezeAndReady).
 *
 * Two gates are deliberately not decided here. A pool or cycle the reader has
 * not read yet is unknown rather than shut, so a slow read never hides an act
 * the chain would take. And `linkedWorkFresh` stays true because the contract
 * compares the module's recorded decision sequence against the resolver's live
 * one, and neither side is indexed; that gate remains the chain's alone.
 */
export function selectCommitmentSubmissionReadiness(input: CommitmentReadinessInput): {
  ready: boolean;
  blockers: CommitmentReadinessBlocker[];
} {
  return readinessFor(input, false);
}

/**
 * Whether `markReadyForConfirmation` would clear every gate the chain applies.
 * The steward override waives the proof policy and nothing else: ConfirmLib.sol:62-99
 * never reads the commitment type or the requirement counters, which is exactly why
 * a stalled Work-backed record has a recovery path at all. Everything `freezeAndReady`
 * asserts still binds — verified credit, an Open cycle, fresh linked-work decisions, a
 * reachable confirmer — as does the Open pool the override itself requires.
 */
export function selectCommitmentOverrideReadiness(input: CommitmentReadinessInput): {
  ready: boolean;
  blockers: CommitmentReadinessBlocker[];
} {
  return readinessFor(input, true);
}

interface CommitmentReadinessInput {
  detail?: CommitmentDetail | null;
  pool?: CommitmentPoolRecord | null;
  cycle?: CommitmentCycleRecord | null;
  ordinaryReachable: boolean;
  protocolPoolRegistered: boolean;
}

function readinessFor(
  input: CommitmentReadinessInput,
  override: boolean
): { ready: boolean; blockers: CommitmentReadinessBlocker[] } {
  const commitment = input.detail?.commitment;
  if (!commitment) return { ready: false, blockers: ["wrong-state"] };
  return selectCommitmentReadiness({
    override,
    state: commitment.onchainState,
    commitmentKind:
      commitment.commitmentType === "DOMAIN_IMPACT" ? "DOMAIN_IMPACT" : "SUPPORT_SERVICE",
    poolOpen: input.pool ? input.pool.state === "OPEN" : true,
    cycleId: commitment.cycleId,
    cycleState: input.cycle ? input.cycle.state : "OPEN",
    requirements: input.detail?.requirements ?? [],
    evidenceCount: commitment.evidenceCount,
    requiresAssessment: commitment.requiresAssessment === true,
    assessmentUID: commitment.assessmentUID,
    // The chain counts one credit per approved Work plus at most one evidence
    // participation credit per contributor; the indexer mirrors both per row.
    totalVerifiedCredits: (input.detail?.contributors ?? []).reduce(
      (total, row) => total + row.approvedWorkCredits + row.evidenceCredits,
      0
    ),
    linkedWorkFresh: true,
    ordinaryConfirmationReachable: input.ordinaryReachable,
    protocolFallbackEnabled: commitment.protocolFallbackEnabled === true,
    protocolPoolRegistered: input.protocolPoolRegistered,
  });
}

/**
 * Whether `raiseDispute` would accept this caller.
 *
 * TerminalLib.sol:98-101 names four authorities and no others: the creator,
 * the counterparty, a named confirmer, or a steward of the pool's garden. A
 * seat is the wrong instrument — `selectCommitmentSeat` seats the lead provider
 * of an accepted Request as `provider`, and on a Garden claim that lead is
 * `requestedBy` while the counterparty is the claiming garden
 * (AcceptanceLib.sol:139-145,175), so the lead is none of the four and
 * `normalizeConfirmers` has already dropped them from the named group.
 */
export function selectCommitmentDisputeAuthority(input: {
  viewer?: Address;
  creator: Address | null | undefined;
  counterparty: Address | null | undefined;
  confirmers: readonly Address[];
  isPoolSteward: boolean;
}): boolean {
  if (input.isPoolSteward) return true;
  const { viewer } = input;
  if (!viewer) return false;
  return (
    isSameAccount(input.creator, viewer) ||
    isSameAccount(input.counterparty, viewer) ||
    input.confirmers.some((confirmer) => isSameAccount(confirmer, viewer))
  );
}

/** Every act the commitment inspector offers, each a plain boolean. */
export interface CommitmentActPermissions {
  cancel: boolean;
  markReady: boolean;
  sendForConfirmation: boolean;
  attachAssessment: boolean;
  raiseDispute: boolean;
  resolveDispute: boolean;
  resolveFulfilled: boolean;
  expire: boolean;
  confirmOrdinary: boolean;
  confirmFallback: boolean;
  acceptClaim: boolean;
  declineClaim: boolean;
  syncWorkDecisions: boolean;
}

const NO_ACTS: CommitmentActPermissions = {
  cancel: false,
  markReady: false,
  sendForConfirmation: false,
  attachAssessment: false,
  raiseDispute: false,
  resolveDispute: false,
  resolveFulfilled: false,
  expire: false,
  confirmOrdinary: false,
  confirmFallback: false,
  acceptClaim: false,
  declineClaim: false,
  syncWorkDecisions: false,
};

/**
 * What this reader may do to this record, derived from state, authority and
 * the contract's own gates, so a disabled control never offers a call that
 * would revert.
 *
 * `poolUnread` and `cycleUnread` are the honest answer to a supporting query
 * that failed: the chain requires an Open pool for every claim, readiness and
 * confirmation call (`GuardLib.requirePoolState`) and an Open cycle for both
 * readiness paths (`CreditLib.freezeAndReady`), and a read that errored says
 * nothing about either. Those acts stay shut until the read succeeds; the
 * wind-down acts a pause never blocks — cancel, expire, dispute, resolve —
 * are unaffected.
 */
export function selectCommitmentActPermissions(input: {
  commitment: Pick<
    CommitmentReadModel,
    | "onchainState"
    | "commitmentType"
    | "preDisputeState"
    | "requiresAssessment"
    | "assessmentUID"
    | "contributorsFrozen"
  > | null;
  viewer?: Address;
  requirementCount: number;
  isPoolSteward: boolean;
  /** Rung 2 and 3 of `submitForConfirmation`'s caller list, via the seat. */
  isParty: boolean;
  disputeAuthorized: boolean;
  onRoster: boolean;
  poolPaused: boolean;
  poolUnread: boolean;
  cycleUnread: boolean;
  submissionReady: boolean;
  overrideReady: boolean;
  hasPendingJob: boolean;
  isDue: boolean;
  confirmation: { allowed: boolean; path: string | null };
  /** At least one exact current approved decision is ready and all reads succeeded. */
  canReconcileWork?: boolean;
}): CommitmentActPermissions {
  const { commitment } = input;
  if (!commitment || !input.viewer) return NO_ACTS;
  const state = commitment.onchainState;
  const evidenceOnly =
    input.requirementCount === 0 && commitment.commitmentType !== "DOMAIN_IMPACT";
  const steward = input.isPoolSteward;
  const accepted = state === "ACCEPTED";
  // The three states raiseDispute accepts (TerminalLib.sol:91-96).
  const disputable =
    state === "ACCEPTED" || state === "READY_FOR_CONFIRMATION" || state === "EXPIRED";
  const live = state === "ACCEPTED" || state === "READY_FOR_CONFIRMATION";
  const poolOpen = !input.poolPaused && !input.poolUnread;
  return {
    cancel: steward && accepted, // a pause never winds down (TerminalLib.sol:11-12)
    // Deliberately not gated on the commitment type: the override exists for a
    // Work-backed record whose requirements stalled, and that is the only
    // recovery the spec promises it.
    markReady: steward && accepted && poolOpen && !input.cycleUnread && input.overrideReady,
    sendForConfirmation:
      (steward || input.isParty) &&
      evidenceOnly &&
      input.submissionReady &&
      !input.poolUnread &&
      !input.cycleUnread &&
      !input.hasPendingJob,
    attachAssessment:
      steward &&
      accepted &&
      commitment.requiresAssessment === true &&
      !commitment.assessmentUID &&
      !commitment.contributorsFrozen,
    raiseDispute: input.disputeAuthorized && disputable,
    resolveDispute: steward && state === "DISPUTED",
    // Fulfilled resolution is a confirmation: never by a contributor, never
    // for a record that had already expired.
    resolveFulfilled:
      steward &&
      state === "DISPUTED" &&
      !input.onRoster &&
      commitment.preDisputeState !== "EXPIRED",
    expire: input.isDue && live,
    confirmOrdinary:
      input.confirmation.allowed &&
      input.confirmation.path === "ORDINARY" &&
      poolOpen &&
      !input.hasPendingJob,
    confirmFallback:
      input.confirmation.allowed &&
      (input.confirmation.path === "POOL_FALLBACK" ||
        input.confirmation.path === "PROTOCOL_FALLBACK") &&
      poolOpen,
    acceptClaim: steward && (state === "OFFERED" || state === "REQUESTED") && poolOpen,
    declineClaim: steward && (state === "OFFERED" || state === "REQUESTED") && poolOpen,
    syncWorkDecisions:
      steward && accepted && !commitment.contributorsFrozen && input.canReconcileWork === true,
  };
}
