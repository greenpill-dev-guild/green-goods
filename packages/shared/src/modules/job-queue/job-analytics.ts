import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { UploadPreparationEvent } from "../work/upload-preparation";
import { parseContractError } from "../../utils/errors/contract-errors";
import { getStorageQuota } from "../../utils/storage/quota";
import { addBreadcrumb } from "../app/error-tracking";
import { logger } from "../app/logger";
import { track } from "../app/posthog";
import { getIpfsInitStatus } from "../data/ipfs/client";

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
  maxRetries: number,
  error: unknown
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
      // A fixed family name, never the raw message: messages can carry addresses.
      parsed_error_family: parseContractError(error).name,
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
      parsed_error_family: job.lastError ? parseContractError(job.lastError).name : undefined,
      action_uid: (job.payload as WorkJobPayload)?.actionUID,
      ipfs_status: ipfsStatus.status,
      ipfs_client_ready: ipfsStatus.clientReady,
    },
    PRIVATE_QUEUE_EVENT_OPTIONS
  );
}

/**
 * Track one try of background preparation: when it starts, how it ends, and the wait before it
 * runs again. The kind, the try's number and its timing tell a work that keeps failing from one
 * that is slow; nothing names the work, what it holds, or whose it is.
 */
export function trackUploadPreparation(event: UploadPreparationEvent): void {
  const tried = { job_kind: event.kind, attempt: event.attempt };
  switch (event.type) {
    case "started":
      trackPrivateQueueEvent("upload_preparation_started", tried);
      return;
    case "finished":
      trackPrivateQueueEvent("upload_preparation_finished", {
        ...tried,
        result: event.result,
        duration_ms: event.durationMs,
        ...(event.reason ? { blocked_reason: event.reason } : {}),
      });
      return;
    case "retry-scheduled":
      trackPrivateQueueEvent("upload_preparation_retry_scheduled", {
        ...tried,
        delay_ms: event.delayMs,
      });
  }
}

/**
 * A reason in the queue's code form, such as `awaiting-confirmation`, and `other` for anything
 * else: a reason can come from an error, and a message may carry an address or an id.
 */
function queueReasonCode(reason: string): string {
  if (reason.startsWith("backoff_")) return "backoff";
  return reason.length <= 48 && /^[a-z]+(?:[-_][a-z]+)*$/.test(reason) ? reason : "other";
}

/**
 * Track a try starting, before any prompt: a send the page never finishes, such as one whose
 * page was suspended while a wallet signed, still leaves its start (PRD-1495).
 */
export function trackJobStarted(
  kind: string,
  attempt: number,
  context: { explicit: boolean; confirming: boolean }
): void {
  addBreadcrumb("job_processing_started", { job_kind: kind, attempt });
  trackPrivateQueueEvent("offline_job_started", {
    job_kind: kind,
    attempt,
    explicit: context.explicit,
    confirming: context.confirming,
  });
}

/** Track a try that ended with nothing sent and no answer, or a tap the queue could not act on. */
export function trackJobSkipped(
  kind: string,
  reason: string,
  context: { explicit: boolean; started: boolean }
): void {
  trackPrivateQueueEvent("offline_job_skipped", {
    job_kind: kind,
    reason: queueReasonCode(reason),
    explicit: context.explicit,
    started: context.started,
  });
}

/**
 * Makes a record without letting it change what the person's action did. A mutation callback
 * that throws stops a send before it starts or turns a finished one into a failure, so a record
 * that fails is logged and dropped, as `track` does when its transport throws.
 */
export function recordBestEffort(record: () => void): void {
  try {
    record();
  } catch (error) {
    logger.warn("[Telemetry] A record could not be made", { error: String(error) });
  }
}

type QueuedUploadScope = "all" | "selected";

/** Track an Upload all or Upload now tap, before anything is signed. */
export function trackQueuedUploadStarted(event: {
  scope: QueuedUploadScope;
  itemCount: number;
  authMode?: string;
}): void {
  trackPrivateQueueEvent("queued_upload_started", {
    scope: event.scope,
    item_count: event.itemCount,
    auth_mode: event.authMode,
  });
}

/** Track how that tap ended, including every ending that sends nothing. */
export function trackQueuedUploadFinished(event: {
  scope: QueuedUploadScope;
  status: string;
  sent: number;
  flagged: number;
  durationMs: number;
  authMode?: string;
  error?: unknown;
}): void {
  trackPrivateQueueEvent("queued_upload_finished", {
    scope: event.scope,
    status: event.status,
    sent: event.sent,
    flagged: event.flagged,
    duration_ms: event.durationMs,
    auth_mode: event.authMode,
    // A fixed family name, never the raw message: messages can carry addresses.
    ...(event.error === undefined
      ? {}
      : { parsed_error_family: parseContractError(event.error).name }),
  });
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
