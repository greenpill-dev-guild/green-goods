/**
 * Explicit recovery for a job that never reached the chain.
 *
 * Both acts are the member's choice from a surface that names the job; nothing
 * here runs on a timer. A synced job is never touched: its record is the
 * receipt for something that already happened.
 *
 * @module modules/job-queue/job-recovery
 */

import type { Job, WorkJobPayload } from "../../types/job-queue";
import { commitmentJobPrerequisite, type WorkLinkJobPayload } from "../commitment-pooling/jobs";
import { forgetWorkBroadcast, retainedWorkBroadcast } from "../work/work-confirmation";
import type { JobQueueEvents, JobQueueExecutionClaims, JobQueueStore } from "./ports";
import { hasRecordedSend, JOB_DISCARDED } from "./queue-policy";

/**
 * Whether a job may be thrown away.
 *
 * A job that carries a broadcast transaction hash may already exist on chain:
 * the send returned but the receipt never landed, and the record is the only
 * local trace of it. Deleting that record loses the creation request key with
 * it, so composing again would file a second commitment once the first
 * materializes. Such a job stays retryable and is never discardable.
 *
 * A send whose checkpoint write failed is held only in memory, so that is
 * checked too: it is the same send, and it is the only trace left of it.
 */
export function isDiscardableJob(
  job: Pick<Job, "synced" | "meta"> & Partial<Pick<Job, "kind" | "payload" | "id">>
): boolean {
  if (job.synced) return false;
  if (job.id && retainedWorkBroadcast(job.id)) return false;
  if (job.kind && job.payload && hasRecordedSend(job as Job)) return false;
  return typeof job.meta?.submittedTxHash !== "string";
}

/**
 * Give a job that gave up another run of attempts. The record keeps its
 * payload and identity, so a retry is the same act, not a second one.
 *
 * Every counter that can end a job is cleared together. The generic `attempts`
 * is not the only ceiling: the metadata and evidence publishers count their own
 * gateway failures, and leaving those at the limit means the next upload
 * failure terminates the job immediately, so Retry would grant no real window
 * after the outage it exists to recover from. Queued photo conversion and the
 * last preparation answer are cleared too, so a work or decision that needed
 * attention is prepared again from the start.
 */
export function createJobRecovery(
  store: Pick<JobQueueStore, "getJob" | "amendJob" | "deleteJob"> &
    Partial<Pick<JobQueueStore, "getJobs" | "markJobTerminalFailed">>,
  events: Pick<JobQueueEvents, "emit">,
  claims?: JobQueueExecutionClaims
) {
  return {
    async retryJob(jobId: string): Promise<void> {
      let retried: Job | undefined;
      // Read and written as one step. A retry takes no claim, so a plain read
      // followed by a write could land over a send another holder had just
      // recorded, and the job would read as unsent while it was in flight.
      await store.amendJob(jobId, (job) => {
        if (job.synced) return;
        const {
          metadataAttempts: _metadataAttempts,
          evidenceAttempts: _evidenceAttempts,
          waitingReason: _waitingReason,
          mediaConversion: _mediaConversion,
          preparation: _preparation,
          ...meta
        } = job.meta ?? {};
        if (job.kind === "work" && meta.workTransactionReverted) {
          const payload = job.payload as WorkJobPayload;
          if (payload.uploadCheckpoint) {
            delete payload.uploadCheckpoint.transactionHash;
            delete payload.uploadCheckpoint.broadcast;
            delete payload.uploadCheckpoint.broadcastPending;
            delete payload.uploadCheckpoint.transactionReverted;
          }
          delete meta.submittedTxHash;
          delete meta.workTransactionReverted;
          forgetWorkBroadcast(jobId);
        }
        delete job.lastError;
        job.attempts = 0;
        job.meta = { ...meta, waitingForDependency: false };
        retried = job;
      });
      if (retried) events.emit("job:added", { jobId, job: retried });
    },

    async discardJob(jobId: string, beforeDelete?: (job: Job) => Promise<void>): Promise<boolean> {
      // A send holds the job's execution claim for its whole length, whoever
      // started it: a tap, a background flush, or another tab. Taking the
      // claim first makes the check and the delete one held act: a running
      // send refuses the discard, and no send can start until it is done.
      const hold = claims ? await claims.acquire(jobId) : null;
      if (claims && !hold) return false;
      try {
        const job = await store.getJob(jobId);
        if (!job || !isDiscardableJob(job)) return false;
        // What the caller keeps beside the job goes first, inside the same
        // hold. The job is what the person sees, so it goes last: a discard
        // that stops here leaves that one record to discard again.
        await beforeDelete?.(job);
        if (job.kind === "work" && store.getJobs && store.markJobTerminalFailed) {
          const dependents = await store.getJobs({
            userAddress: job.userAddress,
            kind: "workLink",
            synced: false,
          });
          for (const dependent of dependents) {
            const payload = dependent.payload as WorkLinkJobPayload;
            if ("sourceWorkJobId" in payload && payload.sourceWorkJobId === jobId) {
              const error = "identity_conflict:source-work-terminal";
              await store.markJobTerminalFailed(dependent.id, error);
              events.emit("job:failed", { jobId: dependent.id, job: dependent, error });
            }
          }
        }
        // Add and Send's second act goes with its proof. It waited for the proof,
        // so nothing of it was ever sent, and there is nothing left to send after.
        if (job.kind === "evidence" && store.getJobs) {
          const sends = await store.getJobs({
            userAddress: job.userAddress,
            kind: "confirmation",
            synced: false,
          });
          for (const send of sends) {
            if (
              commitmentJobPrerequisite(send.kind, send.payload) === jobId &&
              isDiscardableJob(send)
            ) {
              await store.deleteJob(send.id);
              events.emit("job:failed", { jobId: send.id, job: send, error: JOB_DISCARDED });
            }
          }
        }
        await store.deleteJob(jobId);
        events.emit("job:failed", { jobId, job, error: JOB_DISCARDED });
        return true;
      } finally {
        await hold?.release();
      }
    },
  };
}
