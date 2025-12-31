/**
 * Toast Presets
 *
 * Pre-configured toast configurations for common operations.
 * Reduces duplication and ensures consistent messaging.
 *
 * Supports internationalization via factory functions that accept
 * a formatMessage function from react-intl.
 *
 * @module components/Toast/presets
 */

import { toastService } from "./toast.service";

// ============================================================================
// I18N MESSAGE IDS
// ============================================================================

/**
 * Toast message IDs for internationalization.
 * Use these with react-intl's formatMessage.
 */
export const toastMessageIds = {
  // Wallet progress
  wallet: {
    validating: {
      title: "app.toast.wallet.validating.title",
      message: "app.toast.wallet.validating.message",
    },
    uploading: {
      title: "app.toast.wallet.uploading.title",
      message: "app.toast.wallet.uploading.message",
    },
    confirming: {
      title: "app.toast.wallet.confirming.title",
      message: "app.toast.wallet.confirming.message",
    },
    syncing: {
      title: "app.toast.wallet.syncing.title",
      message: "app.toast.wallet.syncing.message",
    },
    success: {
      title: "app.toast.wallet.success.title",
      message: "app.toast.wallet.success.message",
    },
    error: {
      title: "app.toast.wallet.error.title",
      recoverable: "app.toast.wallet.error.recoverable",
    },
    timeout: {
      title: "app.toast.wallet.timeout.title",
      message: "app.toast.wallet.timeout.message",
    },
  },
  // Work submission
  work: {
    submitting: {
      title: "app.toast.work.submitting.title",
      message: "app.toast.work.submitting.message",
    },
    success: {
      title: "app.toast.work.success.title",
      message: "app.toast.work.success.message",
    },
    savedOffline: {
      title: "app.toast.work.savedOffline.title",
      message: "app.toast.work.savedOffline.message",
    },
    error: {
      title: "app.toast.work.error.title",
    },
  },
  // Approval
  approval: {
    submittingApproval: {
      title: "app.toast.approval.submittingApproval.title",
      message: "app.toast.approval.submittingApproval.message",
    },
    submittingDecision: {
      title: "app.toast.approval.submittingDecision.title",
      message: "app.toast.approval.submittingDecision.message",
    },
    walletConfirm: {
      title: "app.toast.approval.walletConfirm.title",
      message: "app.toast.approval.walletConfirm.message",
    },
    success: {
      title: "app.toast.approval.success.title",
      message: "app.toast.approval.success.message",
    },
    decisionSuccess: {
      title: "app.toast.approval.decisionSuccess.title",
      message: "app.toast.approval.decisionSuccess.message",
    },
    savedOfflineApproval: {
      title: "app.toast.approval.savedOfflineApproval.title",
    },
    savedOfflineDecision: {
      title: "app.toast.approval.savedOfflineDecision.title",
    },
    savedOffline: {
      message: "app.toast.approval.savedOffline.message",
    },
    errorApproval: {
      title: "app.toast.approval.errorApproval.title",
    },
    errorDecision: {
      title: "app.toast.approval.errorDecision.title",
    },
    errorWallet: {
      message: "app.toast.approval.errorWallet.message",
      description: "app.toast.approval.errorWallet.description",
    },
    errorQueue: {
      approvalMessage: "app.toast.approval.errorQueue.approval.message",
      decisionMessage: "app.toast.approval.errorQueue.decision.message",
      description: "app.toast.approval.errorQueue.description",
    },
  },
  // Queue
  queue: {
    workCompleted: {
      title: "app.toast.queue.workCompleted.title",
      message: "app.toast.queue.workCompleted.message",
    },
    approvalCompleted: {
      title: "app.toast.queue.approvalCompleted.title",
      message: "app.toast.queue.approvalCompleted.message",
    },
    syncSuccess: {
      title: "app.toast.queue.syncSuccess.title",
      message: "app.toast.queue.syncSuccess.message",
      messagePlural: "app.toast.queue.syncSuccess.messagePlural",
    },
    syncError: {
      title: "app.toast.queue.syncError.title",
      message: "app.toast.queue.syncError.message",
    },
    stillQueued: {
      title: "app.toast.queue.stillQueued.title",
    },
    queueClear: {
      title: "app.toast.queue.queueClear.title",
      message: "app.toast.queue.queueClear.message",
    },
  },
  // Validation
  validation: {
    formError: {
      title: "app.toast.validation.formError.title",
    },
  },
} as const;

// ============================================================================
// FORMAT MESSAGE TYPE
// ============================================================================

/** Minimal formatMessage interface compatible with react-intl */
export type FormatMessageFn = (
  descriptor: { id: string; defaultMessage?: string },
  values?: Record<string, string | number>
) => string;

// ============================================================================
// WORK SUBMISSION TOASTS
// ============================================================================

/** Default (English) fallback messages for work toasts */
const workDefaults = {
  submitting: { title: "Submitting work", message: "Processing your submission..." },
  success: { title: "Work submitted", message: "Your work is now on-chain" },
  savedOffline: { title: "Saved offline", message: "Work added to upload queue" },
  error: { title: "Work submission failed" },
};

export const workToasts = {
  /** Show loading state when submitting work */
  submitting: () =>
    toastService.loading({
      id: "work-upload",
      title: workDefaults.submitting.title,
      message: workDefaults.submitting.message,
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show success state when work is submitted online */
  success: () =>
    toastService.success({
      id: "work-upload",
      title: workDefaults.success.title,
      message: workDefaults.success.message,
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show info state when work is saved offline */
  savedOffline: () =>
    toastService.info({
      id: "work-upload",
      title: workDefaults.savedOffline.title,
      message: workDefaults.savedOffline.message,
      context: "work upload",
      duration: 2000,
      suppressLogging: true,
    }),

  /** Show error state for work submission failure */
  error: (message: string, description?: string) =>
    toastService.error({
      id: "work-upload",
      title: workDefaults.error.title,
      message,
      context: "work upload",
      description,
    }),

  /** Dismiss the work upload toast */
  dismiss: () => toastService.dismiss("work-upload"),
};

/**
 * Create i18n-aware work toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createWorkToasts(formatMessage: FormatMessageFn) {
  return {
    submitting: () =>
      toastService.loading({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.submitting.title,
          defaultMessage: workDefaults.submitting.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.submitting.message,
          defaultMessage: workDefaults.submitting.message,
        }),
        context: "work upload",
        suppressLogging: true,
      }),

    success: () =>
      toastService.success({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.success.title,
          defaultMessage: workDefaults.success.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.success.message,
          defaultMessage: workDefaults.success.message,
        }),
        context: "work upload",
        suppressLogging: true,
      }),

    savedOffline: () =>
      toastService.info({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.savedOffline.title,
          defaultMessage: workDefaults.savedOffline.title,
        }),
        message: formatMessage({
          id: toastMessageIds.work.savedOffline.message,
          defaultMessage: workDefaults.savedOffline.message,
        }),
        context: "work upload",
        duration: 2000,
        suppressLogging: true,
      }),

    error: (message: string, description?: string) =>
      toastService.error({
        id: "work-upload",
        title: formatMessage({
          id: toastMessageIds.work.error.title,
          defaultMessage: workDefaults.error.title,
        }),
        message,
        context: "work upload",
        description,
      }),

    dismiss: () => toastService.dismiss("work-upload"),
  };
}

// ============================================================================
// WORK APPROVAL TOASTS
// ============================================================================

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

// ============================================================================
// JOB QUEUE TOASTS
// ============================================================================

/** Default (English) fallback messages for queue toasts */
const queueDefaults = {
  workCompleted: { title: "Work uploaded", message: "Submission confirmed." },
  approvalCompleted: { title: "Approval sent", message: "Status updated." },
  syncSuccess: { title: "Offline jobs synced" },
  syncError: {
    title: "Some jobs failed to sync",
    message: "We'll retry automatically in the background.",
  },
  stillQueued: { title: "Still queued" },
  queueClear: { title: "Queue is clear", message: "No pending jobs to sync." },
};

export const queueToasts = {
  /** Show success when job completed */
  jobCompleted: (kind: "work" | "approval") =>
    toastService.success({
      id: `job-processing`,
      title:
        kind === "work" ? queueDefaults.workCompleted.title : queueDefaults.approvalCompleted.title,
      message:
        kind === "work"
          ? queueDefaults.workCompleted.message
          : queueDefaults.approvalCompleted.message,
      context: kind === "work" ? "work upload" : "approval submission",
      suppressLogging: true,
    }),

  /** Show success when queue flush completes */
  syncSuccess: (processed: number) =>
    toastService.success({
      id: "job-queue-flush",
      title: queueDefaults.syncSuccess.title,
      message: `Processed ${processed} item${processed === 1 ? "" : "s"}.`,
      context: "job queue",
      suppressLogging: true,
    }),

  /** Show error when sync fails */
  syncError: () =>
    toastService.error({
      id: "job-queue-flush",
      title: queueDefaults.syncError.title,
      message: queueDefaults.syncError.message,
      context: "job queue",
    }),

  /** Show info when jobs are still queued */
  stillQueued: (reason: string) =>
    toastService.info({
      id: "job-queue-flush",
      title: queueDefaults.stillQueued.title,
      message: reason,
      context: "job queue",
      suppressLogging: true,
    }),

  /** Show info when queue is empty */
  queueClear: () =>
    toastService.info({
      id: "job-queue-flush",
      title: queueDefaults.queueClear.title,
      message: queueDefaults.queueClear.message,
      context: "job queue",
      suppressLogging: true,
    }),
};

/**
 * Create i18n-aware queue toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createQueueToasts(formatMessage: FormatMessageFn) {
  return {
    jobCompleted: (kind: "work" | "approval") =>
      toastService.success({
        id: `job-processing`,
        title:
          kind === "work"
            ? formatMessage({
                id: toastMessageIds.queue.workCompleted.title,
                defaultMessage: queueDefaults.workCompleted.title,
              })
            : formatMessage({
                id: toastMessageIds.queue.approvalCompleted.title,
                defaultMessage: queueDefaults.approvalCompleted.title,
              }),
        message:
          kind === "work"
            ? formatMessage({
                id: toastMessageIds.queue.workCompleted.message,
                defaultMessage: queueDefaults.workCompleted.message,
              })
            : formatMessage({
                id: toastMessageIds.queue.approvalCompleted.message,
                defaultMessage: queueDefaults.approvalCompleted.message,
              }),
        context: kind === "work" ? "work upload" : "approval submission",
        suppressLogging: true,
      }),

    syncSuccess: (processed: number) =>
      toastService.success({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.syncSuccess.title,
          defaultMessage: queueDefaults.syncSuccess.title,
        }),
        message: formatMessage(
          {
            id:
              processed === 1
                ? toastMessageIds.queue.syncSuccess.message
                : toastMessageIds.queue.syncSuccess.messagePlural,
            defaultMessage: `Processed ${processed} item${processed === 1 ? "" : "s"}.`,
          },
          { count: processed }
        ),
        context: "job queue",
        suppressLogging: true,
      }),

    syncError: () =>
      toastService.error({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.syncError.title,
          defaultMessage: queueDefaults.syncError.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.syncError.message,
          defaultMessage: queueDefaults.syncError.message,
        }),
        context: "job queue",
      }),

    stillQueued: (reason: string) =>
      toastService.info({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.stillQueued.title,
          defaultMessage: queueDefaults.stillQueued.title,
        }),
        message: reason,
        context: "job queue",
        suppressLogging: true,
      }),

    queueClear: () =>
      toastService.info({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.queueClear.title,
          defaultMessage: queueDefaults.queueClear.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.queueClear.message,
          defaultMessage: queueDefaults.queueClear.message,
        }),
        context: "job queue",
        suppressLogging: true,
      }),
  };
}

// ============================================================================
// VALIDATION TOASTS
// ============================================================================

/** Default (English) fallback messages for validation toasts */
const validationDefaults = {
  formError: { title: "Check your submission" },
};

export const validationToasts = {
  /** Show error for form validation failure */
  formError: (message: string) =>
    toastService.error({
      title: validationDefaults.formError.title,
      message,
      context: "work form validation",
      suppressLogging: true,
    }),

  /** Show error for approval validation failure */
  approvalError: (title: string, message: string) =>
    toastService.error({
      title,
      message,
      context: "work approval",
    }),
};

/**
 * Create i18n-aware validation toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createValidationToasts(formatMessage: FormatMessageFn) {
  return {
    formError: (message: string) =>
      toastService.error({
        title: formatMessage({
          id: toastMessageIds.validation.formError.title,
          defaultMessage: validationDefaults.formError.title,
        }),
        message,
        context: "work form validation",
        suppressLogging: true,
      }),

    approvalError: (title: string, message: string) =>
      toastService.error({
        title,
        message,
        context: "work approval",
      }),
  };
}

// ============================================================================
// WALLET SUBMISSION PROGRESS TOASTS
// ============================================================================

/** Default (English) fallback messages for wallet progress toasts */
const walletDefaults = {
  validating: { title: "Checking membership", message: "Verifying garden access..." },
  uploading: { title: "Uploading media", message: "Saving images to IPFS..." },
  confirming: { title: "Confirm in wallet", message: "Waiting for your signature..." },
  syncing: { title: "Almost there", message: "Syncing with blockchain..." },
  success: { title: "Work submitted!", message: "Your contribution is now on-chain" },
  error: { title: "Submission failed", recoverable: "You can try again with the same data." },
  timeout: {
    title: "Taking longer than usual",
    message: "Your transaction is still processing. Check your wallet for status.",
  },
};

/**
 * Progressive feedback toasts for wallet-based work submissions.
 * Provides real-time stage updates to reduce perceived wait time.
 */
export const walletProgressToasts = {
  /** Show validating state */
  validating: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.validating.title,
      message: walletDefaults.validating.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show uploading media state */
  uploading: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.uploading.title,
      message: walletDefaults.uploading.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show wallet confirmation state */
  confirming: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.confirming.title,
      message: walletDefaults.confirming.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show syncing state */
  syncing: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.syncing.title,
      message: walletDefaults.syncing.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show success state */
  success: () =>
    toastService.success({
      id: "wallet-submission",
      title: walletDefaults.success.title,
      message: walletDefaults.success.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show error state with recoverable info */
  error: (message: string, recoverable: boolean = false) =>
    toastService.error({
      id: "wallet-submission",
      title: walletDefaults.error.title,
      message,
      context: "wallet submission",
      description: recoverable ? walletDefaults.error.recoverable : undefined,
    }),

  /** Show timeout warning (transaction may still succeed) */
  timeout: () =>
    toastService.info({
      id: "wallet-submission",
      title: walletDefaults.timeout.title,
      message: walletDefaults.timeout.message,
      context: "wallet submission",
    }),

  /** Dismiss the wallet submission toast */
  dismiss: () => toastService.dismiss("wallet-submission"),
};

/**
 * Create i18n-aware wallet progress toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createWalletProgressToasts(formatMessage: FormatMessageFn) {
  return {
    validating: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.validating.title,
          defaultMessage: walletDefaults.validating.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.validating.message,
          defaultMessage: walletDefaults.validating.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    uploading: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.uploading.title,
          defaultMessage: walletDefaults.uploading.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.uploading.message,
          defaultMessage: walletDefaults.uploading.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    confirming: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.confirming.title,
          defaultMessage: walletDefaults.confirming.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.confirming.message,
          defaultMessage: walletDefaults.confirming.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    syncing: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.syncing.title,
          defaultMessage: walletDefaults.syncing.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.syncing.message,
          defaultMessage: walletDefaults.syncing.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    success: () =>
      toastService.success({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.success.title,
          defaultMessage: walletDefaults.success.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.success.message,
          defaultMessage: walletDefaults.success.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    error: (message: string, recoverable: boolean = false) =>
      toastService.error({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.error.title,
          defaultMessage: walletDefaults.error.title,
        }),
        message,
        context: "wallet submission",
        description: recoverable
          ? formatMessage({
              id: toastMessageIds.wallet.error.recoverable,
              defaultMessage: walletDefaults.error.recoverable,
            })
          : undefined,
      }),

    timeout: () =>
      toastService.info({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.timeout.title,
          defaultMessage: walletDefaults.timeout.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.timeout.message,
          defaultMessage: walletDefaults.timeout.message,
        }),
        context: "wallet submission",
      }),

    dismiss: () => toastService.dismiss("wallet-submission"),
  };
}

/**
 * Helper to show progressive wallet submission feedback
 * @param stage - Current submission stage
 */
export function showWalletProgress(
  stage: "validating" | "uploading" | "confirming" | "syncing" | "success"
): void {
  walletProgressToasts[stage]();
}

// ============================================================================
// COMBINED FACTORY
// ============================================================================

/**
 * Create all i18n-aware toast presets at once
 * @param formatMessage - react-intl formatMessage function
 */
export function createLocalizedToasts(formatMessage: FormatMessageFn) {
  return {
    work: createWorkToasts(formatMessage),
    approval: createApprovalToasts(formatMessage),
    queue: createQueueToasts(formatMessage),
    validation: createValidationToasts(formatMessage),
    walletProgress: createWalletProgressToasts(formatMessage),
  };
}
