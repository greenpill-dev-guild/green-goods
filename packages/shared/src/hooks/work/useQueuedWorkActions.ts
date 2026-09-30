import { useState } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { logger } from "../../modules/app/logger";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { scheduleUploadPreparation } from "../../modules/work/upload-preparation";

export interface QueuedWorkActions {
  /**
   * Prepares a work that needed attention again from the start: a photo that
   * would not convert, or a refusal the garden may have lifted since.
   */
  tryAgain(): Promise<void>;
  isTryingAgain: boolean;
  /** Removes a queued work that never reached the chain. Resolves whether it was removed. */
  discard(): Promise<boolean>;
  isDiscarding: boolean;
}

const TOAST = { id: "queued-work-action", context: "queued work" } as const;

/** What the person can do with one queued work from its detail page. */
export function useQueuedWorkActions(workId: string | undefined): QueuedWorkActions {
  const { formatMessage } = useIntl();
  const [isTryingAgain, setIsTryingAgain] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const tryAgain = async () => {
    if (!workId || isTryingAgain) return;
    setIsTryingAgain(true);
    try {
      await jobQueue.retryJob(workId);
      scheduleUploadPreparation();
    } catch (error) {
      logger.error("[useQueuedWorkActions] Could not prepare the work again", { error, workId });
      toastService.error({
        ...TOAST,
        title: formatMessage({ id: "app.uploads.tryAgainFailedTitle" }),
        message: formatMessage({ id: "app.uploads.tryAgainFailedMessage" }),
        error,
      });
    } finally {
      setIsTryingAgain(false);
    }
  };

  const discard = async () => {
    if (!workId || isDiscarding) return false;
    setIsDiscarding(true);
    try {
      // The queue refuses a work that may already be on chain.
      const discarded = await jobQueue.discardJob(workId);
      if (discarded) {
        toastService.success({
          ...TOAST,
          title: formatMessage({ id: "app.uploads.discardedTitle" }),
          message: formatMessage({ id: "app.uploads.discardedMessage" }),
        });
      } else {
        toastService.error({
          ...TOAST,
          title: formatMessage({ id: "app.uploads.discardFailedTitle" }),
          message: formatMessage({ id: "app.uploads.discardRefusedMessage" }),
        });
      }
      return discarded;
    } catch (error) {
      logger.error("[useQueuedWorkActions] Could not discard the work", { error, workId });
      toastService.error({
        ...TOAST,
        title: formatMessage({ id: "app.uploads.discardFailedTitle" }),
        message: formatMessage({ id: "app.uploads.discardFailedMessage" }),
        error,
      });
      return false;
    } finally {
      setIsDiscarding(false);
    }
  };

  return { tryAgain, isTryingAgain, discard, isDiscarding };
}
