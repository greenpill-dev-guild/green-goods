/**
 * useCommitmentQueueState Hook
 *
 * What the offline queue currently holds for this member's commitments.
 *
 * Both of the things this replaces were local React state, and both were the
 * wrong shape for the same reason. A flag set when an act is queued never hears
 * that the act landed, so the screen stays suppressed for the component's
 * lifetime. A counter incremented on `job:failed` never resets, is lost on
 * unmount, and double-counts when two components subscribe.
 *
 * The queue already knows all of this and survives both remount and navigation,
 * so it is asked rather than mirrored.
 *
 * @module hooks/commitment-pooling/useCommitmentQueueState
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { jobQueueDB } from "../../modules/job-queue/db";
import { isTerminallyFailedJob } from "../../modules/job-queue/queue-policy";
import { COMMITMENT_JOB_KINDS } from "../../modules/commitment-pooling/jobs";
import type { Job } from "../../types/job-queue";
import type { Address } from "../../types/domain";

export interface CommitmentQueueState {
  /** Commitments with an act queued and still trying. Keyed by decimal id. */
  pendingCommitmentIds: ReadonlySet<string>;
  /** Commitment work that gave up. Terminal jobs never retry on their own. */
  failedCount: number;
  /** True while a new commitment is still waiting to be placed. */
  hasPendingCreate: boolean;
  refresh: () => void;
}

const EMPTY: ReadonlySet<string> = new Set();

/** Only the acts that name a commitment can be attributed to one. */
function commitmentIdOf(job: Job): string | null {
  const payload = job.payload as { commitmentId?: bigint | string } | undefined;
  if (payload?.commitmentId === undefined) return null;
  return String(payload.commitmentId);
}

/**
 * The viewer is passed in rather than resolved here: every caller already knows
 * who is reading, and a second identity source is a second thing that can
 * disagree about it.
 */
export function useCommitmentQueueState(viewer?: Address | null): CommitmentQueueState {
  const [jobs, setJobs] = useState<Job[]>([]);

  const refresh = useCallback(() => {
    if (!viewer) {
      setJobs([]);
      return;
    }
    void jobQueueDB
      .getJobs({ userAddress: viewer })
      .then((all) => setJobs(all.filter((job) => COMMITMENT_JOB_KINDS.includes(job.kind as never))))
      // A queue read that fails leaves the previous answer standing rather than
      // claiming nothing is queued, which would re-enable an act already taken.
      .catch(() => undefined);
  }, [viewer]);

  useEffect(refresh, [refresh]);
  useJobQueueEvents(["job:added", "job:completed", "job:failed"], refresh, [refresh]);

  return useMemo(() => {
    if (!viewer) {
      return { pendingCommitmentIds: EMPTY, failedCount: 0, hasPendingCreate: false, refresh };
    }
    const pendingCommitmentIds = new Set<string>();
    let failedCount = 0;
    let hasPendingCreate = false;

    for (const job of jobs) {
      if (job.synced) continue;
      if (isTerminallyFailedJob(job)) {
        failedCount += 1;
        continue;
      }
      const commitmentId = commitmentIdOf(job);
      if (commitmentId) pendingCommitmentIds.add(commitmentId);
      else if (job.kind === "commitment") hasPendingCreate = true;
    }

    return { pendingCommitmentIds, failedCount, hasPendingCreate, refresh };
  }, [jobs, viewer, refresh]);
}
