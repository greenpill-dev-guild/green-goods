/** Minimal formatMessage interface compatible with react-intl */
export type FormatMessageFn = (
  descriptor: { id: string; defaultMessage?: string },
  values?: Record<string, string | number>
) => string;

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
    jobFailed: {
      title: "app.toast.queue.jobFailed.title",
      workMessage: "app.toast.queue.jobFailed.workMessage",
      approvalMessage: "app.toast.queue.jobFailed.approvalMessage",
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

export const toastMessageIdsUpdate = {
  available: {
    title: "app.toast.update.available.title",
    message: "app.toast.update.available.message",
  },
  updating: {
    title: "app.toast.update.updating.title",
    message: "app.toast.update.updating.message",
  },
} as const;
