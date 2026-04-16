import type { Job, WorkJobPayload } from "../../types/job-queue";
import { getStorageQuota } from "../../utils/storage/quota";
import { addBreadcrumb, getBreadcrumbs, trackSyncError } from "../app/error-tracking";
import { logger } from "../app/logger";
import { track } from "../app/posthog";
import { getIpfsInitStatus } from "../data/ipfs";

/**
 * Track a job being created in the queue.
 */
export function trackJobCreated(
  jobId: string,
  kind: string,
  isOnline: boolean,
  chainId: number,
  userAddress: string
): void {
  addBreadcrumb("job_created", {
    job_id: jobId,
    job_kind: kind,
    is_online: isOnline,
  });

  track("offline_job_created", {
    job_id: jobId,
    job_kind: kind,
    is_online: isOnline,
    chain_id: chainId,
    user_address: userAddress,
    will_process_immediately: false,
  });
}

/**
 * Track a job processing error (may be retried).
 */
export async function trackJobProcessingError(
  jobId: string,
  job: Job,
  error: unknown,
  processingDuration: number,
  chainId: number,
  maxRetries: number
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  // Get IPFS status for debugging upload failures
  const ipfsStatus = getIpfsInitStatus();

  // Get storage quota for debugging storage-related failures
  const storageQuota = await getStorageQuota();

  // Track as structured exception for PostHog error dashboard
  trackSyncError(error, {
    source: "JobQueue.processJob",
    userAction: `processing ${job.kind} job`,
    recoverable: job.attempts + 1 < maxRetries,
    metadata: {
      job_id: jobId,
      job_kind: job.kind,
      attempts: job.attempts + 1,
      max_retries: maxRetries,
      will_retry: job.attempts + 1 < maxRetries,
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
    will_retry: job.attempts + 1 < maxRetries,
    processing_duration_ms: processingDuration,
    ipfs_status: ipfsStatus.status,
    ipfs_client_ready: ipfsStatus.clientReady,
  });
}

/**
 * Track a job that has permanently failed (max retries exceeded).
 */
export function trackJobPermanentlyFailed(jobId: string, job: Job): void {
  const ipfsStatus = getIpfsInitStatus();

  trackSyncError(new Error(`Max retries exceeded`), {
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
}

/**
 * Track a successfully processed job.
 */
export function trackJobProcessed(
  jobId: string,
  kind: string,
  processingTimeMs: number,
  attempts: number,
  txHash: string
): void {
  track("offline_job_processed", {
    job_id: jobId,
    job_kind: kind,
    processing_time_ms: processingTimeMs,
    attempts,
    tx_hash: txHash,
  });
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
    track("job_queue_storage_critical", {
      job_kind: kind,
      storage_percent_used: Math.round(storageQuota.percentUsed * 10) / 10,
      storage_used_mb: Math.round(storageQuota.used / (1024 * 1024)),
      storage_quota_mb: Math.round(storageQuota.quota / (1024 * 1024)),
      is_online: isOnline,
    });

    addBreadcrumb("storage_critical_on_job_add", {
      job_kind: kind,
      percent_used: storageQuota.percentUsed,
    });

    logger.warn(
      `[JobQueue] Storage critically low (${Math.round(storageQuota.percentUsed)}% used). Job may fail to persist.`
    );
  } else if (storageQuota.isLow) {
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
}
