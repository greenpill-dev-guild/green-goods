import { logger } from "../app/logger";
import { track } from "../app/posthog";
import type { jobQueueDB as JobQueueDBType } from "./db";

/** Default interval for orphaned job cleanup (5 minutes) */
export const ORPHAN_CLEANUP_INTERVAL = 5 * 60 * 1000;

/** Threshold for alerting on failed delete count */
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

  /** Interval ID for cleanup scheduler */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Whether failed delete IDs have been rehydrated from IndexedDB */
  private failedDeleteIdsInitialized = false;

  constructor(private db: typeof JobQueueDBType) {}

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
      logger.warn("[JobQueue] Failed to load failed delete IDs from IndexedDB", { error: err });
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
      logger.warn("[JobQueue] Failed to persist failed delete IDs to IndexedDB", { error: err });
    }
  }

  /**
   * Track a failed job deletion for later cleanup retry.
   */
  async trackFailedDelete(jobId: string): Promise<void> {
    this.failedDeleteJobIds.add(jobId);
    this.failedDeleteCount += 1;
    await this.persistFailedDeleteIds();

    logger.warn("[JobQueue] Failed to delete synced job", { jobId });

    if (this.failedDeleteCount >= FAILED_DELETE_ALERT_THRESHOLD) {
      track("job_queue_delete_failures_threshold", {
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
      } catch {
        failed += 1;
      }
    }

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
   */
  startCleanupScheduler(intervalMs: number = ORPHAN_CLEANUP_INTERVAL): void {
    if (this.cleanupIntervalId) {
      return; // Already running
    }

    // Rehydrate failed delete IDs from IndexedDB on startup
    this.initFailedDeleteIds().catch((err) => {
      logger.warn("[JobQueue] Failed to init failed delete IDs", { error: err });
    });

    this.cleanupIntervalId = setInterval(() => {
      if (this.failedDeleteJobIds.size > 0) {
        this.cleanupOrphanedSyncedJobs().catch((err) => {
          logger.warn("[JobQueue] Cleanup scheduler error", { error: err });
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
}
