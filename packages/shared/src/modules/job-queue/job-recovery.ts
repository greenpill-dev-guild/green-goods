/**
 * Explicit recovery for a job that never reached the chain.
 *
 * Both acts are the member's choice from a surface that names the job; nothing
 * here runs on a timer. A synced job is never touched: its record is the
 * receipt for something that already happened.
 *
 * @module modules/job-queue/job-recovery
 */

import type { Job } from "../../types/job-queue";
import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";

/**
 * Whether a job may be thrown away.
 *
 * A job that carries a broadcast transaction hash may already exist on chain:
 * the send returned but the receipt never landed, and the record is the only
 * local trace of it. Deleting that record loses the creation request key with
 * it, so composing again would file a second commitment once the first
 * materializes. Such a job stays retryable and is never discardable.
 */
export function isDiscardableJob(job: Pick<Job, "synced" | "meta">): boolean {
  if (job.synced) return false;
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
 * after the outage it exists to recover from.
 */
export async function retryQueuedJob(jobId: string): Promise<void> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job || job.synced) return;
  const { lastError: _lastError, ...rest } = job;
  const {
    metadataAttempts: _metadataAttempts,
    evidenceAttempts: _evidenceAttempts,
    waitingReason: _waitingReason,
    ...meta
  } = job.meta ?? {};
  const retried = { ...rest, attempts: 0, meta: { ...meta, waitingForDependency: false } };
  await jobQueueDB.updateJob(retried);
  jobQueueEventBus.emit("job:added", { jobId, job: retried });
}

/**
 * Remove a job that never reached the chain, after an explicit choice. Only
 * the local record goes; nothing remote exists yet.
 *
 * Returns false without deleting anything when the job may already be on
 * chain, so a caller that offered the choice too eagerly cannot destroy the
 * receipt.
 */
export async function discardQueuedJob(jobId: string): Promise<boolean> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job || !isDiscardableJob(job)) return false;
  await jobQueueDB.deleteJob(jobId);
  jobQueueEventBus.emit("job:failed", { jobId, job, error: "discarded" });
  return true;
}
