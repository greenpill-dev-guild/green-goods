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
