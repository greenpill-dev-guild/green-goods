import { track } from "@/modules/posthog";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";

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
  constructor() {}

  /**
   * Add a job to the queue
   */
  async addJob<K extends keyof JobKindMap>(
    kind: K,
    payload: JobKindMap[K],
    meta?: Record<string, unknown>
  ): Promise<string> {
    const chainId = (meta as { chainId?: number })?.chainId || 84532;
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
      will_process_immediately: false,
    });

    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      const mediaCount =
        payload && typeof payload === "object" && "media" in (payload as any)
          ? Array.isArray((payload as any).media)
            ? (payload as any).media.length
            : 0
          : 0;
      // eslint-disable-next-line no-console
      console.debug("[JobQueue] addJob", {
        jobId,
        kind,
        chainId,
        isOnline,
        mediaCount,
      });
    }

    // Emit event using the event bus
    jobQueueEventBus.emit("job:added", { jobId, job });

    // Immediate processing removed; providers handle processing inline

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

  // Processing APIs removed; providers handle processing inline

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
      jobQueueEventBus.on("job:retrying", ({ jobId, job }) => {
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
    await jobQueueDB.cleanup();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// Re-export for convenience
export { jobQueueDB } from "./db";

// No client adaptation here; providers perform uploads inline
