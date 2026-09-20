import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { uploadOutcomeToast } from "../../modules/work/upload-outcome-toast";
import {
  prepareUploadsNow,
  scheduleUploadPreparation,
  uploadPreparationStore,
} from "../../modules/work/upload-preparation";
import type { UploadOutcome } from "../../modules/work/upload-queued-work";
import {
  isUploadJob,
  type QueuedUploadStatus,
  queuedUploadStatus,
} from "../../modules/work/upload-state";
import { connectivityStore } from "../../stores/connectivity";
import type { ApprovalJobPayload, Job } from "../../types/job-queue";
import { useConnectivityStatus } from "../app/useOnlineStatus";
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
  /** Items are being prepared now, or will be shortly; not waiting for the connection. */
  isPreparing: boolean;
  isUploading: boolean;
  /** Works whose decision from this device has not finished queue confirmation. */
  waitingDecisionWorkIds: ReadonlySet<string>;
  decisionFor(workUID: string): { jobId: string; status: QueuedUploadStatus } | undefined;
  statusOf(jobId: string): QueuedUploadStatus | undefined;
  upload(): Promise<UploadOutcome | undefined>;
  uploadOne(jobId: string): Promise<UploadOutcome | undefined>;
  retryOne(jobId: string): Promise<void>;
  checkOne(jobId: string): Promise<void>;
  prepareNow(): void;
}

function summarize(jobs: Job[], chainId: number) {
  const statuses = new Map<string, QueuedUploadStatus>();
  const waitingDecisionWorkIds = new Set<string>();
  const decisionsByWorkId = new Map<string, { jobId: string; status: QueuedUploadStatus }>();
  let readyCount = 0;
  let preparingCount = 0;
  let attentionCount = 0;
  for (const job of jobs) {
    if (!isUploadJob(job) || (job.chainId ?? chainId) !== chainId) continue;
    const status = queuedUploadStatus(job);
    statuses.set(job.id, status);
    if (job.kind === "approval") {
      const workId = (job.payload as ApprovalJobPayload).workUID.toLowerCase();
      waitingDecisionWorkIds.add(workId);
      decisionsByWorkId.set(workId, { jobId: job.id, status });
    }
    // A sent item is still visible until the queue confirms it, but cannot be sent twice.
    if (status.state === "sent") continue;
    if (status.state === "ready") readyCount += 1;
    else if (status.state === "preparing" || status.state === "photo-pending") preparingCount += 1;
    else attentionCount += 1;
  }
  return {
    statuses,
    decisionsByWorkId,
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
  const connectivity = useConnectivityStatus();

  useEffect(() => {
    scheduleUploadPreparation();
  }, []);

  const mutation = useMutation({
    mutationFn: async (jobIds?: readonly string[]): Promise<UploadOutcome | undefined> => {
      if (!userAddress || !sender) {
        toastService.info({
          id: "work-uploads",
          title: formatMessage({ id: "app.uploads.notUploadedTitle" }),
          message: formatMessage({ id: "app.uploads.signInToUpload" }),
          context: "work uploads",
        });
        return undefined;
      }
      // Check before loading: the upload modules may not be on this device yet,
      // and an import that fails offline stays failed for the life of the page.
      if (!(await connectivityStore.confirmOnline())) return { status: "connection-unconfirmed" };
      const [{ uploadQueuedWork }, { createDefaultUploadQueuedWorkPorts }] = await Promise.all([
        import("../../modules/work/upload-queued-work"),
        import("../../modules/work/upload-queued-work-defaults"),
      ]);
      return uploadQueuedWork(
        { userAddress, chainId, sender, jobIds },
        await createDefaultUploadQueuedWorkPorts()
      );
    },
    onSuccess: (outcome) => {
      const toast = outcome && uploadOutcomeToast(outcome);
      if (!toast) return;
      if (outcome.status === "failed")
        logger.warn("[useWorkUploads] Upload all did not send", { error: outcome.error });
      toastService[toast.tone]({
        id: "work-uploads",
        context: "work uploads",
        title: formatMessage({ id: toast.title.id }, toast.title.values),
        message: formatMessage({ id: toast.message.id }, toast.message.values),
        ...("error" in toast ? { error: toast.error } : {}),
      });
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
    // Preparation only runs on a working connection, and until it has loaded it reports no
    // pause. Its pause holds between items, so the bar does not flicker as each one starts.
    isPreparing:
      summary.preparingCount > 0 && preparation.paused === null && connectivity.state === "online",
    isUploading: mutation.isPending,
    waitingDecisionWorkIds: summary.waitingDecisionWorkIds,
    decisionFor: (workUID) => summary.decisionsByWorkId.get(workUID.toLowerCase()),
    statusOf: (jobId) => summary.statuses.get(jobId),
    upload: () => mutation.mutateAsync(undefined),
    uploadOne: (jobId) => mutation.mutateAsync([jobId]),
    retryOne: async (jobId) => {
      await jobQueue.retryJob(jobId);
      scheduleUploadPreparation();
    },
    checkOne: async (jobId) => {
      if (!sender || !(await connectivityStore.confirmOnline())) return;
      await jobQueue.processJob(jobId, { transactionSender: sender, explicit: true });
    },
    prepareNow: () => {
      void connectivityStore
        .confirmOnline()
        .then((confirmed) => {
          if (confirmed) {
            prepareUploadsNow();
            return;
          }
          toastService.info({
            id: "work-uploads",
            title: formatMessage({ id: "app.uploads.notUploadedTitle" }),
            message: formatMessage({ id: "app.work.connectionUnconfirmed" }),
            context: "work uploads",
          });
        })
        .catch((error) => {
          logger.error("[useWorkUploads] Preparation could not start", { error });
          toastService.error({
            id: "work-uploads",
            title: formatMessage({ id: "app.uploads.failedTitle" }),
            message: formatMessage({ id: "app.uploads.failedMessage" }),
            context: "work uploads",
            error,
          });
        });
    },
  };
}
