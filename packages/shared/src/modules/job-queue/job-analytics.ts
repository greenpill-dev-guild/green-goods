import type { Job, WorkJobPayload } from "../../types/job-queue";
import { getStorageQuota } from "../../utils/storage/quota";
import { addBreadcrumb } from "../app/error-tracking";
import { logger } from "../app/logger";
import { track } from "../app/posthog";
import { getIpfsInitStatus } from "../data/ipfs";

const PRIVATE_QUEUE_EVENT_OPTIONS = { includeSessionId: false } as const;

export function trackPrivateQueueEvent(event: string, properties: Record<string, unknown>): void {
  track(event, properties, PRIVATE_QUEUE_EVENT_OPTIONS);
}

/**
 * Track a job being created in the queue.
 */
export function trackJobCreated(kind: string, isOnline: boolean, chainId: number): void {
  addBreadcrumb("job_created", {
    job_kind: kind,
    is_online: isOnline,
  });

  track(
    "offline_job_created",
    {
      job_kind: kind,
      is_online: isOnline,
      chain_id: chainId,
      will_process_immediately: false,
    },
    PRIVATE_QUEUE_EVENT_OPTIONS
  );
}

/**
 * Track a job processing error (may be retried).
 */
export async function trackJobProcessingError(
  job: Job,
  processingDuration: number,
  chainId: number,
  maxRetries: number
): Promise<void> {
  // Get IPFS status for debugging upload failures
  const ipfsStatus = getIpfsInitStatus();

  // Get storage quota for debugging storage-related failures
  const storageQuota = await getStorageQuota();

  track(
    "offline_job_failed",
    {
      job_kind: job.kind,
      attempts: job.attempts + 1,
      max_retries: maxRetries,
      will_retry: job.attempts + 1 < maxRetries,
      processing_duration_ms: processingDuration,
      chain_id: chainId,
      action_uid: (job.payload as WorkJobPayload)?.actionUID,
      ipfs_status: ipfsStatus.status,
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
    },
    PRIVATE_QUEUE_EVENT_OPTIONS
  );
}

/**
 * Track a job that has permanently failed (max retries exceeded).
 */
export function trackJobPermanentlyFailed(job: Job): void {
  const ipfsStatus = getIpfsInitStatus();

  track(
    "offline_job_permanently_failed",
    {
      job_kind: job.kind,
      attempts: job.attempts,
      action_uid: (job.payload as WorkJobPayload)?.actionUID,
      ipfs_status: ipfsStatus.status,
      ipfs_client_ready: ipfsStatus.clientReady,
    },
    PRIVATE_QUEUE_EVENT_OPTIONS
  );
}

/**
 * Track a successfully processed job.
 */
export function trackJobProcessed(kind: string, processingTimeMs: number, attempts: number): void {
  track(
    "offline_job_processed",
    {
      job_kind: kind,
      processing_time_ms: processingTimeMs,
      attempts,
    },
    PRIVATE_QUEUE_EVENT_OPTIONS
  );
}

/**
 * Track storage quota warnings (low or critical) during job creation.
 */
export function trackStorageWarning(
  kind: string,
  storageQuota: Awaited<ReturnType<typeof getStorageQuota>>,
  isOnline: boolean
): void {
  if (storageQuota.isCritical) {
    track(
      "job_queue_storage_critical",
      {
        job_kind: kind,
        storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
        storage_used_mb: Math.round(storageQuota.used / (1024 * 1024)),
        storage_quota_mb: Math.round(storageQuota.quota / (1024 * 1024)),
        is_online: isOnline,
      },
      PRIVATE_QUEUE_EVENT_OPTIONS
    );

    addBreadcrumb("storage_critical_on_job_add", {
      job_kind: kind,
      percent_used: storageQuota.percentUsed,
    });

    logger.warn(
      `[JobQueue] Storage critically low (${Math.round(storageQuota.percentUsed)}% used). Job may fail to persist.`
    );
  } else if (storageQuota.isLow) {
    track(
      "job_queue_storage_low",
      {
        job_kind: kind,
        storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
        is_online: isOnline,
      },
      PRIVATE_QUEUE_EVENT_OPTIONS
    );

    addBreadcrumb("storage_low_on_job_add", {
      job_kind: kind,
      percent_used: storageQuota.percentUsed,
    });
  }
}
