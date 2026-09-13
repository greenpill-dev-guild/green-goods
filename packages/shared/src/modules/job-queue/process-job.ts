import type { TransactionSender } from "../transactions/types";
import {
  acquireWorkJobs,
  retainedWorkBroadcast,
  WorkTransactionReverted,
} from "../work/work-confirmation";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { JobMaintenance } from "./job-maintenance";
import type {
  JobQueueAnalytics,
  JobQueueClock,
  JobQueueConfig,
  JobQueueConnectivity,
  JobQueueEvents,
  JobExecutorRegistry,
  JobQueueLogger,
  JobQueueStore,
  ProcessJobContext,
  ProcessJobResult,
} from "./ports";
import { createOfflineTxHash, isWaitingReprobeThrottled } from "./queue-policy";

interface ProcessJobDependencies {
  store: JobQueueStore;
  events: JobQueueEvents;
  executors: JobExecutorRegistry;
  analytics: JobQueueAnalytics;
  connectivity: JobQueueConnectivity;
  clock: JobQueueClock;
  config: JobQueueConfig;
  logger: JobQueueLogger;
  maintenance: JobMaintenance;
}

function calculateBackoffDelay(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, 60_000);
}

function isWithinBackoffWindow(job: Job, now: number): boolean {
  if (isWaitingReprobeThrottled(job, now)) return true;
  if (!job.lastAttemptAt || job.attempts === 0) return false;
  return now - job.lastAttemptAt < calculateBackoffDelay(job.attempts);
}

async function completeJob(
  jobId: string,
  job: Job,
  txHash: string | undefined,
  startedAt: number,
  deps: ProcessJobDependencies
): Promise<ProcessJobResult> {
  const completedTxHash =
    txHash ??
    (typeof job.meta?.submittedTxHash === "string"
      ? job.meta.submittedTxHash
      : createOfflineTxHash(jobId));

  const clientWorkId =
    job.kind === "work"
      ? ((job.payload as WorkJobPayload).clientWorkId ?? job.meta?.clientWorkId)
      : undefined;
  if (job.kind === "work" && typeof clientWorkId === "string") {
    await deps.store.storeClientWorkIdMapping(clientWorkId, completedTxHash, jobId);
  }
  await deps.store.markJobSynced(jobId, completedTxHash);

  try {
    await deps.store.deleteJob(jobId);
  } catch (error) {
    deps.logger.warn("[JobQueue] Failed to delete synced job", { jobId, error });
    await deps.maintenance.trackFailedDelete(jobId);
  }

  const completedJob: Job = {
    ...job,
    synced: true,
    meta: { ...(job.meta || {}), txHash: completedTxHash },
  };
  deps.events.emit("job:completed", { jobId, job: completedJob, txHash: completedTxHash });
  deps.analytics.jobProcessed(job.kind, deps.clock.now() - startedAt, job.attempts + 1);
  return { success: true, txHash: completedTxHash };
}

export function createJobProcessor(deps: ProcessJobDependencies) {
  async function processJob(jobId: string, context: ProcessJobContext): Promise<ProcessJobResult> {
    const job = await deps.store.getJob(jobId);
    if (!job) return { success: true, skipped: true };
    if (job.synced) {
      const txHash = typeof job.meta?.txHash === "string" ? job.meta.txHash : undefined;
      return { success: true, txHash, skipped: true };
    }
    if (!deps.connectivity.isOnline()) {
      return { success: false, error: "offline", skipped: true };
    }

    const now = deps.clock.now();
    if (isWithinBackoffWindow(job, now)) {
      const remainingBackoff =
        calculateBackoffDelay(job.attempts) - (now - (job.lastAttemptAt || 0));
      return {
        success: false,
        error: `backoff_${Math.ceil(remainingBackoff / 1000)}s`,
        skipped: true,
      };
    }

    const checkpoint =
      job.kind === "work" ? (job.payload as WorkJobPayload).uploadCheckpoint : undefined;
    if (
      job.kind === "work" &&
      (checkpoint?.transactionReverted || job.meta?.workTransactionReverted)
    )
      return { success: false, error: "work-transaction-reverted", skipped: true };
    if (
      job.attempts >= deps.config.maxRetries &&
      !retainedWorkBroadcast(jobId) &&
      !(
        job.kind === "work" &&
        (checkpoint?.transactionHash || checkpoint?.broadcast || checkpoint?.broadcastPending) &&
        !job.meta?.workTransactionReverted
      )
    ) {
      const errorMessage = `Max retries (${deps.config.maxRetries}) exceeded`;
      await deps.store.markJobFailed(jobId, errorMessage);
      deps.events.emit("job:failed", { jobId, job, error: errorMessage });
      deps.analytics.jobPermanentlyFailed(job);
      return { success: false, error: errorMessage };
    }

    const sender = context.transactionSender;
    if (!sender) {
      return { success: false, error: "transaction_sender_unavailable", skipped: true };
    }

    deps.events.emit("job:processing", { jobId, job });
    deps.analytics.processingStarted(job.kind, job.attempts + 1);
    const chainId = job.chainId || deps.config.defaultChainId;
    const startedAt = deps.clock.now();

    try {
      await context.assertOwnership?.();
      await sender.assertOwnership?.(job.userAddress, chainId);
      const guardedSender = Object.create(sender) as TransactionSender;
      guardedSender.assertOwnership = async (address, chainId) => {
        await context.assertOwnership?.();
        await sender.assertOwnership?.(address, chainId);
      };
      guardedSender.sendContractCall = (call, options = {}) =>
        sender.sendContractCall(call, {
          ...options,
          assertOwnership: async () => {
            await context.assertOwnership?.();
            await sender.assertOwnership?.(job.userAddress, chainId);
            await options.assertOwnership?.();
          },
        });
      const execution = await deps.executors.execute(jobId, job, chainId, guardedSender);
      if (execution.status === "waiting") {
        const meta = { ...(job.meta ?? {}), waitingForDependency: true };
        await deps.store.updateJob({
          ...job,
          meta: { ...meta, waitingReason: execution.reason },
          lastAttemptAt: deps.clock.now(),
        });
        deps.events.emit("job:added", {
          jobId,
          job: { ...job, meta: { ...meta, waitingReason: execution.reason } },
        });
        return { success: false, error: execution.reason, skipped: true };
      }
      if (execution.status === "identity-conflict" || execution.status === "unavailable") {
        const prefix = execution.status === "unavailable" ? "unavailable" : "identity_conflict";
        const errorMessage = `${prefix}:${execution.reason}`;
        await deps.store.markJobTerminalFailed(jobId, errorMessage);
        deps.events.emit("job:failed", { jobId, job, error: errorMessage });
        deps.analytics.jobPermanentlyFailed({
          ...job,
          lastError: errorMessage,
          attempts: deps.config.maxRetries,
        });
        return { success: false, error: errorMessage };
      }
      if (execution.status === "submitted") {
        await deps.store.updateJob({
          ...job,
          meta: {
            ...(job.meta ?? {}),
            waitingForDependency: false,
            submittedTxHash: execution.txHash,
          },
          lastAttemptAt: deps.clock.now(),
        });
        return {
          success: false,
          error: "pending_materialization",
          txHash: execution.txHash,
          skipped: true,
        };
      }
      return completeJob(jobId, job, execution.txHash, startedAt, deps);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const processingDuration = deps.clock.now() - startedAt;
      if (errorMessage === "submission-ownership-changed")
        return { success: false, error: errorMessage, skipped: true };
      if (error instanceof WorkTransactionReverted) {
        await deps.store.markJobTerminalFailed(jobId, errorMessage);
        deps.events.emit("job:failed", { jobId, job, error: errorMessage });
        return { success: false, error: errorMessage };
      }
      if (
        job.kind === "work" &&
        (retainedWorkBroadcast(jobId) ||
          (job.payload as WorkJobPayload).uploadCheckpoint?.transactionHash ||
          (job.payload as WorkJobPayload).uploadCheckpoint?.broadcast ||
          (job.payload as WorkJobPayload).uploadCheckpoint?.broadcastPending)
      ) {
        // Failed checkpoint writes cannot turn a confirmation check into a new submission.
        deps.logger.warn("[JobQueue] Work confirmation checkpoint needs persistence", {
          jobId,
          error,
        });
        deps.events.emit("job:added", {
          jobId,
          job: {
            ...job,
            meta: {
              ...job.meta,
              waitingForDependency: true,
              waitingReason: "awaiting-confirmation",
            },
          },
        });
        return { success: false, error: "awaiting-confirmation", skipped: true };
      }
      await deps.store.markJobFailed(jobId, errorMessage);
      const updated = (await deps.store.getJob(jobId)) ?? job;
      deps.events.emit("job:failed", { jobId, job: updated, error: errorMessage });
      await deps.analytics.jobProcessingError(
        job,
        processingDuration,
        chainId,
        deps.config.maxRetries
      );
      return { success: false, error: errorMessage };
    }
  }
  return async (jobId: string, context: ProcessJobContext): Promise<ProcessJobResult> => {
    const claim = await acquireWorkJobs([jobId]);
    if (!claim) return { success: false, skipped: true, error: "already-processing" };
    try {
      return await processJob(jobId, {
        ...context,
        assertOwnership: async () => {
          await claim.assertOwned();
          await context.assertOwnership?.();
        },
      });
    } finally {
      await claim.release();
    }
  };
}
