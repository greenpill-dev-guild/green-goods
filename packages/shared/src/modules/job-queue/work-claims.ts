/**
 * Claims for preparing and uploading queued work
 *
 * Preparation and Upload all both work through queued jobs that another tab,
 * or the queue's own confirmation pass, may be handling at the same time. A
 * claim names one holder per job. These helpers claim whichever jobs are free,
 * keep a claim alive through a long upload, and save a job only while the claim
 * is still this holder's.
 *
 * @module modules/job-queue/work-claims
 */

import type { Job } from "../../types/job-queue";
import { acquireWorkJobs } from "../work/work-confirmation";
import { CLAIM_TTL_MS, jobQueueDB } from "./db";

export type WorkClaim = NonNullable<Awaited<ReturnType<typeof acquireWorkJobs>>>;

/** Renewals run well inside a claim's lifetime. */
const HOLD_INTERVAL_MS = 20_000;

/** Claim whichever of these jobs are free, one by one, so one busy job never blocks the rest. */
export async function acquireAvailableWorkJobs(ids: string[]): Promise<Map<string, WorkClaim>> {
  const claims = new Map<string, WorkClaim>();
  try {
    for (const id of ids) {
      const claim = await acquireWorkJobs([id]);
      if (claim) claims.set(id, claim);
    }
  } catch (error) {
    // The caller never receives this map, so nothing else can release what it
    // already holds: those jobs would stay claimed until the claim expires.
    await releaseWorkClaims(claims.values());
    throw error;
  }
  return claims;
}

export async function releaseWorkClaims(claims: Iterable<WorkClaim>): Promise<void> {
  await Promise.allSettled([...claims].map((claim) => claim.release()));
}

/**
 * Keep claims alive while a long upload runs, so no other holder can take a
 * job halfway through. Returns a stop function. A lost claim is found by the
 * holder's next save, which refuses.
 */
export function holdWorkClaims(
  claims: Iterable<WorkClaim>,
  intervalMs: number = HOLD_INTERVAL_MS
): () => void {
  const held = [...claims];
  const timer = setInterval(() => {
    void Promise.allSettled(held.map((claim) => claim.assertOwned()));
  }, intervalMs);
  return () => clearInterval(timer);
}

/**
 * Change one claimed job inside a transaction that first proves the claim is
 * still this holder's. A tab the OS froze past the claim's lifetime therefore
 * cannot overwrite a send another tab recorded meanwhile. The stored record is
 * amended in place: its payload keeps the form storage gave it.
 */
export async function saveUnderClaim(
  claim: Pick<WorkClaim, "token">,
  jobId: string,
  amend: (stored: Job) => void
): Promise<void> {
  const db = await jobQueueDB.init();
  await db.transaction("rw", [db.jobs, db.execution_claims], async () => {
    const held = await db.execution_claims.get(jobId);
    const stored = await db.jobs.get(jobId);
    if (held?.token !== claim.token || !stored) throw new Error("submission-ownership-changed");
    amend(stored);
    await db.jobs.put(stored);
    await db.execution_claims.put({
      id: jobId,
      token: claim.token,
      expiresAt: Date.now() + CLAIM_TTL_MS,
    });
  });
}
