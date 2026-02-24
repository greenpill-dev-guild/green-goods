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
  savedOfflineMessage: "We'll sync this automatically when you're back online.",
  errorApproval: { title: "Approval failed" },
  errorDecision: { title: "Decision failed" },
  errorWallet: {
    message: "Transaction failed. Check your wallet and try again.",
    description: "If this keeps happening, reconnect your wallet before resubmitting.",
  },
  errorQueueApproval: { message: "We couldn't send the approval. We'll retry shortly." },
  errorQueueDecision: { message: "We couldn't send the decision. We'll retry shortly." },
  errorQueueDescription: "Keep the app open; the queue will keep trying in the background.",
};

export const approvalToasts = {
  /** Show loading state when submitting approval */
  submitting: (isApproval: boolean) =>
    toastService.loading({
      id: "approval-submit",
      title: isApproval
        ? approvalDefaults.submittingApproval.title
        : approvalDefaults.submittingDecision.title,
      message: isApproval
        ? approvalDefaults.submittingApproval.message
        : approvalDefaults.submittingDecision.message,
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show loading state when waiting for wallet confirmation */
  walletConfirm: () =>
    toastService.loading({
      id: "approval-submit",
      title: approvalDefaults.walletConfirm.title,
      message: approvalDefaults.walletConfirm.message,
      context: "wallet confirmation",
      suppressLogging: true,
    }),

  /** Show success state when approval is submitted */
  success: (isApproval: boolean) =>
    toastService.success({
      id: "approval-submit",
      title: isApproval ? approvalDefaults.success.title : approvalDefaults.decisionSuccess.title,
      message: isApproval
        ? approvalDefaults.success.message
        : approvalDefaults.decisionSuccess.message,
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show success state when approval is saved offline */
  savedOffline: (isApproval: boolean) =>
    toastService.success({
      id: "approval-submit",
      title: isApproval
        ? approvalDefaults.savedOfflineApproval.title
        : approvalDefaults.savedOfflineDecision.title,
      message: approvalDefaults.savedOfflineMessage,
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show error state for approval submission failure */
  error: (isApproval: boolean, isWallet: boolean) =>
    toastService.error({
      id: "approval-submit",
      title: isApproval
        ? approvalDefaults.errorApproval.title
        : approvalDefaults.errorDecision.title,
      message: isWallet
        ? approvalDefaults.errorWallet.message
        : isApproval
          ? approvalDefaults.errorQueueApproval.message
          : approvalDefaults.errorQueueDecision.message,
      context: isWallet ? "wallet confirmation" : "approval submission",
      description: isWallet
        ? approvalDefaults.errorWallet.description
        : approvalDefaults.errorQueueDescription,
    }),

  /** Dismiss the approval toast */
  dismiss: () => toastService.dismiss("approval-submit"),
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

    error: (isApproval: boolean, isWallet: boolean) =>
      toastService.error({
        id: "approval-submit",
        title: isApproval
          ? formatMessage({
              id: toastMessageIds.approval.errorApproval.title,
              defaultMessage: approvalDefaults.errorApproval.title,
            })
          : formatMessage({
              id: toastMessageIds.approval.errorDecision.title,
              defaultMessage: approvalDefaults.errorDecision.title,
            }),
        message: isWallet
          ? formatMessage({
              id: toastMessageIds.approval.errorWallet.message,
              defaultMessage: approvalDefaults.errorWallet.message,
            })
          : isApproval
            ? formatMessage({
                id: toastMessageIds.approval.errorQueue.approvalMessage,
                defaultMessage: approvalDefaults.errorQueueApproval.message,
              })
            : formatMessage({
                id: toastMessageIds.approval.errorQueue.decisionMessage,
                defaultMessage: approvalDefaults.errorQueueDecision.message,
              }),
        context: isWallet ? "wallet confirmation" : "approval submission",
        description: isWallet
          ? formatMessage({
              id: toastMessageIds.approval.errorWallet.description,
              defaultMessage: approvalDefaults.errorWallet.description,
            })
          : formatMessage({
              id: toastMessageIds.approval.errorQueue.description,
              defaultMessage: approvalDefaults.errorQueueDescription,
            }),
      }),

    dismiss: () => toastService.dismiss("approval-submit"),
  };
}
