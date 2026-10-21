import { queuedUploadStatus } from "./upload-state";
import type { Work, WorkDisplayStatus } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { ZERO_ADDRESS } from "../../utils/blockchain/address-constants";

/**
 * Where a queued work stands, as the work card and dashboard read it: sent
 * and confirming, or waiting for Upload all, with the reason when the chain
 * would refuse it.
 */
function queuedSubmissionState(job: Job<WorkJobPayload>): {
  submissionState: string;
  blockedReason?: string;
} {
  const upload = queuedUploadStatus(job);
  switch (upload.state) {
    case "sent": {
      const checkpoint = job.payload.uploadCheckpoint;
      return {
        submissionState:
          checkpoint?.broadcast || checkpoint?.transactionHash
            ? "awaiting-confirmation"
            : "checking-submission",
      };
    }
    case "failed":
      return { submissionState: "retry-required" };
    case "blocked":
      return { submissionState: "blocked", blockedReason: upload.reason };
    default:
      return { submissionState: upload.state };
  }
}

// Helper function to convert job payload to Work model
export function jobToWork(job: Job<WorkJobPayload>): Work {
  const checkpoint = job.payload.uploadCheckpoint;
  const awaiting = Boolean(
    checkpoint?.broadcast || checkpoint?.transactionHash || checkpoint?.broadcastPending
  );
  const failed = Boolean(
    job.meta?.workTransactionReverted ||
      checkpoint?.transactionReverted ||
      (job.lastError && !awaiting)
  );
  return {
    id: job.id, // Use job ID as temporary work ID
    title: job.payload.title || `Action ${job.payload.actionUID}`,
    actionUID: job.payload.actionUID,
    gardenerAddress: job.userAddress ?? ZERO_ADDRESS, // Unresolved offline; hydration overwrites with the active address
    gardenAddress: job.payload.gardenAddress,
    feedback: job.payload.feedback,
    metadata: JSON.stringify({
      clientWorkId: job.payload.clientWorkId,
      ...queuedSubmissionState(job),
      details: job.payload.details,
      timeSpentMinutes: job.payload.timeSpentMinutes,
      tags: job.payload.tags,
    }),
    media: [], // Media will be loaded separately for offline jobs
    createdAt: Math.floor(job.createdAt / 1000), // Convert ms (Date.now()) to seconds (EAS format)
    status: (job.synced
      ? "pending" // Synced but awaiting on-chain approval
      : failed
        ? "sync_failed" // Failed to sync to chain
        : "offline") as WorkDisplayStatus, // Admitted locally; a processing event confirms actual sending
  };
}
