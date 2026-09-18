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
import type { WorkLinkJobPayload } from "../commitment-pooling/jobs";
import { forgetWorkBroadcast, retainedWorkBroadcast } from "../work/work-confirmation";
import type { JobQueueEvents, JobQueueStore } from "./ports";
import { hasRecordedSend } from "./queue-policy";

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
  events: Pick<JobQueueEvents, "emit">
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

    async discardJob(jobId: string): Promise<boolean> {
      const job = await store.getJob(jobId);
      if (!job || !isDiscardableJob(job)) return false;
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
      await store.deleteJob(jobId);
      events.emit("job:failed", { jobId, job, error: "discarded" });
      return true;
    },
  };
}
