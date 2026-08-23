import {
  type CommitmentActKind,
  type CommitmentReadModel,
  type CommitmentSeat,
  selectCommitmentActKind,
} from "@green-goods/shared";

export { canJoinTeam } from "@green-goods/shared";

/**
 * How the commitment's one act is labelled.
 *
 * Which act exists is a domain question and lives in
 * `@green-goods/shared` — the inbox's "needs you" count asks the same table, so
 * the badge and the bar cannot disagree. What is left here is presentation:
 * the words, and whether the act reads as destructive.
 */
export interface CommitmentAct {
  kind: CommitmentActKind;
  labelId: string;
  /** Destructive acts read as such and confirm before they run. */
  destructive?: boolean;
}

const LABELS: Record<CommitmentActKind, { labelId: string; destructive?: boolean }> = {
  takeUp: { labelId: "app.commitment.act.takeUp" },
  askToTakeUp: { labelId: "app.commitment.act.askToTakeUp" },
  withdraw: { labelId: "app.commitment.act.withdraw", destructive: true },
  addProof: { labelId: "app.commitment.act.addProof" },
  sendForConfirmation: { labelId: "app.commitment.act.sendForConfirmation" },
  confirm: { labelId: "app.commitment.act.confirm" },
  offerAgain: { labelId: "app.commitment.act.offerAgain" },
};

export function commitmentActForKind(kind: CommitmentActKind | null): CommitmentAct | null {
  if (!kind) return null;
  return { kind, ...LABELS[kind] };
}

export function selectCommitmentAct(input: {
  commitment: Pick<CommitmentReadModel, "derivedState" | "claimMode">;
  seat: CommitmentSeat | null;
  hasPendingJob?: boolean;
}): CommitmentAct | null {
  const kind = selectCommitmentActKind(input);
  return commitmentActForKind(kind);
}
