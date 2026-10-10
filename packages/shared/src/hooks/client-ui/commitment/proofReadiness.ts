import { selectCommitmentSubmissionReadiness } from "../../../modules/commitment-pooling/commitment-act-permissions";
import type { CommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import { selectOrdinaryConfirmationReachable } from "../../../modules/commitment-pooling/steward-selectors";
import type {
  CommitmentCycleRecord,
  CommitmentDetail,
  CommitmentPoolRecord,
} from "../../../modules/commitment-pooling/types";

const PROOF_BEATS = ["media", "details", "review"] as const;

export type ProofBeat = (typeof PROOF_BEATS)[number];
export type ProofBlockedReason =
  | "processing"
  | "recording"
  | "nothing"
  | "credit"
  | "invalid-link"
  | null;

export interface ProofReadinessInput {
  beat: ProofBeat;
  isProcessing: boolean;
  isRecording: boolean;
  hasAnything: boolean;
  creditedCount: number;
  links: readonly string[];
}

export interface ProofReadiness {
  canAdvance: boolean;
  reason: ProofBlockedReason;
}

const WEB_LINK = /^https?:\/\/\S+$/i;

/** Pure beat gate shared by the proof controller and its table-driven tests. */
export function selectProofReadiness(input: ProofReadinessInput): ProofReadiness {
  let reason: ProofBlockedReason = null;

  if (input.beat === "media") {
    if (input.isProcessing) reason = "processing";
    else if (input.isRecording) reason = "recording";
  } else if (input.beat === "details") {
    if (!input.hasAnything) reason = "nothing";
    else if (input.creditedCount === 0) reason = "credit";
    else if (input.links.some((url) => !WEB_LINK.test(url))) reason = "invalid-link";
  }

  return { canAdvance: reason === null, reason };
}

/**
 * The only readiness blockers a proof clears by landing: the first evidence, and
 * credit for the people it names. Anything else means the chain would refuse
 * the send, so Review doesn't offer it.
 */
const CLEARED_BY_PROOF = new Set<string>(["evidence-required", "verified-credit-required"]);

/**
 * D19: whether Review offers "Send for confirmation too". Only the lead sends,
 * garden work is never sent by hand, and it is offered only when the chain
 * would take the send once this proof lands. A pool or cycle still unread says
 * nothing about whether it is open, so it offers nothing either.
 */
export function selectSendTooOffered(input: {
  detail: CommitmentDetail | null | undefined;
  seat: CommitmentSeat | null;
  pool: CommitmentPoolRecord | null | undefined;
  /** Null when the promise has no cycle; undefined while its cycle is unread. */
  cycle: CommitmentCycleRecord | null | undefined;
  creditedCount: number;
  protocolPoolRegistered: boolean;
}): boolean {
  const { detail } = input;
  if (!detail || input.seat !== "provider") return false;
  const record = detail.commitment;
  if (record.commitmentType === "DOMAIN_IMPACT" || detail.requirements.length > 0) return false;
  if (!input.pool || input.cycle === undefined || input.creditedCount === 0) return false;
  const { blockers } = selectCommitmentSubmissionReadiness({
    detail,
    pool: input.pool,
    cycle: input.cycle,
    ordinaryReachable: selectOrdinaryConfirmationReachable({
      confirmers: record.confirmers,
      confirmationThreshold: record.confirmationThreshold ?? 0,
      direction: record.direction,
      counterpartyKind: record.counterpartyKind,
      creator: record.creator,
      counterparty: record.counterparty,
      activeContributors: detail.contributors
        .filter((entry) => entry.active)
        .map((entry) => entry.contributor),
    }),
    protocolPoolRegistered: input.protocolPoolRegistered,
  });
  return blockers.every((blocker) => CLEARED_BY_PROOF.has(blocker));
}
