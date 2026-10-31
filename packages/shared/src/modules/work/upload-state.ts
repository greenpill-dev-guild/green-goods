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
  | { status: "ready" | "photo-pending"; checkedAt: string }
  /** `photo` names one that cannot be published, when that is what needs attention. */
  | { status: "photo-needs-attention"; photo?: string; checkedAt: string }
  | { status: "blocked"; reason: string; checkedAt: string };

export type QueuedUploadState =
  /** Sent: its receipt, or the check for a lost answer, settles it. */
  | "sent"
  /** Sent and reverted: the person tries it again by hand. */
  | "reverted"
  /** It used up its retries: the person tries it again or discards it. */
  | "failed"
  /** A work for a promise this account is still taking up: it goes once the take-up lands. */
  | "take-up-pending"
  /** That take-up gave up: the person sends it again or discards it. */
  | "take-up-failed"
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
  /** Why a blocked item cannot be sent. */
  reason?: string;
  /** The photo that needs attention, by file name, when one is named. */
  photo?: string;
}

// Each kind here needs an entry in upload-kinds.ts, which says how it is prepared
// and what it becomes. That module loads with the upload; this one ships in the shell.
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
      return { status: preparation.status, checkedAt: preparation.checkedAt };
    case "photo-needs-attention": {
      const { photo } = preparation as { photo?: unknown };
      return {
        status: preparation.status,
        ...(typeof photo === "string" ? { photo } : {}),
        checkedAt: preparation.checkedAt,
      };
    }
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

/**
 * Where a queued item stands. `takeUp` is the claim a work waits on, when the same tap took its
 * promise up (`take-up-hold`); the caller reads it from the jobs it already holds.
 */
export function queuedUploadStatus(
  job: Job,
  options: { takeUp?: Job | null } = {}
): QueuedUploadStatus {
  if (
    job.meta?.workTransactionReverted ||
    (job.kind === "work" && (job.payload as WorkJobPayload).uploadCheckpoint?.transactionReverted)
  )
    return { state: "reverted" };
  if (hasRecordedSend(job)) return { state: "sent" };
  if (isTerminallyFailedJob(job)) return { state: "failed" };
  // However far it was prepared, a work goes only after the take-up of its promise.
  if (options.takeUp)
    return { state: isTerminallyFailedJob(options.takeUp) ? "take-up-failed" : "take-up-pending" };

  const preparation = uploadPreparationOf(job);
  // A send attempt's own wait outranks an older preparation answer.
  const waiting = job.meta?.waitingReason;
  if (waiting === "photo-conversion-pending") return { state: "photo-pending" };
  if (waiting === "photo-needs-attention") return { state: "photo-needs-attention" };
  if (!preparation) return { state: "preparing" };
  if (preparation.status === "blocked") return { state: "blocked", reason: preparation.reason };
  if (preparation.status === "photo-needs-attention" && preparation.photo)
    return { state: preparation.status, photo: preparation.photo };
  return { state: preparation.status };
}
