import type { JobQueueAnalytics, JobQueueLogger, JobQueueStore } from "./ports";

/** Threshold for alerting on failed delete count. Exported for the telemetry-privacy test. */
export const FAILED_DELETE_ALERT_THRESHOLD = 10;

/**
 * Manages cleanup of orphaned synced jobs that failed to delete.
 *
 * Tracks job IDs that failed deletion, persists them to IndexedDB,
 * and provides a scheduler for periodic retry.
 */
export class JobMaintenance {
  /** Track job IDs that failed to delete for retry */
  failedDeleteJobIds: Set<string> = new Set();

  /** Counter for failed deletes since last cleanup */
  failedDeleteCount = 0;

  /** Whether failed delete IDs have been rehydrated from IndexedDB */
  private failedDeleteIdsInitialized = false;

  constructor(
    private db: Pick<
      JobQueueStore,
      "deleteJob" | "getJob" | "loadFailedDeleteIds" | "saveFailedDeleteIds"
    >,
    private analytics: Pick<JobQueueAnalytics, "privateEvent">,
    private log: JobQueueLogger
  ) {}

  /**
   * Initialize failed delete IDs from IndexedDB on first access
   */
  async initFailedDeleteIds(): Promise<void> {
    if (this.failedDeleteIdsInitialized) return;
    try {
      const storedIds = await this.db.loadFailedDeleteIds();
      this.failedDeleteJobIds = new Set(storedIds);
      this.failedDeleteCount = storedIds.length;
      this.failedDeleteIdsInitialized = true;
    } catch (err) {
      this.log.warn("[JobQueue] Failed to load failed delete IDs from IndexedDB", { error: err });
      this.failedDeleteIdsInitialized = true;
    }
  }

  /**
   * Persist failed delete IDs to IndexedDB
   */
  async persistFailedDeleteIds(): Promise<void> {
    try {
      await this.db.saveFailedDeleteIds([...this.failedDeleteJobIds]);
    } catch (err) {
      this.log.warn("[JobQueue] Failed to persist failed delete IDs to IndexedDB", { error: err });
    }
  }

  /**
   * Track a failed job deletion for later cleanup retry.
   */
  async trackFailedDelete(jobId: string): Promise<void> {
    this.failedDeleteJobIds.add(jobId);
    this.failedDeleteCount += 1;
    await this.persistFailedDeleteIds();

    this.log.warn("[JobQueue] Failed to delete synced job", { jobId });

    if (this.failedDeleteCount >= FAILED_DELETE_ALERT_THRESHOLD) {
      this.analytics.privateEvent("job_queue_delete_failures_threshold", {
        failed_count: this.failedDeleteCount,
        pending_cleanup_count: this.failedDeleteJobIds.size,
      });
    }
  }

  /**
   * Cleanup orphaned synced jobs that failed to delete.
   * Scans the failed delete set and retries deletion.
   */
  async cleanupOrphanedSyncedJobs(): Promise<{ cleaned: number; failed: number }> {
    await this.initFailedDeleteIds();

    let cleaned = 0;
    let failed = 0;

    for (const jobId of this.failedDeleteJobIds) {
      try {
        const job = await this.db.getJob(jobId);
        if (job?.synced) {
          await this.db.deleteJob(jobId);
          this.failedDeleteJobIds.delete(jobId);
          cleaned += 1;
        } else if (!job) {
          // Job already deleted, remove from tracking
          this.failedDeleteJobIds.delete(jobId);
          cleaned += 1;
        }
      } catch (error) {
        failed += 1;
        this.log.debug("[JobQueue] cleanupOrphanedSyncedJobs delete retry failed", {
          jobId,
          error,
        });
      }
    }

    // Reset counter after cleanup attempt
    this.failedDeleteCount = 0;

    // Persist the updated set
    await this.persistFailedDeleteIds();

    if (cleaned > 0 || failed > 0) {
      this.analytics.privateEvent("job_queue_orphan_cleanup", {
        cleaned,
        failed,
        remaining: this.failedDeleteJobIds.size,
      });
    }

    return { cleaned, failed };
  }
}
