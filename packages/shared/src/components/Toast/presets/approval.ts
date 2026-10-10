import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for approval toasts */
const approvalDefaults = {
  submittingApproval: { title: "Submitting approval", message: "Approving work..." },
  submittingDecision: { title: "Submitting decision", message: "Recording decision..." },
  walletConfirm: { title: "Confirm in your wallet", message: "Waiting for wallet confirmation..." },
  success: { title: "Approval submitted", message: "Decision recorded." },
  decisionSuccess: { title: "Decision submitted", message: "Feedback recorded." },
  savedOfflineApproval: { title: "Approval saved offline" },
  savedOfflineDecision: { title: "Decision saved offline" },
  savedOfflineMessage: "Upload it from Your Work when you're connected.",
};

/**
 * Create i18n-aware approval toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createApprovalToasts(formatMessage: FormatMessageFn) {
  return {
    submitting: (isApproval: boolean) =>
      toastService.loading({
        id: "approval-submit",
        title: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.submittingApproval.title,
              defaultMessage: approvalDefaults.submittingApproval.title,
            })
          : formatMessage({
              id: toastMessageIds.approval.submittingDecision.title,
              defaultMessage: approvalDefaults.submittingDecision.title,
            }),
        message: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.submittingApproval.message,
              defaultMessage: approvalDefaults.submittingApproval.message,
            })
          : formatMessage({
              id: toastMessageIds.approval.submittingDecision.message,
              defaultMessage: approvalDefaults.submittingDecision.message,
            }),
        context: "approval submission",
        suppressLogging: true,
      }),

    walletConfirm: () =>
      toastService.loading({
        id: "approval-submit",
        title: formatMessage({
          id: toastMessageIds.approval.walletConfirm.title,
          defaultMessage: approvalDefaults.walletConfirm.title,
        }),
        message: formatMessage({
          id: toastMessageIds.approval.walletConfirm.message,
          defaultMessage: approvalDefaults.walletConfirm.message,
        }),
        context: "wallet confirmation",
        // Human-wait stage: signing can exceed any fixed timeout, so don't
        // auto-dismiss. The flow replaces this on sign/reject/error.
        persistent: true,
        suppressLogging: true,
      }),

    success: (isApproval: boolean) =>
      toastService.success({
        id: "approval-submit",
        title: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.success.title,
              defaultMessage: approvalDefaults.success.title,
            })
          : formatMessage({
              id: toastMessageIds.approval.decisionSuccess.title,
              defaultMessage: approvalDefaults.decisionSuccess.title,
            }),
        message: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.success.message,
              defaultMessage: approvalDefaults.success.message,
            })
          : formatMessage({
              id: toastMessageIds.approval.decisionSuccess.message,
              defaultMessage: approvalDefaults.decisionSuccess.message,
            }),
        context: "approval submission",
        suppressLogging: true,
      }),

    savedOffline: (isApproval: boolean) =>
      toastService.success({
        id: "approval-submit",
        title: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.savedOfflineApproval.title,
              defaultMessage: approvalDefaults.savedOfflineApproval.title,
            })
          : formatMessage({
              id: toastMessageIds.approval.savedOfflineDecision.title,
              defaultMessage: approvalDefaults.savedOfflineDecision.title,
            }),
        message: formatMessage({
          id: toastMessageIds.approval.savedOffline.message,
          defaultMessage: approvalDefaults.savedOfflineMessage,
        }),
        context: "approval submission",
        suppressLogging: true,
      }),

    dismiss: () => toastService.dismiss("approval-submit"),
  };
}
