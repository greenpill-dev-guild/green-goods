import type { Job } from "../../types/job-queue";
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
  await deps.store.markJobSynced(jobId, completedTxHash);

  if (job.kind === "work" && job.meta?.clientWorkId) {
    try {
      await deps.store.storeClientWorkIdMapping(
        job.meta.clientWorkId as string,
        completedTxHash,
        jobId
      );
    } catch (error) {
      deps.logger.warn("[JobQueue] Failed to store clientWorkId mapping", { error });
    }
  }

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
  return async function processJob(
    jobId: string,
    context: ProcessJobContext
  ): Promise<ProcessJobResult> {
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

    if (job.attempts >= deps.config.maxRetries) {
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
      const execution = await deps.executors.execute(jobId, job, chainId, sender);
      if (execution.status === "waiting") {
        const meta = { ...(job.meta ?? {}), waitingForDependency: true };
        await deps.store.updateJob({
          ...job,
          meta: { ...meta, waitingReason: execution.reason },
          lastAttemptAt: deps.clock.now(),
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
  };
}
