import {
  type CommitmentActInput,
  type CommitmentActKind,
  type CommitmentReadModel,
  type CommitmentSeat,
  selectCommitmentActKind,
} from "@green-goods/shared/commitment-pooling";

export { canJoinTeam } from "@green-goods/shared/commitment-pooling";

/**
 * How the commitment's one act is labelled.
 *
 * Which act exists is a domain question and lives in
 * `@green-goods/shared` — the inbox's "needs you" count asks the same table, so
 * the badge and the bar cannot disagree. What is left here is presentation:
 * the words, whether the act reads as destructive, and promoting an eligible
 * work link above optional proof when required work remains.
 */
export interface CommitmentAct {
  /** `service` is a voucher booking's act; its words come with values, already formatted. */
  kind: CommitmentActKind | "linkWork" | "service";
  labelId: string;
  /** The label already in words, where the act's copy takes values ("Deposit 10 Vouchers"). */
  label?: string;
  /** Destructive acts read as such and confirm before they run. */
  destructive?: boolean;
  /** An act that writes straight to the chain, so it waits for a connection. */
  needsNetwork?: boolean;
  /** A booking whose only act is a step back ("Cancel Booking") draws it outlined. */
  emphasis?: "secondary";
}

const LABELS: Record<CommitmentActKind, { labelId: string; destructive?: boolean }> = {
  takeUp: { labelId: "app.commitment.act.takeUp" },
  askToTakeUp: { labelId: "app.commitment.act.askToTakeUp" },
  withdraw: { labelId: "app.commitment.act.withdraw", destructive: true },
  addProof: { labelId: "app.commitment.act.addProof" },
  sendForConfirmation: { labelId: "app.commitment.act.sendForConfirmation" },
  confirm: { labelId: "app.commitment.act.confirm" },
  offerAgain: { labelId: "app.commitment.act.offerAgain" },
  askAgain: { labelId: "app.commitment.act.askAgain" },
};

export function commitmentActForKind(kind: CommitmentActKind | null): CommitmentAct | null {
  if (!kind) return null;
  return { kind, ...LABELS[kind] };
}

/** How a take-up goes: at once on an open request, or by asking its creator on a reviewed one. */
export function takeUpMode(
  act: CommitmentAct | null,
  queued?: { kind: string; waitingReason: string | null } | null,
  claimMode?: CommitmentReadModel["claimMode"]
): "open" | "reviewed" | null {
  if (act?.kind === "takeUp") return "open";
  if (act?.kind === "askToTakeUp") return "reviewed";
  // The existing queued claim still needs its owner's agreement, rather than another take-up.
  if (!act && queued?.kind === "claim" && queued.waitingReason === "reward-agreement-required")
    return claimMode === "OPEN" ? "open" : claimMode === "APPROVAL_GATED" ? "reviewed" : null;
  return null;
}

/**
 * When the reader can add proof, which is what the page says while none is on the promise
 * (DL-151). Pass the act the page's bar offers, or null if another bar stands in for it. The chain
 * takes no proof before someone takes the promise up, and until then only an offer's creator reads
 * as its provider, so they are the one told it comes later.
 */
export function addProofReach(
  act: CommitmentAct | null,
  seat: CommitmentSeat | null,
  state: CommitmentReadModel["derivedState"]
): "now" | "afterTakeUp" | "no" {
  if (act?.kind === "addProof") return "now";
  return seat === "provider" && state === "OFFERED" ? "afterTakeUp" : "no";
}

export function selectCommitmentAct(input: {
  commitment: Pick<CommitmentReadModel, "derivedState" | "claimMode"> &
    Partial<Pick<CommitmentReadModel, "direction">>;
  seat: CommitmentSeat | null;
  hasPendingJob?: boolean;
  isCreator?: boolean;
  isMember?: boolean;
  /** The chain's clock and cycle ends: take-up is offered only until the promise is past due. */
  clock?: CommitmentActInput["clock"];
}): CommitmentAct | null {
  const kind = selectCommitmentActKind(input);
  return commitmentActForKind(kind);
}
