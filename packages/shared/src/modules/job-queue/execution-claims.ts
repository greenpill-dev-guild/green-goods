/**
 * Execution claims, read from the side.
 *
 * `processJob` takes a job's execution claim for the whole send (through
 * `acquireWorkJobs`), whoever started it: a tap, a background flush, or
 * another tab. Recovery reads the same claim so it never discards a job whose
 * send may still broadcast.
 *
 * @module modules/job-queue/execution-claims
 */

import { jobQueueDB } from "./db";

/** Whether a send holds this job's execution claim now; an expired claim does not count. */
export async function hasActiveExecutionClaim(jobId: string): Promise<boolean> {
  const db = await jobQueueDB.init();
  const claim = await db.execution_claims.get(jobId);
  return Boolean(claim && claim.expiresAt > Date.now());
}
