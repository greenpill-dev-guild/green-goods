import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for queue toasts */
const queueDefaults = {
  workCompleted: { title: "Work uploaded", message: "Submission confirmed." },
  approvalCompleted: { title: "Approval sent", message: "Status updated." },
  syncSuccess: { title: "Offline jobs synced" },
  syncError: {
    title: "Some jobs failed to sync",
    message: "We'll retry automatically in the background.",
  },
  jobFailed: {
    title: "Sync failed",
    workMessage: "Your work is still saved on this device. Open Your Work to try again.",
    approvalMessage: "Your decision is still saved on this device. Open Your Work to try again.",
  },
  retryFailed: {
    title: "Couldn't send it",
    message: "It's still saved on this device. You can try again.",
  },
  stillQueued: {
    title: "Still queued",
    offline: "Reconnect to the internet to finish syncing.",
    signedOut: "Sign in to continue syncing.",
    retrying: "We'll retry shortly.",
  },
  queueClear: { title: "Queue is clear", message: "No pending jobs to sync." },
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

    jobFailed: (kind: "work" | "approval", detail?: string) =>
      toastService.error({
        // Share the id with the owning mutation's loading toast so the inline-process
        // path collapses to a single slot. In the background-flush path no mutation
        // is active, so this toast still renders alone.
        id: kind === "work" ? "work-upload" : "approval-submit",
        title: formatMessage({
          id: toastMessageIds.queue.jobFailed.title,
          defaultMessage: queueDefaults.jobFailed.title,
        }),
        message:
          detail ??
          formatMessage({
            id:
              kind === "work"
                ? toastMessageIds.queue.jobFailed.workMessage
                : toastMessageIds.queue.jobFailed.approvalMessage,
            defaultMessage:
              kind === "work"
                ? queueDefaults.jobFailed.workMessage
                : queueDefaults.jobFailed.approvalMessage,
          }),
        context: "job queue",
      }),

    /** One act the person retried, unlike syncError, which speaks for a batch. */
    retryFailed: (error?: unknown) =>
      toastService.error({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.retryFailed.title,
          defaultMessage: queueDefaults.retryFailed.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.retryFailed.message,
          defaultMessage: queueDefaults.retryFailed.message,
        }),
        context: "job queue",
        error,
      }),

    stillQueued: (reason: "offline" | "signedOut" | "retrying") =>
      toastService.info({
        id: "job-queue-flush",
        title: formatMessage({
          id: toastMessageIds.queue.stillQueued.title,
          defaultMessage: queueDefaults.stillQueued.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.stillQueued[reason],
          defaultMessage: queueDefaults.stillQueued[reason],
        }),
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
