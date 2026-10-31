import type {
  FailedCommitmentJob,
  PendingCommitmentAct,
} from "@green-goods/shared/commitment-pooling";
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
