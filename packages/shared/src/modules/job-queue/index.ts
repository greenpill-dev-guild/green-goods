import type { SmartAccountClient } from "permissionless";
import { track } from "../app/posthog";
import { DEFAULT_CHAIN_ID } from "../../config";
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

interface FlushContext extends ProcessJobContext {}

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

/**
 * Job queue responsible for persisting and processing offline work/approval jobs.
 */
class JobQueue {
  /**
   * Add a job to the queue
   */
  async addJob<K extends keyof JobKindMap>(
    kind: K,
    payload: JobKindMap[K],
    meta?: Record<string, unknown>
  ): Promise<string> {
    const chainId = (meta as { chainId?: number })?.chainId || DEFAULT_CHAIN_ID;
    const isOnline = navigator.onLine;

    const jobId = await jobQueueDB.addJob({
      kind,
      payload,
      meta: { chainId, ...meta },
      chainId,
    });

    const job: Job = {
      id: jobId,
      kind,
      payload,
      meta: { chainId, ...meta },
      chainId,
      createdAt: Date.now(),
      attempts: 0,
      synced: false,
    };

    track("offline_job_created", {
      job_id: jobId,
      job_kind: kind,
      is_online: isOnline,
      chain_id: chainId,
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
        isOnline,
        mediaCount,
      });
    }

    jobQueueEventBus.emit("job:added", { jobId, job });

    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "REGISTER_SYNC" });
    } catch {}

    return jobId;
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
        txHash = await executeWorkJob(jobId, job as Job<WorkJobPayload>, chainId, smartAccountClient);
      } else if (job.kind === "approval") {
        txHash = await executeApprovalJob(job as Job<ApprovalJobPayload>, chainId, smartAccountClient);
      } else {
        throw new Error(`Unsupported job kind: ${job.kind}`);
      }

      await jobQueueDB.markJobSynced(jobId, txHash);
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
        will_retry: true,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Flush unsynced jobs sequentially.
   */
  async flush(context: FlushContext): Promise<FlushResult> {
    const jobs = await jobQueueDB.getJobs({ synced: false });
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
   * Get job statistics
   */
  async getStats(): Promise<QueueStats> {
    return await jobQueueDB.getStats();
  }

  /**
   * Get jobs with optional filtering
   */
  async getJobs(filter?: { kind?: string; synced?: boolean }): Promise<Job[]> {
    return await jobQueueDB.getJobs(filter);
  }

  /**
   * Check if there are pending jobs
   */
  async hasPendingJobs(): Promise<boolean> {
    const jobs = await jobQueueDB.getJobs({ synced: false });
    return jobs.length > 0;
  }

  /**
   * Get pending jobs count
   */
  async getPendingCount(): Promise<number> {
    const jobs = await jobQueueDB.getJobs({ synced: false });
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
