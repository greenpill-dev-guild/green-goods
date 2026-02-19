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
    workMessage: "Work upload failed. We'll retry automatically.",
    approvalMessage: "Approval sync failed. We'll retry automatically.",
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

  /** Show error when an individual queued job fails */
  jobFailed: (kind: "work" | "approval", detail?: string) =>
    toastService.error({
      id: `job-failed-${kind}`,
      title: queueDefaults.jobFailed.title,
      message:
        detail ??
        (kind === "work" ? queueDefaults.jobFailed.workMessage : queueDefaults.jobFailed.approvalMessage),
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

    jobFailed: (kind: "work" | "approval", detail?: string) =>
      toastService.error({
        id: `job-failed-${kind}`,
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
