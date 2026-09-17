import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import { jobQueueDB } from "../../modules/job-queue/db";
import {
  prepareUploadsNow,
  scheduleUploadPreparation,
  uploadPreparationStore,
} from "../../modules/work/upload-preparation";
import type { UploadOutcome } from "../../modules/work/upload-queued-work";
import {
  isUploadJob,
  queuedUploadStatus,
  type QueuedUploadStatus,
} from "../../modules/work/upload-state";
import type { ApprovalJobPayload, Job } from "../../types/job-queue";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useLiveQuery } from "../utils/useLiveQuery";

export interface WorkUploads {
  /** Items Upload all sends now. */
  readyCount: number;
  /** Items still being prepared, including photos waiting for the decoder. */
  preparingCount: number;
  /** Items that cannot go until the person acts: refused, failed, or a photo that won't convert. */
  attentionCount: number;
  /** Every queued work and decision not sent yet. */
  queuedCount: number;
  /** Background preparation waits for Data Saver, until the person asks to prepare. */
  pausedForDataSaver: boolean;
  isPreparing: boolean;
  isUploading: boolean;
  /** Works whose decision from this device is still waiting to upload. */
  waitingDecisionWorkIds: ReadonlySet<string>;
  statusOf(jobId: string): QueuedUploadStatus | undefined;
  upload(): Promise<UploadOutcome | undefined>;
  prepareNow(): void;
}

function summarize(jobs: Job[], chainId: number) {
  const statuses = new Map<string, QueuedUploadStatus>();
  const waitingDecisionWorkIds = new Set<string>();
  let readyCount = 0;
  let preparingCount = 0;
  let attentionCount = 0;
  for (const job of jobs) {
    if (!isUploadJob(job) || (job.chainId ?? chainId) !== chainId) continue;
    const status = queuedUploadStatus(job);
    statuses.set(job.id, status);
    // A sent item is confirmed by the queue; it no longer waits for an upload.
    if (status.state === "sent") continue;
    if (status.state === "ready") readyCount += 1;
    else if (status.state === "preparing" || status.state === "photo-pending") preparingCount += 1;
    else attentionCount += 1;
    if (job.kind === "approval")
      waitingDecisionWorkIds.add((job.payload as ApprovalJobPayload).workUID.toLowerCase());
  }
  return {
    statuses,
    waitingDecisionWorkIds,
    readyCount,
    preparingCount,
    attentionCount,
    queuedCount: readyCount + preparingCount + attentionCount,
  };
}

/**
 * Queued work and decisions for the work dashboard, and Upload all: one tap
 * that sends every prepared item with one signature. Opening the dashboard
 * also wakes background preparation.
 */
export function useWorkUploads(): WorkUploads {
  const { formatMessage } = useIntl();
  const userAddress = usePrimaryAddress();
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const live = useLiveQuery(userAddress?.toLowerCase() ?? null, () =>
    jobQueueDB.observeJobs({ userAddress: userAddress ?? "", synced: false })
  );
  const preparation = useSyncExternalStore(
    uploadPreparationStore.subscribe,
    uploadPreparationStore.getSnapshot,
    uploadPreparationStore.getSnapshot
  );
  const summary = useMemo(() => summarize(live.data ?? [], chainId), [live.data, chainId]);

  useEffect(() => {
    scheduleUploadPreparation();
  }, []);

  const mutation = useMutation({
    mutationFn: async (): Promise<UploadOutcome | undefined> => {
      if (!userAddress || !sender) {
        toastService.info({
          id: "work-uploads",
          title: formatMessage({ id: "app.uploads.notUploadedTitle" }),
          message: formatMessage({ id: "app.uploads.signInToUpload" }),
          context: "work uploads",
        });
        return undefined;
      }
      const [{ uploadQueuedWork }, { createDefaultUploadQueuedWorkPorts }] = await Promise.all([
        import("../../modules/work/upload-queued-work"),
        import("../../modules/work/upload-queued-work-defaults"),
      ]);
      return uploadQueuedWork(
        { userAddress, chainId, sender },
        await createDefaultUploadQueuedWorkPorts()
      );
    },
    onSuccess: (outcome) => {
      if (!outcome) return;
      const toast = { id: "work-uploads", context: "work uploads" } as const;
      switch (outcome.status) {
        case "uploaded":
          toastService.success({
            ...toast,
            title: formatMessage({ id: "app.uploads.uploadedTitle" }, { count: outcome.sent }),
            message: outcome.flagged
              ? formatMessage({ id: "app.uploads.flaggedMessage" }, { count: outcome.flagged })
              : formatMessage({ id: "app.uploads.uploadedMessage" }),
          });
          return;
        case "connection-unconfirmed":
          toastService.info({
            ...toast,
            title: formatMessage({ id: "app.offline.degraded" }),
            message: formatMessage({ id: "app.uploads.connectionUnconfirmed" }),
          });
          return;
        case "nothing-ready":
          toastService.info({
            ...toast,
            title: formatMessage({ id: "app.uploads.notUploadedTitle" }),
            message: formatMessage({ id: "app.uploads.nothingReady" }),
          });
          return;
        case "reverted":
          toastService.error({
            ...toast,
            title: formatMessage({ id: "app.uploads.revertedTitle" }),
            message: formatMessage({ id: "app.uploads.revertedMessage" }),
          });
          return;
        case "send-unconfirmed":
          toastService.info({
            ...toast,
            title: formatMessage({ id: "app.uploads.sendUnconfirmedTitle" }),
            message: formatMessage({ id: "app.uploads.sendUnconfirmedMessage" }),
          });
          return;
        case "failed":
          logger.warn("[useWorkUploads] Upload all did not send", { error: outcome.error });
          toastService.error({
            ...toast,
            title: formatMessage({ id: "app.uploads.failedTitle" }),
            message: formatMessage({ id: "app.uploads.failedMessage" }),
            error: outcome.error,
          });
          return;
        // Declining the prompt is the person's choice; everything stays ready.
        case "declined":
          return;
      }
    },
    onError: (error) => {
      logger.error("[useWorkUploads] Upload all stopped", { error });
      toastService.error({
        id: "work-uploads",
        title: formatMessage({ id: "app.uploads.failedTitle" }),
        message: formatMessage({ id: "app.uploads.failedMessage" }),
        context: "work uploads",
        error,
      });
    },
  });

  return {
    readyCount: summary.readyCount,
    preparingCount: summary.preparingCount,
    attentionCount: summary.attentionCount,
    queuedCount: summary.queuedCount,
    pausedForDataSaver: preparation.paused === "data-saver",
    isPreparing: preparation.activeJobId !== null,
    isUploading: mutation.isPending,
    waitingDecisionWorkIds: summary.waitingDecisionWorkIds,
    statusOf: (jobId) => summary.statuses.get(jobId),
    upload: () => mutation.mutateAsync(),
    prepareNow: prepareUploadsNow,
  };
}
