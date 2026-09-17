/**
 * Where a queued work or decision stands for Upload all
 *
 * Background preparation checks each queued item once the connection is
 * confirmed: its photos converted, its uploads saved, and the chain's answer
 * simulated. It records what it found on the job. Upload all sends only the
 * items that are ready; every other item says why it is waiting.
 *
 * @module modules/work/upload-state
 */

import type { Job, WorkJobPayload } from "../../types/job-queue";
import { hasRecordedSend, isTerminallyFailedJob } from "../job-queue/queue-policy";

/** What background preparation last found for a queued item. */
export type UploadPreparation =
  | { status: "ready"; checkedAt: string }
  | { status: "photo-pending" | "photo-needs-attention"; checkedAt: string }
  | { status: "blocked"; reason: string; checkedAt: string };

export type QueuedUploadState =
  /** Sent: its receipt, or the check for a lost answer, settles it. */
  | "sent"
  /** Sent and reverted: the person tries it again by hand. */
  | "reverted"
  /** It used up its retries: the person tries it again or discards it. */
  | "failed"
  /** A HEIC photo is waiting for the decoder. */
  | "photo-pending"
  /** A photo could not be converted. */
  | "photo-needs-attention"
  /** The chain would refuse it now, for the recorded reason. */
  | "blocked"
  /** Prepared: Upload all sends it. */
  | "ready"
  /** Not prepared yet. */
  | "preparing";

export interface QueuedUploadStatus {
  state: QueuedUploadState;
  /** The person declined its last prompt; it still waits for their upload. */
  declined: boolean;
  /** Why a blocked item cannot be sent. */
  reason?: string;
}

const UPLOAD_JOB_KINDS: ReadonlySet<string> = new Set(["work", "approval"]);

/** Work and decisions go out through Upload all; commitment acts send on their own. */
export function isUploadJob(job: Pick<Job, "kind">): boolean {
  return UPLOAD_JOB_KINDS.has(job.kind);
}

/** The preparation recorded on a job, when it has a shape this build understands. */
export function uploadPreparationOf(job: Pick<Job, "meta">): UploadPreparation | undefined {
  const preparation = job.meta?.preparation as Partial<UploadPreparation> | undefined;
  if (!preparation || typeof preparation.checkedAt !== "string") return undefined;
  switch (preparation.status) {
    case "ready":
    case "photo-pending":
    case "photo-needs-attention":
      return { status: preparation.status, checkedAt: preparation.checkedAt };
    case "blocked":
      return typeof (preparation as { reason?: unknown }).reason === "string"
        ? {
            status: "blocked",
            reason: (preparation as { reason: string }).reason,
            checkedAt: preparation.checkedAt,
          }
        : undefined;
    default:
      return undefined;
  }
}

export function queuedUploadStatus(job: Job): QueuedUploadStatus {
  const declined = job.meta?.requiresExplicitSend === true;
  if (
    job.meta?.workTransactionReverted ||
    (job.kind === "work" && (job.payload as WorkJobPayload).uploadCheckpoint?.transactionReverted)
  )
    return { state: "reverted", declined };
  if (hasRecordedSend(job)) return { state: "sent", declined };
  if (isTerminallyFailedJob(job)) return { state: "failed", declined };

  const preparation = uploadPreparationOf(job);
  // A send attempt's own wait outranks an older preparation answer.
  const waiting = job.meta?.waitingReason;
  if (waiting === "photo-conversion-pending") return { state: "photo-pending", declined };
  if (waiting === "photo-needs-attention") return { state: "photo-needs-attention", declined };
  if (!preparation) return { state: "preparing", declined };
  if (preparation.status === "blocked")
    return { state: "blocked", declined, reason: preparation.reason };
  return { state: preparation.status, declined };
}
