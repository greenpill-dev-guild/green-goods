import { useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { logger } from "../../modules/app/logger";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { deleteDraftOfQueuedWork } from "../../modules/work/draft-lifecycle";
import { scheduleUploadPreparation } from "../../modules/work/upload-preparation";
import { jobQueueDB } from "../../modules/job-queue/db";
import { hasRecordedSend } from "../../modules/job-queue/queue-policy";
import { acquireAvailableWorkJobs, saveUnderClaim } from "../../modules/job-queue/work-claims";
import {
  assertWorkUploadConsent,
  UploadPolicyCancelledError,
  UploadPolicyRequiredError,
} from "../../modules/work/upload-policy";
import type { Address } from "../../types/domain";
import type { WorkJobPayload } from "../../types/job-queue";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useUploadPolicy, type UploadPolicyPrompt } from "./useUploadPolicy";

export interface QueuedWorkActions {
  uploadPolicy: UploadPolicyPrompt | null;
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
  const { formatMessage, locale } = useIntl();
  const owner = usePrimaryAddress() as Address | null;
  const currentWork = useRef({ owner, workId });
  useLayoutEffect(() => {
    currentWork.current = { owner, workId };
  }, [owner, workId]);
  const policy = useUploadPolicy(owner, locale);
  const [isTryingAgain, setIsTryingAgain] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const tryAgain = async () => {
    if (!workId || isTryingAgain) return;
    setIsTryingAgain(true);
    try {
      const job = await jobQueueDB.getJob(workId);
      if (!owner || job?.kind !== "work" || job.userAddress.toLowerCase() !== owner.toLowerCase())
        throw new UploadPolicyCancelledError();
      if (!hasRecordedSend(job)) {
        try {
          assertWorkUploadConsent((job.payload as WorkJobPayload).uploadConsent, owner);
        } catch (error) {
          if (!(error instanceof UploadPolicyRequiredError)) throw error;
          // Do not hold a queue claim while someone reads the rules.
          const receipt = await policy.request();
          if (currentWork.current.owner !== owner || currentWork.current.workId !== workId)
            throw new UploadPolicyCancelledError();
          const claims = await acquireAvailableWorkJobs([workId]);
          const claim = claims.get(workId);
          if (!claim) throw new Error("submission-ownership-changed");
          try {
            await saveUnderClaim(claim, workId, (stored) => {
              if (
                currentWork.current.owner !== owner ||
                currentWork.current.workId !== workId ||
                stored.kind !== "work" ||
                stored.userAddress.toLowerCase() !== owner.toLowerCase()
              )
                throw new UploadPolicyCancelledError();
              if (hasRecordedSend(stored)) return;
              assertWorkUploadConsent(receipt, owner);
              (stored.payload as WorkJobPayload).uploadConsent = receipt;
              const { preparation: _preparation, ...meta } = stored.meta ?? {};
              if (meta.waitingReason === "upload-policy-required") {
                delete meta.waitingReason;
                meta.waitingForDependency = false;
              }
              stored.meta = meta;
            });
          } finally {
            await claim.release();
          }
        }
      }
      if (currentWork.current.owner !== owner || currentWork.current.workId !== workId)
        throw new UploadPolicyCancelledError();
      await jobQueue.retryJob(workId);
      scheduleUploadPreparation();
    } catch (error) {
      if (error instanceof UploadPolicyCancelledError) return;
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
      // The queue refuses a work that may already be on chain. The draft the work left in the
      // composer goes in the same discard, before the work, so it never comes back alone.
      const discarded = await jobQueue.discardJob(workId, async (job) => {
        await deleteDraftOfQueuedWork(job, "discard");
      });
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

  return { tryAgain, isTryingAgain, discard, isDiscarding, uploadPolicy: policy.prompt };
}
