import { track } from "@/modules/posthog";
import { queryClient } from "../react-query";
import { serviceWorkerManager } from "../service-worker";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import { getDefaultChainId, JobProcessor } from "./job-processor";
import { type FlushResult, SyncManager } from "./sync-manager";

// Helper to create offline transaction hash for UI compatibility
export function createOfflineTxHash(jobId: string): `0x${string}` {
  // Create a 66-character hash that Completed.tsx expects
  const paddedId = jobId.replace(/-/g, "").substring(0, 56).padStart(56, "0");
  return `0xoffline_${paddedId}` as `0x${string}`;
}

/**
 * Simplified JobQueue class that delegates to specialized classes
 * Main responsibilities: job creation and coordination
 */
class JobQueue {
  private jobProcessor: JobProcessor;
  private syncManager: SyncManager;

  constructor() {
    this.jobProcessor = new JobProcessor();
    this.syncManager = new SyncManager(this.jobProcessor);
  }

  /**
   * Set the smart account client for blockchain transactions
   */
  setSmartAccountClient(client: SmartAccountClient | null): void {
    this.jobProcessor.setSmartAccountClient(client);

    // Trigger a sync when client becomes available
    if (client && navigator.onLine) {
      this.syncManager.flush().catch((error) => {
        track("smart_account_sync_failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob<K extends keyof JobKindMap>(
    kind: K,
    payload: JobKindMap[K],
    meta?: Record<string, unknown>
  ): Promise<string> {
    const chainId = getDefaultChainId(meta as { chainId?: number });
    const isOnline = navigator.onLine;

    const jobId = await jobQueueDB.addJob({
      kind,
      payload,
      meta: { chainId, ...meta },
      chainId,
    });

    // Create full job object for event
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

    // Track job creation
    track("offline_job_created", {
      job_id: jobId,
      job_kind: kind,
      is_online: isOnline,
      chain_id: chainId,
      will_process_immediately: isOnline && !!this.jobProcessor,
    });

    // Emit event using the event bus
    jobQueueEventBus.emit("job:added", { jobId, job });

    // Try to process immediately if we're online
    if (isOnline) {
      this.processJob(jobId).catch((error) => {
        track("offline_job_immediate_process_failed", {
          job_id: jobId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    } else {
      // Request background sync for offline jobs
      serviceWorkerManager.requestBackgroundSync().catch((error) => {
        track("background_sync_request_failed", {
          job_id: jobId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }

    return jobId;
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
   * Process a single job (delegates to JobProcessor)
   */
  private async processJob(jobId: string): Promise<void> {
    const job = await jobQueueDB.getJob(jobId);
    if (!job) return;

    // Emit processing event
    jobQueueEventBus.emit("job:processing", { jobId, job });

    const result = await this.jobProcessor.processJob(jobId);

    if (result.success && result.txHash) {
      // Emit success event
      jobQueueEventBus.emit("job:completed", {
        jobId,
        job,
        txHash: result.txHash,
      });

      // Schedule retry if failed but retries available
      const updatedJob = await jobQueueDB.getJob(jobId);
      if (updatedJob && updatedJob.attempts < 3) {
        const delay = Math.pow(2, updatedJob.attempts) * 1000; // Exponential backoff
        setTimeout(() => {
          jobQueueEventBus.emit("job:retrying", {
            jobId,
            job: updatedJob,
            attempt: updatedJob.attempts + 1,
          });
          this.processJob(jobId).catch((error) => {
            track("retry_job_failed", {
              job_id: jobId,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          });
        }, delay);
      }
    } else if (result.error) {
      // Emit failure event
      jobQueueEventBus.emit("job:failed", {
        jobId,
        job,
        error: result.error,
      });
    }
  }

  /**
   * Flush all pending jobs (delegates to SyncManager)
   */
  async flush(): Promise<FlushResult> {
    return await this.syncManager.flush();
  }

  /**
   * Start periodic sync (delegates to SyncManager)
   */
  startPeriodicSync(intervalMs?: number): void {
    this.syncManager.startPeriodicSync(intervalMs);
  }

  /**
   * Stop periodic sync (delegates to SyncManager)
   */
  stopPeriodicSync(): void {
    this.syncManager.stopPeriodicSync();
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.syncManager.isSyncInProgress();
  }

  /**
   * Subscribe to queue events (for backward compatibility)
   */
  subscribe(listener: (event: QueueEvent) => void): () => void {
    // Convert new event format to old format for backward compatibility
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

    unsubscribeFunctions.push(
      jobQueueEventBus.on("job:retrying", ({ jobId, job, attempt }) => {
        listener({ type: "job_retrying", jobId, job });
      })
    );

    // Return function to unsubscribe from all events
    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }

  /**
   * Cleanup resources when queue is no longer needed
   */
  async cleanup(): Promise<void> {
    this.syncManager.cleanup();
    await jobQueueDB.cleanup();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// Re-export for convenience
export { jobQueueDB } from "./db";
export { getDefaultChainId } from "./job-processor";
export type { FlushResult } from "./sync-manager";
