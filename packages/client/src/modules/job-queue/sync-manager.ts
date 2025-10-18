import { track, trackSyncPerformance } from "@/modules/app/posthog";
import { queryClient } from "../../config/react-query";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";
import { JobProcessor } from "./job-processor";

export interface FlushResult {
  processed: number;
  failed: number;
  skipped: number;
}

/**
 * Handles sync scheduling and network detection - single responsibility for sync management
 */
export class SyncManager {
  private syncInProgress = false;
  private flushPromise: Promise<FlushResult> | null = null;
  private lastFlushTime = 0;
  private readonly FLUSH_DEBOUNCE_MS = 1000;

  constructor(private jobProcessor: JobProcessor) {
    // Bind methods to maintain context
    this.handleOnline = this.handleOnline.bind(this);
    // Bind online event immediately; we do not use periodic timers
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
    }
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Flush all pending jobs with proper race condition handling
   */
  async flush(): Promise<FlushResult> {
    // Return existing flush if in progress
    if (this.flushPromise) {
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] flush requested but one is already in progress");
      }
      return this.flushPromise;
    }

    // Debounce flush calls
    const now = Date.now();
    if (now - this.lastFlushTime < this.FLUSH_DEBOUNCE_MS) {
      // Return a resolved promise for debounced calls
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] flush debounced");
      }
      return Promise.resolve({ processed: 0, failed: 0, skipped: 0 });
    }
    this.lastFlushTime = now;

    // Check prerequisites
    if (!navigator.onLine) {
      jobQueueEventBus.emit("queue:sync-failed", { error: "Currently offline" });
      track("offline_queue_flush_failed", {
        error: "Currently offline",
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] flush aborted: offline");
      }
      throw new Error("Cannot sync: currently offline");
    }

    this.flushPromise = this.doFlush()
      .then((result) => {
        // Only emit/track when there was actual work
        const total = result.processed + result.failed + result.skipped;
        if (total > 0) {
          jobQueueEventBus.emit("queue:sync-completed", { result });
          track("offline_queue_flushed", {
            processed: result.processed,
            failed: result.failed,
            skipped: result.skipped,
            total_jobs: total,
          });
          if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
            // eslint-disable-next-line no-console
            console.debug("[SyncManager] flush completed", result);
          }
        }
        return result;
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        jobQueueEventBus.emit("queue:sync-failed", { error: errorMessage });
        track("offline_queue_flush_error", {
          error: errorMessage,
        });
        if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
          // eslint-disable-next-line no-console
          console.debug("[SyncManager] flush failed", errorMessage);
        }
        throw error;
      })
      .finally(() => {
        this.flushPromise = null;
      });

    return this.flushPromise;
  }

  /**
   * Internal flush implementation
   */
  private async doFlush(): Promise<FlushResult> {
    const startTime = Date.now();

    // Check queue first; avoid emitting start/completed events for empty flushes
    const pendingJobs = await jobQueueDB.getJobs({ synced: false });
    if (pendingJobs.length === 0) {
      trackSyncPerformance("flush_empty", startTime, true, {
        pending_jobs: 0,
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] no pending jobs to flush");
      }
      return { processed: 0, failed: 0, skipped: 0 };
    }

    this.syncInProgress = true;
    jobQueueEventBus.emit("queue:sync-started", {});
    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      // eslint-disable-next-line no-console
      console.debug("[SyncManager] starting flush", { count: pendingJobs.length });
    }

    try {
      // Process jobs using the JobProcessor
      const result = await this.jobProcessor.processBatch(pendingJobs);

      // Clean up synced jobs after processing
      await jobQueueDB.clearSyncedJobs();

      // Invalidate only uploading list; per-job events handle targeted updates elsewhere
      queryClient.invalidateQueries({ queryKey: ["uploadingWorkJobs"] });

      // Track successful sync
      trackSyncPerformance("flush_completed", startTime, true, {
        ...result,
        total_jobs: pendingJobs.length,
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] processed batch", result);
      }

      return result;
    } catch (error) {
      // Track failed sync
      trackSyncPerformance("flush_failed", startTime, false, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[SyncManager] doFlush error", error);
      }
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Periodic sync removed; rely on online/client/SW triggers

  /**
   * Handle online event
   */
  private handleOnline(): void {
    jobQueueEventBus.emit("offline:status-changed", { isOnline: true });
    this.flush().catch((error) => {
      track("online_sync_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
    }
  }
}
