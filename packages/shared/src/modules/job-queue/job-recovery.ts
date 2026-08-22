/**
 * Explicit recovery for a job that never reached the chain.
 *
 * Both acts are the member's choice from a surface that names the job; nothing
 * here runs on a timer. A synced job is never touched: its record is the
 * receipt for something that already happened.
 *
 * @module modules/job-queue/job-recovery
 */

import { jobQueueDB } from "./db";
import { jobQueueEventBus } from "./event-bus";

/**
 * Give a job that gave up another run of attempts. The record keeps its
 * payload and identity, so a retry is the same act, not a second one; only
 * the count and the last error are cleared, and the next flush picks it up.
 */
export async function retryQueuedJob(jobId: string): Promise<void> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job || job.synced) return;
  const { lastError: _lastError, ...rest } = job;
  await jobQueueDB.updateJob({
    ...rest,
    attempts: 0,
    meta: { ...(job.meta ?? {}), waitingForDependency: false },
  });
  jobQueueEventBus.emit("job:added", { jobId, job: { ...rest, attempts: 0 } });
}

/**
 * Remove a job that never reached the chain, after an explicit choice. Only
 * the local record goes; nothing remote exists yet.
 */
export async function discardQueuedJob(jobId: string): Promise<void> {
  const job = await jobQueueDB.getJob(jobId);
  if (!job || job.synced) return;
  await jobQueueDB.deleteJob(jobId);
  jobQueueEventBus.emit("job:failed", { jobId, job, error: "discarded" });
}
