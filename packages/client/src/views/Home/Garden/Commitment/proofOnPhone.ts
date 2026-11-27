import type {
  FailedCommitmentJob,
  PendingCommitmentAct,
} from "@green-goods/shared/commitment-pooling";
import { SEND_STAGE_WORDS } from "@green-goods/shared/modules/transactions/send-stage";
import type { IntlShape } from "react-intl";

/**
 * Proof still on this phone and not being sent: the notice above says what it waits for; the
 * progress and the history say it is not on the promise yet.
 */
export function proofOnPhoneLine(
  queue: {
    proofSending: boolean;
    pendingAct: PendingCommitmentAct | null;
    failedJob: FailedCommitmentJob | null;
  },
  formatMessage: IntlShape["formatMessage"]
): { text: string; at: number } | null {
  const proofJob = queue.pendingAct?.kind === "evidence" ? queue.pendingAct : null;
  const failedProof = queue.failedJob?.kind === "evidence" ? queue.failedJob : null;
  if (queue.proofSending) return null;
  if (failedProof)
    return {
      text: formatMessage({ id: "app.commitment.history.local.failed" }),
      at: failedProof.at,
    };
  if (!proofJob) return null;
  // A Safe only proposed it: it waits for the Safe's signers, in the shared words (PRD-1564).
  if (proofJob.waitingReason === "awaiting-confirmation" && proofJob.awaiting)
    return {
      text: formatMessage(SEND_STAGE_WORDS[proofJob.awaiting].label),
      at: proofJob.createdAt,
    };
  return {
    text: formatMessage({
      id:
        proofJob.waitingReason === "send-intent-expired"
          ? "app.commitment.history.local.cancelled"
          : proofJob.waitingReason === "awaiting-confirmation"
            ? "app.commitment.history.local.checking"
            : "app.commitment.history.local.saved",
    }),
    at: proofJob.createdAt,
  };
}
