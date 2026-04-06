import { DEFAULT_CHAIN_ID } from "../../config";
import type {
  ApprovalJobPayload,
  Job,
  JobKindMap,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../../types/job-queue";
import { scheduleTask, yieldToMain } from "../../utils/scheduler";
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
import { executeApprovalJob, executeWorkJob } from "./job-executors";
import { JobMaintenance } from "./job-maintenance";

/**
 * Create a synthetic transaction hash for offline-queued jobs.
 *
 * The Completed.tsx view expects a `0x${string}` txHash for navigation
 * and display. When a work is submitted offline (before chain sync),
 * no real txHash exists yet. This function produces a deterministic
 * placeholder that:
 *
 * 1. Satisfies the `0x${string}` type constraint
 * 2. Embeds the job ID for traceability (UUIDs with dashes stripped)
 * 3. Is distinguishable from real hashes via the "offline_" prefix
 *
 * **Consumers must never submit this hash to an RPC or block explorer.**
 * Use {@link isOfflineTxHash} to guard against that.
 *
 * @param jobId - UUID from the job queue (e.g. "a1b2c3d4-e5f6-...")
 * @returns A 0x-prefixed string like `0xoffline_00000000a1b2c3d4e5f6...`
 */
export function createOfflineTxHash(jobId: string): `0x${string}` {
  const paddedId = jobId.replace(/-/g, "").substring(0, 56).padStart(56, "0");
  return `0xoffline_${paddedId}` as `0x${string}`;
}

/**
 * Check whether a transaction hash is a synthetic offline placeholder.
 *
 * Use this guard before submitting a txHash to an RPC provider,
 * block explorer link, or any on-chain verification flow.
 *
 * @param txHash - The transaction hash to check
 * @returns `true` if the hash was created by {@link createOfflineTxHash}
 */
export function isOfflineTxHash(txHash: string): boolean {
  return txHash.startsWith("0xoffline_");
}

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

/** Maximum number of retry attempts before a job is marked as permanently failed */
const MAX_RETRIES = 5;

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

    // Check storage quota before adding job (using cache to avoid per-job latency)
    const storageQuota = await this.getCachedStorageQuota();
    trackStorageWarning(kind, storageQuota, isOnline);

    const jobId = await jobQueueDB.addJob({
      kind,
      payload,
      meta: { chainId, ...meta },
      chainId,
      userAddress,
    });

    const job: Job = {
      id: jobId,
      kind,
      payload,
      meta: { chainId, ...meta },
      chainId,
      userAddress,
      createdAt: Date.now(),
      attempts: 0,
      synced: false,
    };

    trackJobCreated(jobId, kind, isOnline, chainId, userAddress);

    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      let mediaCount = 0;
      if (
        payload &&
        typeof payload === "object" &&
        "media" in (payload as unknown as Record<string, unknown>)
      ) {
        const maybeMedia = (payload as unknown as Record<string, unknown>).media;
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
      trackJobPermanentlyFailed(jobId, job);

      return { success: false, error: errorMessage };
    }

    const sender = context.transactionSender;
    if (!sender) {
      return { success: false, error: "transaction_sender_unavailable", skipped: true };
    }

    jobQueueEventBus.emit("job:processing", { jobId, job });

    addBreadcrumb("job_processing_started", {
      job_id: jobId,
      job_kind: job.kind,
      attempt: job.attempts + 1,
      garden_address: (job.payload as WorkJobPayload)?.gardenAddress,
    });

    const chainId = job.chainId || DEFAULT_CHAIN_ID;
    const startTime = Date.now();

    try {
      let txHash: string;

      if (job.kind === "work") {
        txHash = await executeWorkJob(jobId, job as Job<WorkJobPayload>, chainId, sender);
      } else if (job.kind === "approval") {
        txHash = await executeApprovalJob(job as Job<ApprovalJobPayload>, chainId, sender);
      } else {
        throw new Error(`Unsupported job kind: ${job.kind}`);
      }

      await jobQueueDB.markJobSynced(jobId, txHash);

      // Store clientWorkId mapping for instant deduplication
      if (job.kind === "work" && job.meta?.clientWorkId) {
        try {
          await jobQueueDB.storeClientWorkIdMapping(job.meta.clientWorkId as string, txHash, jobId);
        } catch (error) {
          logger.warn("[JobQueue] Failed to store clientWorkId mapping", { error });
        }
      }

      try {
        await jobQueueDB.deleteJob(jobId);
      } catch (deleteErr) {
        await this.maintenance.trackFailedDelete(jobId);
      }

      const completedJob: Job = {
        ...job,
        synced: true,
        meta: { ...(job.meta || {}), txHash },
      };

      jobQueueEventBus.emit("job:completed", { jobId, job: completedJob, txHash });
      trackJobProcessed(jobId, job.kind, Date.now() - startTime, job.attempts + 1, txHash);

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const processingDuration = Date.now() - startTime;

      await jobQueueDB.markJobFailed(jobId, errorMessage);
      const updated = (await jobQueueDB.getJob(jobId)) ?? job;

      jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: errorMessage });
      await trackJobProcessingError(jobId, job, error, processingDuration, chainId, MAX_RETRIES);

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

  /**
   * Get job statistics for a specific user
   * @param userAddress - User address to scope statistics
   */
  async getStats(userAddress: string): Promise<QueueStats> {
    if (!userAddress) {
      throw new Error("userAddress is required when getting stats");
    }
    return await jobQueueDB.getStats(userAddress);
  }

  /**
   * Get jobs for a specific user with optional filtering
   * @param userAddress - User address (required)
   * @param filter - Optional filters for kind and synced status
   */
  async getJobs(userAddress: string, filter?: { kind?: string; synced?: boolean }): Promise<Job[]> {
    if (!userAddress) {
      throw new Error("userAddress is required when getting jobs");
    }
    return await jobQueueDB.getJobs({ userAddress, ...filter });
  }

  /**
   * Get pending work jobs with hydrated image files for a specific user.
   * Useful for batch wallet sync where media files must be uploaded before attest.
   */
  async getJobsWithImages(
    userAddress: string
  ): Promise<
    Array<{ job: Job<WorkJobPayload>; images: Array<{ id: string; file: File; url: string }> }>
  > {
    if (!userAddress) {
      throw new Error("userAddress is required when getting jobs with images");
    }

    const jobs = (await jobQueueDB.getJobs({
      userAddress,
      kind: "work",
      synced: false,
    })) as Job<WorkJobPayload>[];

    return await Promise.all(
      jobs.map(async (job) => ({
        job,
        images: await jobQueueDB.getImagesForJob(job.id),
      }))
    );
  }

  /**
   * Check if there are pending jobs for a specific user
   * @param userAddress - User address to check
   */
  async hasPendingJobs(userAddress: string): Promise<boolean> {
    if (!userAddress) {
      throw new Error("userAddress is required when checking pending jobs");
    }
    const jobs = await jobQueueDB.getJobs({ userAddress, synced: false });
    return jobs.length > 0;
  }

  /**
   * Get pending jobs count for a specific user
   * @param userAddress - User address to count
   */
  async getPendingCount(userAddress: string): Promise<number> {
    if (!userAddress) {
      throw new Error("userAddress is required when getting pending count");
    }
    const jobs = await jobQueueDB.getJobs({ userAddress, synced: false });
    return jobs.length;
  }

  /**
   * Subscribe to queue events (for backward compatibility)
   */
  subscribe(listener: (event: QueueEvent) => void): () => void {
    const unsubscribeFunctions: (() => void)[] = [];

    unsubscribeFunctions.push(
      jobQueueEventBus.on("job:added", ({ jobId, job }) => {
        listener({ type: "job_added", jobId, job });
      })
    );

    unsubscribeFunctions.push(
      jobQueueEventBus.on("job:processing", ({ jobId, job }) => {
        listener({ type: "job_processing", jobId, job });
      })
    );

    unsubscribeFunctions.push(
      jobQueueEventBus.on("job:completed", ({ jobId, job, txHash }) => {
        listener({ type: "job_completed", jobId, job, txHash });
      })
    );

    unsubscribeFunctions.push(
      jobQueueEventBus.on("job:failed", ({ jobId, job, error }) => {
        listener({ type: "job_failed", jobId, job, error });
      })
    );

    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
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
