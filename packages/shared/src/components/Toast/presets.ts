/**
 * Toast Presets
 *
 * Pre-configured toast configurations for common operations.
 * Reduces duplication and ensures consistent messaging.
 *
 * @module components/Toast/presets
 */

import { toastService } from "./toast.service";

// ============================================================================
// WORK SUBMISSION TOASTS
// ============================================================================

export const workToasts = {
  /** Show loading state when submitting work */
  submitting: () =>
    toastService.loading({
      id: "work-upload",
      title: "Submitting work",
      message: "Processing your submission...",
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show success state when work is submitted online */
  success: () =>
    toastService.success({
      id: "work-upload",
      title: "Work submitted",
      message: "Your work is now on-chain",
      context: "work upload",
      suppressLogging: true,
    }),

  /** Show info state when work is saved offline */
  savedOffline: () =>
    toastService.info({
      id: "work-upload",
      title: "Saved offline",
      message: "Work added to upload queue",
      context: "work upload",
      duration: 2000,
      suppressLogging: true,
    }),

  /** Show error state for work submission failure */
  error: (message: string, description?: string) =>
    toastService.error({
      id: "work-upload",
      title: "Work submission failed",
      message,
      context: "work upload",
      description,
    }),

  /** Dismiss the work upload toast */
  dismiss: () => toastService.dismiss("work-upload"),
};

// ============================================================================
// WORK APPROVAL TOASTS
// ============================================================================

export const approvalToasts = {
  /** Show loading state when submitting approval */
  submitting: (isApproval: boolean) =>
    toastService.loading({
      id: "approval-submit",
      title: isApproval ? "Submitting approval" : "Submitting decision",
      message: isApproval ? "Approving work..." : "Recording decision...",
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show loading state when waiting for wallet confirmation */
  walletConfirm: () =>
    toastService.loading({
      id: "approval-submit",
      title: "Confirm in your wallet",
      message: "Waiting for wallet confirmation...",
      context: "wallet confirmation",
      suppressLogging: true,
    }),

  /** Show success state when approval is submitted */
  success: (isApproval: boolean) =>
    toastService.success({
      id: "approval-submit",
      title: isApproval ? "Approval submitted" : "Decision submitted",
      message: isApproval ? "Decision recorded." : "Feedback recorded.",
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show success state when approval is saved offline */
  savedOffline: (isApproval: boolean) =>
    toastService.success({
      id: "approval-submit",
      title: isApproval ? "Approval saved offline" : "Decision saved offline",
      message: "We'll sync this automatically when you're back online.",
      context: "approval submission",
      suppressLogging: true,
    }),

  /** Show error state for approval submission failure */
  error: (isApproval: boolean, isWallet: boolean) =>
    toastService.error({
      id: "approval-submit",
      title: isApproval ? "Approval failed" : "Decision failed",
      message: isWallet
        ? "Transaction failed. Check your wallet and try again."
        : `We couldn't send the ${isApproval ? "approval" : "decision"}. We'll retry shortly.`,
      context: isWallet ? "wallet confirmation" : "approval submission",
      description: isWallet
        ? "If this keeps happening, reconnect your wallet before resubmitting."
        : "Keep the app open; the queue will keep trying in the background.",
    }),

  /** Dismiss the approval toast */
  dismiss: () => toastService.dismiss("approval-submit"),
};

// ============================================================================
// JOB QUEUE TOASTS
// ============================================================================

export const queueToasts = {
  /** Show success when job completed */
  jobCompleted: (kind: "work" | "approval") =>
    toastService.success({
      id: `job-processing`,
      title: kind === "work" ? "Work uploaded" : "Approval sent",
      message: kind === "work" ? "Submission confirmed." : "Status updated.",
      context: kind === "work" ? "work upload" : "approval submission",
      suppressLogging: true,
    }),

  /** Show success when queue flush completes */
  syncSuccess: (processed: number) =>
    toastService.success({
      id: "job-queue-flush",
      title: "Offline jobs synced",
      message: `Processed ${processed} item${processed === 1 ? "" : "s"}.`,
      context: "job queue",
      suppressLogging: true,
    }),

  /** Show error when sync fails */
  syncError: () =>
    toastService.error({
      id: "job-queue-flush",
      title: "Some jobs failed to sync",
      message: "We'll retry automatically in the background.",
      context: "job queue",
    }),

  /** Show info when jobs are still queued */
  stillQueued: (reason: string) =>
    toastService.info({
      id: "job-queue-flush",
      title: "Still queued",
      message: reason,
      context: "job queue",
      suppressLogging: true,
    }),

  /** Show info when queue is empty */
  queueClear: () =>
    toastService.info({
      id: "job-queue-flush",
      title: "Queue is clear",
      message: "No pending jobs to sync.",
      context: "job queue",
      suppressLogging: true,
    }),
};

// ============================================================================
// VALIDATION TOASTS
// ============================================================================

export const validationToasts = {
  /** Show error for form validation failure */
  formError: (message: string) =>
    toastService.error({
      title: "Check your submission",
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
