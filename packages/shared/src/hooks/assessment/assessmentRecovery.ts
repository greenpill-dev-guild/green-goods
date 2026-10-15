import type { IntlShape } from "react-intl";
import type { Address } from "../../types/domain";
import type { TransactionSender } from "../../modules/transactions/types";
import {
  trackAdminAssessmentCreateFailed,
  trackAdminAssessmentCreateSuccess,
} from "../../modules/app/analytics-events";
import {
  type AssessmentSubmission,
  reconcileAssessmentSubmission,
} from "../../modules/assessment/create-assessment-command";
import { useAssessmentSubmissionStore } from "../../stores/useAssessmentSubmissionStore";
interface AssessmentRecoveryScope {
  key: string | null;
  pending: AssessmentSubmission | undefined;
  address: Address | undefined;
  sender: TransactionSender | null;
  chainId: number;
}
export async function reconcileAssessmentRecovery(
  signal: AbortSignal,
  getScope: () => AssessmentRecoveryScope,
  complete: (key: string, uid: string) => void,
  formatMessage: IntlShape["formatMessage"]
) {
  const { key, pending, address: currentAddress, sender: currentSender } = getScope();
  if (
    !key ||
    !pending ||
    !currentSender ||
    currentAddress?.toLowerCase() !== pending.account.toLowerCase() ||
    getScope().chainId !== pending.chainId
  )
    return null;
  const outcome = pending.confirmedUid
    ? { status: "confirmed" as const, uid: pending.confirmedUid }
    : await reconcileAssessmentSubmission(pending, currentSender);
  if (
    signal.aborted ||
    getScope().key !== key ||
    getScope().pending !== pending ||
    getScope().address?.toLowerCase() !== pending.account.toLowerCase() ||
    getScope().chainId !== pending.chainId
  )
    return null;
  if (outcome.status === "unresolved") return null;
  if (outcome.status === "reverted" || outcome.status === "mismatched") {
    trackAdminAssessmentCreateFailed({
      gardenId: pending.gardenId,
      assessmentType: pending.assessmentType ?? "unknown",
      chainId: pending.chainId,
      error: outcome.status === "mismatched" ? "ReceiptMismatch" : "TransactionReverted",
    });
    useAssessmentSubmissionStore.getState().clear(key);
    throw new Error(
      formatMessage({
        id:
          outcome.status === "mismatched"
            ? "app.assessment.receiptMismatch"
            : "app.account.transactionReverted",
      })
    );
  }
  useAssessmentSubmissionStore
    .getState()
    .record({ ...pending, confirmedUid: outcome.uid, successTracked: true });
  if (!pending.successTracked)
    trackAdminAssessmentCreateSuccess({
      gardenId: pending.gardenId,
      assessmentType: pending.assessmentType ?? "unknown",
      chainId: pending.chainId,
      attestationUid: outcome.uid,
    });
  complete(key, outcome.uid);
  return outcome.uid;
}
