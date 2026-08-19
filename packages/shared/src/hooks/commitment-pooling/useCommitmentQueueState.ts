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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

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
  /** Which commitments those failures belong to, so a surface can name them. */
  failedCommitmentIds: ReadonlySet<string>;
  /** True while a new commitment is still waiting to be placed. */
  hasPendingCreate: boolean;
  /**
   * The queue could not be read. Distinct from "nothing is queued": a surface
   * that treats a failed read as an empty queue re-enables an act already
   * taken and reports no failures when it cannot see any.
   */
  isUnavailable: boolean;
  refresh: () => void;
}

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
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["greengoods", "commitment-pooling", "queue", viewer?.toLowerCase() ?? null] as const,
    [viewer]
  );

  // One query per reader rather than one per mount. Home, the sheet and the
  // detail screen all ask, and react-query serves them from a single read
  // instead of three scans of the whole queue on every job event.
  const query = useQuery({
    queryKey,
    enabled: Boolean(viewer),
    queryFn: async () => {
      const all = await jobQueueDB.getJobs({ userAddress: viewer as string });
      return all.filter((job) => COMMITMENT_JOB_KINDS.includes(job.kind as never));
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  useJobQueueEvents(["job:added", "job:completed", "job:failed"], refresh, [refresh]);

  return useMemo(() => {
    const jobs: Job[] = query.data ?? [];
    const pendingCommitmentIds = new Set<string>();
    const failedCommitmentIds = new Set<string>();
    let failedCount = 0;
    let hasPendingCreate = false;

    for (const job of jobs) {
      if (job.synced) continue;
      const commitmentId = commitmentIdOf(job);
      if (isTerminallyFailedJob(job)) {
        failedCount += 1;
        if (commitmentId) failedCommitmentIds.add(commitmentId);
        continue;
      }
      if (commitmentId) pendingCommitmentIds.add(commitmentId);
      else if (job.kind === "commitment") hasPendingCreate = true;
    }

    return {
      pendingCommitmentIds,
      failedCount,
      failedCommitmentIds,
      hasPendingCreate,
      isUnavailable: Boolean(viewer) && query.isError,
      refresh,
    };
  }, [query.data, query.isError, viewer, refresh]);
}
