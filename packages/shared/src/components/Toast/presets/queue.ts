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
    workMessageInGarden:
      "Your work in {garden} is still saved on this device. Switch to that garden to try again.",
    approvalMessageInGarden:
      "Your decision in {garden} is still saved on this device. Switch to that garden to try again.",
    seeGardens: "See Your Gardens",
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
  takeUpFailed: {
    title: "Couldn't take up the promise",
    message:
      "Your work is still saved on this device and goes after the promise. Open Your Work to try again.",
  },
  linkFailed: {
    title: "Couldn't link your work",
    message: "Your work was sent. Open the promise to link it again.",
  },
};

/**
 * A failed upload that waits in another of the member's gardens. Your Work lists the active
 * garden only (DL-129), so its toast names that garden and opens Home's switcher instead.
 */
export interface FailedInAnotherGarden {
  gardenName: string;
  /** Opens the switcher; the member picks there, and nothing switches before (decision 6). */
  openSwitcher: () => void;
}

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

    jobFailed: (kind: "work" | "approval", detail?: string, elsewhere?: FailedInAnotherGarden) =>
      toastService.error({
        // Share the id with the owning mutation's loading toast so the inline-process
        // path collapses to a single slot. In the background-flush path no mutation
        // is active, so this toast still renders alone.
        id: kind === "work" ? "work-upload" : "approval-submit",
        title: formatMessage({
          id: toastMessageIds.queue.jobFailed.title,
          defaultMessage: queueDefaults.jobFailed.title,
        }),
        ...(elsewhere
          ? {
              message: formatMessage(
                {
                  id:
                    kind === "work"
                      ? toastMessageIds.queue.jobFailed.workMessageInGarden
                      : toastMessageIds.queue.jobFailed.approvalMessageInGarden,
                  defaultMessage:
                    kind === "work"
                      ? queueDefaults.jobFailed.workMessageInGarden
                      : queueDefaults.jobFailed.approvalMessageInGarden,
                },
                { garden: elsewhere.gardenName }
              ),
              devMessage: detail,
              // As long as the arrival toast's, which also carries an action.
              duration: 6000,
              action: {
                label: formatMessage({
                  id: toastMessageIds.queue.jobFailed.seeGardens,
                  defaultMessage: queueDefaults.jobFailed.seeGardens,
                }),
                onClick: elsewhere.openSwitcher,
                dismissOnClick: true,
              },
            }
          : {
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

    /** The take-up a queued work waits on gave up (decision 18): the work is still here. */
    takeUpFailed: () =>
      toastService.error({
        id: "take-up",
        title: formatMessage({
          id: toastMessageIds.queue.takeUpFailed.title,
          defaultMessage: queueDefaults.takeUpFailed.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.takeUpFailed.message,
          defaultMessage: queueDefaults.takeUpFailed.message,
        }),
        context: "job queue",
      }),

    /** A sent work's link to its promise gave up; the work itself is on the record. */
    linkFailed: () =>
      toastService.error({
        id: "work-link",
        title: formatMessage({
          id: toastMessageIds.queue.linkFailed.title,
          defaultMessage: queueDefaults.linkFailed.title,
        }),
        message: formatMessage({
          id: toastMessageIds.queue.linkFailed.message,
          defaultMessage: queueDefaults.linkFailed.message,
        }),
        context: "job queue",
      }),
  };
}
