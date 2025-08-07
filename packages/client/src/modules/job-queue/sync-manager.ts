import { track, trackSyncPerformance } from "@/modules/posthog";
import { queryClient } from "../react-query";
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
  private syncInterval: NodeJS.Timeout | null = null;
  private flushPromise: Promise<FlushResult> | null = null;
  private lastFlushTime = 0;
  private readonly FLUSH_DEBOUNCE_MS = 1000;

  constructor(private jobProcessor: JobProcessor) {
    // Bind methods to maintain context
    this.handleOnline = this.handleOnline.bind(this);
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
      return this.flushPromise;
    }

    // Debounce flush calls
    const now = Date.now();
    if (now - this.lastFlushTime < this.FLUSH_DEBOUNCE_MS) {
      // Return a resolved promise for debounced calls
      return Promise.resolve({ processed: 0, failed: 0, skipped: 0 });
    }
    this.lastFlushTime = now;

    // Check prerequisites
    if (!navigator.onLine) {
      jobQueueEventBus.emit("queue:sync-failed", { error: "Currently offline" });
      track("offline_queue_flush_failed", {
        error: "Currently offline",
      });
      throw new Error("Cannot sync: currently offline");
    }

    this.flushPromise = this.doFlush()
      .then((result) => {
        // Track flush results
        jobQueueEventBus.emit("queue:sync-completed", { result });
        track("offline_queue_flushed", {
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped,
          total_jobs: result.processed + result.failed + result.skipped,
        });
        return result;
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        jobQueueEventBus.emit("queue:sync-failed", { error: errorMessage });
        track("offline_queue_flush_error", {
          error: errorMessage,
        });
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
    this.syncInProgress = true;
    jobQueueEventBus.emit("queue:sync-started", {});

    try {
      const pendingJobs = await jobQueueDB.getJobs({ synced: false });

      if (pendingJobs.length === 0) {
        trackSyncPerformance("flush_empty", startTime, true, {
          pending_jobs: 0,
        });
        return { processed: 0, failed: 0, skipped: 0 };
      }

      // Process jobs using the JobProcessor
      const result = await this.jobProcessor.processBatch(pendingJobs);

      // Clean up synced jobs
      await jobQueueDB.clearSyncedJobs();

      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });

      // Track successful sync
      trackSyncPerformance("flush_completed", startTime, true, {
        ...result,
        total_jobs: pendingJobs.length,
      });

      return result;
    } catch (error) {
      // Track failed sync
      trackSyncPerformance("flush_failed", startTime, false, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start periodic sync with configurable interval
   */
  startPeriodicSync(intervalMs: number = 30000): void {
    this.stopPeriodicSync(); // Clear existing interval

    // Initial sync
    this.flush().catch((error) => {
      track("initial_sync_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.flush().catch((error) => {
        track("periodic_sync_failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }, intervalMs);

    // Sync when coming back online
    window.addEventListener("online", this.handleOnline);
  }

  /**
   * Stop periodic sync and cleanup
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    window.removeEventListener("online", this.handleOnline);
  }

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
    this.stopPeriodicSync();
  }
}
