import { DEFAULT_CHAIN_ID } from "../../config";
import { getOntologyChainMaturity } from "../../ontology/query";
import type {
  ApprovalJobPayload,
  Job,
  JobKindMap,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../../types/job-queue";
import { scheduleTask, yieldToMain } from "../../utils/scheduler";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { addBreadcrumb } from "../app/error-tracking";
import { logger } from "../app/logger";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import {
  trackJobCreated,
  trackJobPermanentlyFailed,
  trackJobProcessed,
  trackJobProcessingError,
  trackStorageWarning,
} from "./job-analytics";
import { executeApprovalJob, executeCommitmentQueueJob, executeWorkJob } from "./job-executors";
import {
  COMMITMENT_JOB_KINDS,
  prepareCommitmentJobPayload,
  type CommitmentJobKind,
  type CommitmentJobPayloadMap,
} from "../commitment-pooling/jobs";
import { selectCommitmentPoolingAvailability } from "../commitment-pooling/selectors";
import { JobMaintenance } from "./job-maintenance";
import {
  canonicalJobPayload,
  commitmentJobIdentity,
  createOfflineTxHash,
  MAX_RETRIES,
  isTerminallyFailedJob,
  isWaitingReprobeThrottled,
} from "./queue-policy";
import {
  getPendingQueueCount,
  getQueueJobs,
  getQueueJobsWithImages,
  getQueueStats,
  hasPendingQueueJobs,
  subscribeToQueue,
} from "./queue-readers";

interface ProcessJobContext {
  transactionSender: TransactionSender | null;
}

interface ProcessJobResult {
  success: boolean;
  txHash?: string;
  error?: string;
  skipped?: boolean;
}

interface FlushContext {
  transactionSender: TransactionSender | null;
  /** User address to scope the flush operation */
  userAddress: string;
}

export interface FlushResult {
  processed: number;
  failed: number;
  skipped: number;
}

import type { TransactionSender } from "../transactions/types";
import { getStorageQuota } from "../../utils/storage/quota";

/**
 * Job queue responsible for persisting and processing offline work/approval jobs.
 */
class JobQueue {
  private isFlushing = false;
  private flushPromise: Promise<FlushResult> | null = null;
  private maintenance = new JobMaintenance(jobQueueDB);

  /** Cached storage quota to avoid per-job async latency */
  private cachedStorageQuota: Awaited<ReturnType<typeof getStorageQuota>> | null = null;
  private cachedStorageQuotaFetchedAt = 0;
  private storageQuotaCacheTTL = 30_000; // 30 seconds

  /**
   * Get cached storage quota, refreshing if expired
   */
  private async getCachedStorageQuota(): Promise<Awaited<ReturnType<typeof getStorageQuota>>> {
    const now = Date.now();
    if (
      this.cachedStorageQuota &&
      now - this.cachedStorageQuotaFetchedAt < this.storageQuotaCacheTTL
    ) {
      return this.cachedStorageQuota;
    }
    this.cachedStorageQuota = await getStorageQuota();
    this.cachedStorageQuotaFetchedAt = now;
    return this.cachedStorageQuota;
  }

  /**
   * Add a job to the queue
   * @param kind - Job type (work or approval)
   * @param payload - Job payload data
   * @param userAddress - User address who created this job (required for user scoping)
   * @param meta - Optional metadata
   */
  async addJob<K extends keyof JobKindMap>(
    kind: K,
    payload: JobKindMap[K],
    userAddress: string,
    meta?: Record<string, unknown>
  ): Promise<string> {
    if (!userAddress) {
      throw new Error("userAddress is required when adding a job");
    }

    const chainId = (meta as { chainId?: number })?.chainId || DEFAULT_CHAIN_ID;
    const isOnline = navigator.onLine;

    let persistedPayload = payload;
    if (COMMITMENT_JOB_KINDS.includes(kind as CommitmentJobKind)) {
      const availability = selectCommitmentPoolingAvailability(
        getOntologyChainMaturity("entity:commitment-pool", chainId)
      );
      if (availability.status !== "available") {
        throw new Error("Commitment Pooling is unavailable on this chain");
      }
      const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
      if (isZeroAddress(moduleAddress)) {
        throw new Error("Commitment Pooling is not deployed on this chain");
      }
      persistedPayload = prepareCommitmentJobPayload({
        kind: kind as CommitmentJobKind,
        payload: payload as CommitmentJobPayloadMap[CommitmentJobKind],
        chainId,
        moduleAddress,
        userAddress: userAddress as `0x${string}`,
      }) as JobKindMap[K];
    }

    const identity = commitmentJobIdentity(kind, persistedPayload);
    if (identity) {
      const existingJobs = await jobQueueDB.getJobs({ userAddress, kind: String(kind) });
      const existing = existingJobs.find(
        (job) =>
          !isTerminallyFailedJob(job) && commitmentJobIdentity(job.kind, job.payload) === identity
      );
      if (existing) {
        if (canonicalJobPayload(existing.payload) !== canonicalJobPayload(persistedPayload)) {
          throw new Error(`offline_job_identity_conflict:${identity}`);
        }
        return existing.id;
      }
    }

    // Check storage quota before adding job (using cache to avoid per-job latency)
    const storageQuota = await this.getCachedStorageQuota();
    trackStorageWarning(kind, storageQuota, isOnline);

    const jobId = await jobQueueDB.addJob({
      kind,
      payload: persistedPayload,
      meta: { chainId, ...meta },
      chainId,
      userAddress,
    });

    const job: Job = {
      id: jobId,
      kind,
      payload: persistedPayload,
      meta: { chainId, ...meta },
      chainId,
      userAddress,
      createdAt: Date.now(),
      attempts: 0,
      synced: false,
    };

    trackJobCreated(kind, isOnline, chainId);

    if (import.meta.env?.VITE_QUEUE_DEBUG === "true") {
      let mediaCount = 0;
      if (
        persistedPayload &&
        typeof persistedPayload === "object" &&
        "media" in (persistedPayload as unknown as Record<string, unknown>)
      ) {
        const maybeMedia = (persistedPayload as unknown as Record<string, unknown>).media;
        mediaCount = Array.isArray(maybeMedia) ? maybeMedia.length : 0;
      }
      logger.debug("[JobQueue] addJob", {
        jobId,
        kind,
        chainId,
        userAddress,
        isOnline,
        mediaCount,
      });
    }

    jobQueueEventBus.emit("job:added", { jobId, job });

    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "REGISTER_SYNC" });
    } catch (error) {
      logger.debug("[JobQueue] Failed to register background sync", { error });
    }

    return jobId;
  }

  /**
   * Calculate exponential backoff delay for a job
   * @param attempts Number of previous attempts
   * @returns Delay in milliseconds (max 60 seconds)
   */
  private calculateBackoffDelay(attempts: number): number {
    return Math.min(1000 * Math.pow(2, attempts), 60_000);
  }

  /**
   * Check if a job is within its backoff window
   */
  private isWithinBackoffWindow(job: Job): boolean {
    if (isWaitingReprobeThrottled(job)) return true;
    if (!job.lastAttemptAt || job.attempts === 0) {
      return false;
    }
    const backoffDelay = this.calculateBackoffDelay(job.attempts);
    const timeSinceLastAttempt = Date.now() - job.lastAttemptAt;
    return timeSinceLastAttempt < backoffDelay;
  }

  /**
   * Process a single job in place.
   */
  async processJob(jobId: string, context: ProcessJobContext): Promise<ProcessJobResult> {
    const job = await jobQueueDB.getJob(jobId);
    if (!job) {
      return { success: true, skipped: true };
    }

    if (job.synced) {
      const txHash = typeof job.meta?.txHash === "string" ? (job.meta.txHash as string) : undefined;
      return { success: true, txHash, skipped: true };
    }

    if (!navigator.onLine) {
      return { success: false, error: "offline", skipped: true };
    }

    // Check exponential backoff - skip if we're still in the backoff window
    if (this.isWithinBackoffWindow(job)) {
      const remainingBackoff =
        this.calculateBackoffDelay(job.attempts) - (Date.now() - (job.lastAttemptAt || 0));
      return {
        success: false,
        error: `backoff_${Math.ceil(remainingBackoff / 1000)}s`,
        skipped: true,
      };
    }

    // Check max retries - permanently fail job if exceeded
    if (job.attempts >= MAX_RETRIES) {
      const errorMessage = `Max retries (${MAX_RETRIES}) exceeded`;
      await jobQueueDB.markJobFailed(jobId, errorMessage);

      jobQueueEventBus.emit("job:failed", { jobId, job, error: errorMessage });
      trackJobPermanentlyFailed(job);

      return { success: false, error: errorMessage };
    }

    const sender = context.transactionSender;
    if (!sender) {
      return { success: false, error: "transaction_sender_unavailable", skipped: true };
    }

    jobQueueEventBus.emit("job:processing", { jobId, job });

    addBreadcrumb("job_processing_started", {
      job_kind: job.kind,
      attempt: job.attempts + 1,
    });

    const chainId = job.chainId || DEFAULT_CHAIN_ID;
    const startTime = Date.now();

    try {
      let txHash: string | undefined;

      if (job.kind === "work") {
        txHash = await executeWorkJob(jobId, job as Job<WorkJobPayload>, chainId, sender);
      } else if (job.kind === "approval") {
        txHash = await executeApprovalJob(job as Job<ApprovalJobPayload>, chainId, sender);
      } else if (COMMITMENT_JOB_KINDS.includes(job.kind as (typeof COMMITMENT_JOB_KINDS)[number])) {
        const execution = await executeCommitmentQueueJob(jobId, job, chainId, sender);
        if (execution.status === "waiting") {
          await jobQueueDB.updateJob({
            ...job,
            meta: { ...(job.meta ?? {}), waitingForDependency: true },
            lastAttemptAt: Date.now(),
          });
          return { success: false, error: execution.reason, skipped: true };
        }
        if (execution.status === "identity-conflict") {
          const errorMessage = `identity_conflict:${execution.reason}`;
          await jobQueueDB.markJobTerminalFailed(jobId, errorMessage);
          jobQueueEventBus.emit("job:failed", { jobId, job, error: errorMessage });
          trackJobPermanentlyFailed({ ...job, lastError: errorMessage, attempts: MAX_RETRIES });
          return { success: false, error: errorMessage };
        }
        if (execution.status === "submitted") {
          await jobQueueDB.updateJob({
            ...job,
            meta: {
              ...(job.meta ?? {}),
              waitingForDependency: false,
              submittedTxHash: execution.txHash,
            },
            lastAttemptAt: Date.now(),
          });
          return {
            success: false,
            error: "pending_materialization",
            txHash: execution.txHash,
            skipped: true,
          };
        }
        txHash = execution.txHash;
      } else {
        throw new Error(`Unsupported job kind: ${job.kind}`);
      }

      const completedTxHash =
        txHash ??
        (typeof job.meta?.submittedTxHash === "string"
          ? job.meta.submittedTxHash
          : createOfflineTxHash(jobId));
      await jobQueueDB.markJobSynced(jobId, completedTxHash);

      // Store clientWorkId mapping for instant deduplication
      if (job.kind === "work" && job.meta?.clientWorkId) {
        try {
          await jobQueueDB.storeClientWorkIdMapping(
            job.meta.clientWorkId as string,
            completedTxHash,
            jobId
          );
        } catch (error) {
          logger.warn("[JobQueue] Failed to store clientWorkId mapping", { error });
        }
      }

      try {
        await jobQueueDB.deleteJob(jobId);
      } catch (error) {
        logger.warn("[JobQueue] Failed to delete synced job", { jobId, error });
        await this.maintenance.trackFailedDelete(jobId);
      }

      const completedJob: Job = {
        ...job,
        synced: true,
        meta: { ...(job.meta || {}), txHash: completedTxHash },
      };

      jobQueueEventBus.emit("job:completed", {
        jobId,
        job: completedJob,
        txHash: completedTxHash,
      });
      trackJobProcessed(job.kind, Date.now() - startTime, job.attempts + 1);

      return { success: true, txHash: completedTxHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const processingDuration = Date.now() - startTime;

      await jobQueueDB.markJobFailed(jobId, errorMessage);
      const updated = (await jobQueueDB.getJob(jobId)) ?? job;

      jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: errorMessage });
      await trackJobProcessingError(job, processingDuration, chainId, MAX_RETRIES);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Flush unsynced jobs sequentially.
   * Uses mutex to prevent concurrent flush operations.
   */
  async flush(context: FlushContext): Promise<FlushResult> {
    if (this.isFlushing && this.flushPromise) {
      return this.flushPromise;
    }

    this.isFlushing = true;
    this.flushPromise = this._flushInternal(context);

    try {
      return await this.flushPromise;
    } finally {
      this.isFlushing = false;
      this.flushPromise = null;
    }
  }

  /**
   * Internal flush implementation - processes only jobs for the specified user
   *
   * Uses the Scheduler API to yield to user input between jobs,
   * preventing UI jank during batch processing.
   */
  private async _flushInternal(context: FlushContext): Promise<FlushResult> {
    if (!context.userAddress) {
      throw new Error("userAddress is required for flush operation");
    }

    const jobs = await jobQueueDB.getJobs({ userAddress: context.userAddress, synced: false });
    if (jobs.length === 0) {
      const emptyResult = { processed: 0, failed: 0, skipped: 0 };
      jobQueueEventBus.emit("queue:sync-completed", { result: emptyResult });
      return emptyResult;
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      try {
        const result = await scheduleTask(() => this.processJob(job.id, context), {
          priority: "background",
        });

        if (result.success) {
          processed += 1;
        } else if (result.skipped) {
          skipped += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: errorMessage });
      }

      // Yield to main thread every 3 jobs to keep UI responsive
      if ((i + 1) % 3 === 0 && i + 1 < jobs.length) {
        await yieldToMain();
      }
    }

    const result = { processed, failed, skipped };
    jobQueueEventBus.emit("queue:sync-completed", { result });
    return result;
  }

  async getStats(userAddress: string): Promise<QueueStats> {
    return getQueueStats(userAddress);
  }

  async getJobs(userAddress: string, filter?: { kind?: string; synced?: boolean }): Promise<Job[]> {
    return getQueueJobs(userAddress, filter);
  }

  async getJobsWithImages(userAddress: string): ReturnType<typeof getQueueJobsWithImages> {
    return getQueueJobsWithImages(userAddress);
  }

  async hasPendingJobs(userAddress: string): Promise<boolean> {
    return hasPendingQueueJobs(userAddress);
  }

  async getPendingCount(userAddress: string): Promise<number> {
    return getPendingQueueCount(userAddress);
  }

  subscribe(listener: (event: QueueEvent) => void): () => void {
    return subscribeToQueue(listener);
  }

  /**
   * Cleanup orphaned synced jobs that failed to delete.
   */
  async cleanupOrphanedSyncedJobs(): Promise<{ cleaned: number; failed: number }> {
    return this.maintenance.cleanupOrphanedSyncedJobs();
  }

  /**
   * Start periodic cleanup of orphaned synced jobs.
   */
  startCleanupScheduler(intervalMs?: number): void {
    this.maintenance.startCleanupScheduler(intervalMs);
  }

  /**
   * Stop the periodic cleanup scheduler.
   */
  stopCleanupScheduler(): void {
    this.maintenance.stopCleanupScheduler();
  }

  /**
   * Cleanup resources when queue is no longer needed
   */
  async cleanup(): Promise<void> {
    this.stopCleanupScheduler();
    await jobQueueDB.cleanup();
  }
}

export const jobQueue = new JobQueue();

export { jobQueueDB } from "./db";
export { computeFirstIncompleteStep, draftDB } from "./draft-db";
export { jobQueueEventBus, useJobQueueEvents } from "./event-bus";
export { mediaResourceManager } from "./media-resource-manager";
export {
  COMMITMENT_WAITING_REPROBE_MS,
  createOfflineTxHash,
  isOfflineTxHash,
  isTerminallyFailedJob,
  isWaitingReprobeThrottled,
} from "./queue-policy";
