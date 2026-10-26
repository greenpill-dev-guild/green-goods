/**
 * A work for a promise taken up in the same tap (PWA Home decision 18, DL-131)
 *
 * Taking up an Open ask while logging work for it queues three acts: the claim that takes the
 * ask up, the work, and the work's link to the ask (the queue's own `workLink` job, admitted in
 * the same write as the work). The link already waits for its work. The work waits for its
 * claim: sent while the account is still taking the promise up, it would land unlinked and its
 * link would be refused.
 *
 * Each act keeps its own payload, and the chain is read from them rather than stored beside
 * them: a work's promise is the one its sealed link names, and its take-up is this account's
 * claim of that promise still on this phone, on the same chain. A claim that landed has left the
 * queue, so nothing has to be cleared when it does.
 *
 * @module modules/job-queue/take-up-hold
 */

import type { ClaimJobPayload } from "../commitment-pooling/job-types";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { JobQueueStore } from "./ports";

/** What a held work's send answers, without spending an attempt. */
export const TAKE_UP_PENDING = "take-up-pending";

/** The promise a queued work is linked to, as its sealed link names it. */
function linkedPromise(work: Pick<Job, "kind" | "payload">): string | null {
  if (work.kind !== "work") return null;
  const link = (work.payload as WorkJobPayload | undefined)?.dependentWorkLink;
  return link ? String(link.commitmentId) : null;
}

/** Whether this claim takes up the promise the work is for, for its account on its chain. */
export function isTakeUpOf(claim: Job, work: Job): boolean {
  const promise = linkedPromise(work);
  return (
    promise !== null &&
    claim.kind === "claim" &&
    !claim.synced &&
    claim.userAddress.toLowerCase() === work.userAddress.toLowerCase() &&
    (claim.chainId ?? null) === (work.chainId ?? null) &&
    String((claim.payload as ClaimJobPayload).commitmentId) === promise
  );
}

/** The take-up a queued work waits on, among the jobs on this phone; null when there is none. */
export function takeUpOf(work: Job, jobs: readonly Job[]): Job | null {
  if (linkedPromise(work) === null) return null;
  return jobs.find((job) => isTakeUpOf(job, work)) ?? null;
}

/** The same, read from the queue's store. */
export async function findTakeUpOf(
  work: Job,
  store: Pick<JobQueueStore, "getJobs">
): Promise<Job | null> {
  if (linkedPromise(work) === null) return null;
  const claims = await store.getJobs({
    userAddress: work.userAddress,
    kind: "claim",
    synced: false,
  });
  return takeUpOf(work, claims);
}
