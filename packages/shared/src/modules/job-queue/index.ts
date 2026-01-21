import type { SmartAccountClient } from "permissionless";
import { DEFAULT_CHAIN_ID } from "../../config";
import type { WorkApprovalDraft, WorkSubmission } from "../../types/domain";
import type {
  ApprovalJobPayload,
  Job,
  JobKindMap,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../../types/job-queue";
import { scheduleTask, yieldToMain } from "../../utils/scheduler";
import { getStorageQuota } from "../../utils/storage/quota";
import { trackSyncError, addBreadcrumb, getBreadcrumbs } from "../app/error-tracking";
import { getIpfsInitStatus } from "../data/ipfs";
import { track } from "../app/posthog";
import { submitApprovalWithPasskey, submitWorkWithPasskey } from "../work/passkey-submission";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";

// Helper to create offline transaction hash for UI compatibility
export function createOfflineTxHash(jobId: string): `0x${string}` {
  // Create a 66-character hash that Completed.tsx expects
  const paddedId = jobId.replace(/-/g, "").substring(0, 56).padStart(56, "0");
  return `0xoffline_${paddedId}` as `0x${string}`;
}

interface ProcessJobContext {
  smartAccountClient: SmartAccountClient | null;
}

interface ProcessJobResult {
  success: boolean;
  txHash?: string;
  error?: string;
  skipped?: boolean;
}

interface FlushContext extends ProcessJobContext {
  /** User address to scope the flush operation */
  userAddress: string;
}

export interface FlushResult {
  processed: number;
  failed: number;
  skipped: number;
}

function ensureArray<T>(value: T[] | T | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "undefined") return [];
  return [value as T];
}

async function executeWorkJob(
  jobId: string,
  job: Job<WorkJobPayload>,
  chainId: number,
  smartAccountClient: SmartAccountClient
): Promise<string> {
  const images = await jobQueueDB.getImagesForJob(jobId);
  const files = images.map((img) => img.file);
  const payload = job.payload as WorkJobPayload;
  const actionTitle = payload.title || `Action ${payload.actionUID}`;

  return await submitWorkWithPasskey({
    client: smartAccountClient,
    draft: {
      actionUID: payload.actionUID,
      title: actionTitle,
      plantSelection: ensureArray<string>(payload.plantSelection),
      plantCount: typeof payload.plantCount === "number" ? payload.plantCount : 0,
      feedback: payload.feedback,
      media: files,
    } as WorkSubmission,
    gardenAddress: payload.gardenAddress,
    actionUID: payload.actionUID,
    actionTitle,
    chainId,
    images: files,
  });
}

async function executeApprovalJob(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  smartAccountClient: SmartAccountClient
): Promise<string> {
  const payload = job.payload as ApprovalJobPayload;

  return await submitApprovalWithPasskey({
    client: smartAccountClient,
    draft: {
      actionUID: payload.actionUID,
      workUID: payload.workUID,
      approved: payload.approved,
      feedback: payload.feedback,
    } as WorkApprovalDraft,
    gardenAddress: payload.gardenAddress,
    chainId,
  });
}

/** Maximum number of retry attempts before a job is marked as permanently failed */
const MAX_RETRIES = 5;

/**
 * Job queue responsible for persisting and processing offline work/approval jobs.
 */
/** Default interval for orphaned job cleanup (5 minutes) */
const ORPHAN_CLEANUP_INTERVAL = 5 * 60 * 1000;

/** Threshold for alerting on failed delete count */
const FAILED_DELETE_ALERT_THRESHOLD = 10;

class JobQueue {
  private isFlushing = false;
  private flushPromise: Promise<FlushResult> | null = null;

  /** Track job IDs that failed to delete for retry */
  private failedDeleteJobIds: Set<string> = new Set();

  /** Counter for failed deletes since last cleanup */
  private failedDeleteCount = 0;

  /** Interval ID for cleanup scheduler */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Cached storage quota to avoid per-job async latency */
  private cachedStorageQuota: Awaited<ReturnType<typeof getStorageQuota>> | null = null;
  private cachedStorageQuotaFetchedAt = 0;
  private storageQuotaCacheTTL = 30_000; // 30 seconds

  /** Whether failed delete IDs have been rehydrated from IndexedDB */
  private failedDeleteIdsInitialized = false;

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
   * Initialize failed delete IDs from IndexedDB on first access
   */
  private async initFailedDeleteIds(): Promise<void> {
    if (this.failedDeleteIdsInitialized) return;
    try {
      const storedIds = await jobQueueDB.loadFailedDeleteIds();
      this.failedDeleteJobIds = new Set(storedIds);
      this.failedDeleteCount = storedIds.length;
      this.failedDeleteIdsInitialized = true;
    } catch (err) {
      console.warn("[JobQueue] Failed to load failed delete IDs from IndexedDB:", err);
      this.failedDeleteIdsInitialized = true;
    }
  }

  /**
   * Persist failed delete IDs to IndexedDB
   */
  private async persistFailedDeleteIds(): Promise<void> {
    try {
      await jobQueueDB.saveFailedDeleteIds([...this.failedDeleteJobIds]);
    } catch (err) {
      console.warn("[JobQueue] Failed to persist failed delete IDs to IndexedDB:", err);
    }
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

    // Track storage status with job creation
    if (storageQuota.isCritical) {
      // Track critical storage warning - job may fail to persist
      track("job_queue_storage_critical", {
        job_kind: kind,
        storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
        storage_used_mb: Math.round(storageQuota.used / (1024 * 1024)),
        storage_quota_mb: Math.round(storageQuota.quota / (1024 * 1024)),
        is_online: isOnline,
      });

      // Add breadcrumb for debugging potential storage failures
      addBreadcrumb("storage_critical_on_job_add", {
        job_kind: kind,
        percent_used: storageQuota.percentUsed,
      });

      console.warn(
        `[JobQueue] Storage critically low (${Math.round(storageQuota.percentUsed)}% used). Job may fail to persist.`
      );
    } else if (storageQuota.isLow) {
      // Track low storage warning
      track("job_queue_storage_low", {
        job_kind: kind,
        storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
        is_online: isOnline,
      });

      addBreadcrumb("storage_low_on_job_add", {
        job_kind: kind,
        percent_used: storageQuota.percentUsed,
      });
    }

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

    // Add breadcrumb for error debugging
    addBreadcrumb("job_created", {
      job_id: jobId,
      job_kind: kind,
      is_online: isOnline,
      garden_address: (payload as WorkJobPayload)?.gardenAddress,
    });

    track("offline_job_created", {
      job_id: jobId,
      job_kind: kind,
      is_online: isOnline,
      chain_id: chainId,
      user_address: userAddress,
      will_process_immediately: false,
    });

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
      // eslint-disable-next-line no-console
      console.debug("[JobQueue] addJob", {
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
      // Log service worker registration failures for debugging
      console.debug("[JobQueue] Failed to register background sync:", error);
    }

    return jobId;
  }

  /**
   * Calculate exponential backoff delay for a job
   * @param attempts Number of previous attempts
   * @returns Delay in milliseconds (max 60 seconds)
   */
  private calculateBackoffDelay(attempts: number): number {
    // Base delay of 1 second, doubles each attempt, max 60 seconds
    return Math.min(1000 * Math.pow(2, attempts), 60_000);
  }

  /**
   * Check if a job is within its backoff window
   */
  private isWithinBackoffWindow(job: Job): boolean {
    if (!job.lastAttemptAt || job.attempts === 0) {
      return false; // Never attempted or first attempt
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

      // Get IPFS status for debugging
      const ipfsStatus = getIpfsInitStatus();

      // Track as fatal error - job will not be retried
      trackSyncError(new Error(errorMessage), {
        severity: "fatal",
        source: "JobQueue.processJob",
        userAction: `${job.kind} job exhausted retries`,
        recoverable: false,
        metadata: {
          job_id: jobId,
          job_kind: job.kind,
          attempts: job.attempts,
          last_error: job.lastError,
          garden_address: (job.payload as WorkJobPayload)?.gardenAddress,
          action_uid: (job.payload as WorkJobPayload)?.actionUID,
          ipfs_status: ipfsStatus.status,
          ipfs_client_ready: ipfsStatus.clientReady,
        },
      });

      track("offline_job_permanently_failed", {
        job_id: jobId,
        job_kind: job.kind,
        attempts: job.attempts,
        last_error: job.lastError,
        ipfs_status: ipfsStatus.status,
      });

      return { success: false, error: errorMessage };
    }

    const smartAccountClient = context.smartAccountClient;
    if (!smartAccountClient) {
      return { success: false, error: "smart_account_unavailable", skipped: true };
    }

    jobQueueEventBus.emit("job:processing", { jobId, job });

    // Add breadcrumb for error debugging
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
        txHash = await executeWorkJob(
          jobId,
          job as Job<WorkJobPayload>,
          chainId,
          smartAccountClient
        );
      } else if (job.kind === "approval") {
        txHash = await executeApprovalJob(
          job as Job<ApprovalJobPayload>,
          chainId,
          smartAccountClient
        );
      } else {
        throw new Error(`Unsupported job kind: ${job.kind}`);
      }

      await jobQueueDB.markJobSynced(jobId, txHash);

      // Store clientWorkId mapping for instant deduplication
      if (job.kind === "work" && job.meta?.clientWorkId) {
        try {
          await jobQueueDB.storeClientWorkIdMapping(
            job.meta.clientWorkId as string,
            txHash, // attestation ID
            jobId
          );
        } catch (error) {
          console.warn("[JobQueue] Failed to store clientWorkId mapping:", error);
        }
      }

      try {
        await jobQueueDB.deleteJob(jobId);
      } catch (deleteErr) {
        // Job is already marked synced, so this is just a storage leak
        // Track for cleanup retry and persist to IndexedDB
        this.failedDeleteJobIds.add(jobId);
        this.failedDeleteCount += 1;
        await this.persistFailedDeleteIds();

        console.warn("[JobQueue] Failed to delete synced job:", jobId, deleteErr);

        // Alert if threshold exceeded
        if (this.failedDeleteCount >= FAILED_DELETE_ALERT_THRESHOLD) {
          track("job_queue_delete_failures_threshold", {
            failed_count: this.failedDeleteCount,
            pending_cleanup_count: this.failedDeleteJobIds.size,
          });
        }
      }

      const completedJob: Job = {
        ...job,
        synced: true,
        meta: { ...(job.meta || {}), txHash },
      };

      jobQueueEventBus.emit("job:completed", { jobId, job: completedJob, txHash });

      track("offline_job_processed", {
        job_id: jobId,
        job_kind: job.kind,
        processing_time_ms: Date.now() - startTime,
        attempts: job.attempts + 1,
        tx_hash: txHash,
      });

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const processingDuration = Date.now() - startTime;

      await jobQueueDB.markJobFailed(jobId, errorMessage);
      const updated = (await jobQueueDB.getJob(jobId)) ?? job;

      jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: errorMessage });

      // Get IPFS status for debugging upload failures
      const ipfsStatus = getIpfsInitStatus();

      // Get storage quota for debugging storage-related failures
      const storageQuota = await getStorageQuota();

      // Track as structured exception for PostHog error dashboard
      trackSyncError(error, {
        source: "JobQueue.processJob",
        userAction: `processing ${job.kind} job`,
        recoverable: job.attempts + 1 < MAX_RETRIES,
        metadata: {
          job_id: jobId,
          job_kind: job.kind,
          attempts: job.attempts + 1,
          max_retries: MAX_RETRIES,
          will_retry: job.attempts + 1 < MAX_RETRIES,
          processing_duration_ms: processingDuration,
          chain_id: chainId,
          user_address: job.userAddress,
          garden_address: (job.payload as WorkJobPayload)?.gardenAddress,
          action_uid: (job.payload as WorkJobPayload)?.actionUID,
          ipfs_status: ipfsStatus.status,
          ipfs_error: ipfsStatus.error,
          ipfs_client_ready: ipfsStatus.clientReady,
          is_online: typeof navigator !== "undefined" ? navigator.onLine : true,
          connection_type:
            typeof navigator !== "undefined"
              ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection
                  ?.effectiveType
              : undefined,
          // Storage quota information
          storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
          storage_is_low: storageQuota.isLow,
          storage_is_critical: storageQuota.isCritical,
          storage_used_mb: Math.round(storageQuota.used / (1024 * 1024)),
          storage_quota_mb: Math.round(storageQuota.quota / (1024 * 1024)),
          breadcrumbs: getBreadcrumbs().slice(-5),
        },
      });

      // Also track as analytics event for funnel analysis
      track("offline_job_failed", {
        job_id: jobId,
        job_kind: job.kind,
        error: errorMessage,
        attempts: job.attempts + 1,
        will_retry: job.attempts + 1 < MAX_RETRIES,
        processing_duration_ms: processingDuration,
        ipfs_status: ipfsStatus.status,
        ipfs_client_ready: ipfsStatus.clientReady,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Flush unsynced jobs sequentially.
   * Uses mutex to prevent concurrent flush operations.
   */
  async flush(context: FlushContext): Promise<FlushResult> {
    // Return existing promise if flush already in progress
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

    // Only get jobs for the current user
    const jobs = await jobQueueDB.getJobs({ userAddress: context.userAddress, synced: false });
    if (jobs.length === 0) {
      const emptyResult = { processed: 0, failed: 0, skipped: 0 };
      jobQueueEventBus.emit("queue:sync-completed", { result: emptyResult });
      return emptyResult;
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Process jobs with scheduler to yield to user input
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      try {
        // Schedule job processing as background task - yields to user interactions
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
   * This method scans for jobs marked as synced but still present,
   * and retries deletion.
   */
  async cleanupOrphanedSyncedJobs(): Promise<{ cleaned: number; failed: number }> {
    // Ensure we've rehydrated from IndexedDB
    await this.initFailedDeleteIds();

    let cleaned = 0;
    let failed = 0;

    // First, retry jobs from the failed delete set
    for (const jobId of this.failedDeleteJobIds) {
      try {
        const job = await jobQueueDB.getJob(jobId);
        // Only delete if job exists and is synced
        if (job?.synced) {
          await jobQueueDB.deleteJob(jobId);
          this.failedDeleteJobIds.delete(jobId);
          cleaned += 1;
        } else if (!job) {
          // Job already deleted, remove from tracking
          this.failedDeleteJobIds.delete(jobId);
          cleaned += 1;
        }
      } catch {
        failed += 1;
      }
    }

    // Note: We only clean up jobs that previously failed to delete.
    // A full scan of all synced jobs would require iterating over all users,
    // which is handled separately via the JobQueueDB.cleanupSyncedJobs method
    // that can be called with a specific userAddress.

    // Reset counter after cleanup attempt
    this.failedDeleteCount = 0;

    // Persist the updated set
    await this.persistFailedDeleteIds();

    if (cleaned > 0 || failed > 0) {
      track("job_queue_orphan_cleanup", {
        cleaned,
        failed,
        remaining: this.failedDeleteJobIds.size,
      });
    }

    return { cleaned, failed };
  }

  /**
   * Start periodic cleanup of orphaned synced jobs.
   * @param intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
   */
  startCleanupScheduler(intervalMs: number = ORPHAN_CLEANUP_INTERVAL): void {
    if (this.cleanupIntervalId) {
      return; // Already running
    }

    // Rehydrate failed delete IDs from IndexedDB on startup
    this.initFailedDeleteIds().catch((err) => {
      console.warn("[JobQueue] Failed to init failed delete IDs:", err);
    });

    this.cleanupIntervalId = setInterval(() => {
      // Only run cleanup if there are failed deletes to retry
      if (this.failedDeleteJobIds.size > 0) {
        this.cleanupOrphanedSyncedJobs().catch((err) => {
          console.warn("[JobQueue] Cleanup scheduler error:", err);
        });
      }
    }, intervalMs);
  }

  /**
   * Stop the periodic cleanup scheduler.
   */
  stopCleanupScheduler(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
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
