import type { SmartAccountClient } from "permissionless";
import { DEFAULT_CHAIN_ID } from "../../config";
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
    } as WorkDraft,
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
    gardenerAddress: payload.gardenerAddress || "",
    chainId,
  });
}

/** Maximum number of retry attempts before a job is marked as permanently failed */
const MAX_RETRIES = 5;

/**
 * Job queue responsible for persisting and processing offline work/approval jobs.
 */
class JobQueue {
  private isFlushing = false;
  private flushPromise: Promise<FlushResult> | null = null;

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

      track("offline_job_permanently_failed", {
        job_id: jobId,
        job_kind: job.kind,
        attempts: job.attempts,
        last_error: job.lastError,
      });

      return { success: false, error: errorMessage };
    }

    const smartAccountClient = context.smartAccountClient;
    if (!smartAccountClient) {
      return { success: false, error: "smart_account_unavailable", skipped: true };
    }

    jobQueueEventBus.emit("job:processing", { jobId, job });

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
      } catch {}

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

      await jobQueueDB.markJobFailed(jobId, errorMessage);
      const updated = (await jobQueueDB.getJob(jobId)) ?? job;

      jobQueueEventBus.emit("job:failed", { jobId, job: updated, error: errorMessage });

      track("offline_job_failed", {
        job_id: jobId,
        job_kind: job.kind,
        error: errorMessage,
        attempts: job.attempts + 1,
        will_retry: job.attempts + 1 < MAX_RETRIES,
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

    for (const job of jobs) {
      try {
        const result = await this.processJob(job.id, context);
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
   * Cleanup resources when queue is no longer needed
   */
  async cleanup(): Promise<void> {
    await jobQueueDB.cleanup();
  }
}

export const jobQueue = new JobQueue();

export { jobQueueDB } from "./db";
export { jobQueueEventBus, useJobQueueEvents } from "./event-bus";
