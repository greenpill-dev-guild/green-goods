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

import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { isDiscardableJob } from "../../modules/job-queue/job-recovery";
import { isTerminallyFailedJob } from "../../modules/job-queue/queue-policy";
import { COMMITMENT_JOB_KINDS } from "../../modules/commitment-pooling/jobs";
import type { Job } from "../../types/job-queue";
import type { Address } from "../../types/domain";

/** A commitment composed on this phone that has not reached the chain yet. */
export interface PendingCommitmentCreation {
  jobId: string;
  chainId: number;
  poolId: string;
  direction: "OFFER" | "REQUEST";
  title: string | null;
  unitLabel: string;
  targetUnits: string;
  /** Waiting for the member's garden hat; consumes no retries. */
  waitingForMembership: boolean;
  /** Gave up after its attempts; retry or discard are the member's call. */
  failed: boolean;
  /**
   * Whether throwing it away is safe. A creation whose transaction was already
   * broadcast keeps its record so a retry can recover the commitment instead
   * of filing a second one.
   */
  discardable: boolean;
  createdAt: number;
}

export type CommitmentFailureReason =
  | "mismatchedWork"
  | "sourceWorkFailed"
  | "membershipLost"
  | "commitmentClosed"
  | "identityConflict"
  | "unavailable";

export interface FailedCommitmentJob {
  jobId: string;
  discardable: boolean;
  /** A terminal cause safe to explain without exposing queue internals. */
  reason: CommitmentFailureReason | null;
  /** Identity conflicts cannot be repaired by replaying the same payload. */
  retryable: boolean;
}

export interface CommitmentQueueState {
  /** Commitments with an act queued and still trying. Keyed by decimal id. */
  pendingCommitmentIds: ReadonlySet<string>;
  /** Commitment work that gave up. Terminal jobs never retry on their own. */
  failedCount: number;
  /** Which commitments those failures belong to, so a surface can name them. */
  failedCommitmentIds: ReadonlySet<string>;
  /**
   * The failed job behind each of those, so the commitment's own screen can
   * offer retry and discard rather than only an alert. A terminal record that
   * nobody can reach drives the alert forever and keeps its media with it.
   */
  failedJobs: ReadonlyMap<string, FailedCommitmentJob>;
  /** True while a new commitment is still waiting to be placed. */
  hasPendingCreate: boolean;
  /** Every creation still on this phone, failed ones included, newest first. */
  pendingCreates: PendingCommitmentCreation[];
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

function explainTerminalFailure(
  lastError?: string
): Pick<FailedCommitmentJob, "reason" | "retryable"> {
  if (!lastError) return { reason: null, retryable: true };
  if (lastError.startsWith("unavailable:")) return { reason: "unavailable", retryable: true };
  if (!lastError.startsWith("identity_conflict:")) return { reason: null, retryable: true };

  const reason = lastError.slice("identity_conflict:".length);
  if (reason === "work-identity-conflict" || reason === "work-link-payload-mismatch") {
    return { reason: "mismatchedWork", retryable: false };
  }
  if (reason === "source-work-terminal") {
    return { reason: "sourceWorkFailed", retryable: false };
  }
  if (reason === "membership-lost") return { reason: "membershipLost", retryable: false };
  if (reason === "commitment-frozen" || reason === "commitment-terminal") {
    return { reason: "commitmentClosed", retryable: false };
  }
  return { reason: "identityConflict", retryable: false };
}

/**
 * The viewer is passed in rather than resolved here: every caller already knows
 * who is reading, and a second identity source is a second thing that can
 * disagree about it.
 */
export function useCommitmentQueueState(viewer?: Address | null): CommitmentQueueState {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => commitmentPoolingKeys.queueState(viewer), [viewer]);

  // One query per reader rather than one per mount. Home, the sheet and the
  // detail screen all ask, and react-query serves them from a single read
  // instead of three scans of the whole queue on every job event.
  const query = useQuery({
    queryKey,
    enabled: Boolean(viewer),
    queryFn: async () => {
      const all = await jobQueue.getJobs(viewer as string);
      return all.filter((job) => COMMITMENT_JOB_KINDS.includes(job.kind as never));
    },
    staleTime: Number.POSITIVE_INFINITY,
    // The event bus is in-process, so a second tab never hears the first one
    // queue something. Without this it would keep offering an act already
    // taken, which is the double-enqueue this whole mechanism exists to stop.
    refetchOnWindowFocus: "always",
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // A flush that only moved a job to waiting (membership not yet granted, a
  // gateway down) rewrites the record without a completed or failed event, and
  // the query never goes stale on its own. The sync-completed event is the one
  // signal every flush emits, so the stored state is re-read on it.
  useJobQueueEvents(["job:added", "job:completed", "job:failed", "queue:sync-completed"], refresh, [
    refresh,
  ]);

  return useMemo(() => {
    const jobs: Job[] = query.data ?? [];
    const pendingCommitmentIds = new Set<string>();
    const failedCommitmentIds = new Set<string>();
    const failedJobs = new Map<string, FailedCommitmentJob>();
    const pendingCreates: PendingCommitmentCreation[] = [];
    let failedCount = 0;
    let hasPendingCreate = false;

    for (const job of jobs) {
      if (job.synced) continue;
      const commitmentId = commitmentIdOf(job);
      const failed = isTerminallyFailedJob(job);
      if (job.kind === "commitment") {
        const payload = job.payload as {
          poolId?: bigint | string;
          direction?: number;
          metadata?: { title?: string };
          unitLabel?: string;
          targetUnits?: bigint | string;
        };
        pendingCreates.push({
          jobId: job.id,
          chainId: job.chainId ?? 0,
          poolId: String(payload.poolId ?? ""),
          direction: payload.direction === 1 ? "REQUEST" : "OFFER",
          title: payload.metadata?.title ?? null,
          unitLabel: payload.unitLabel ?? "",
          targetUnits: String(payload.targetUnits ?? ""),
          waitingForMembership: !failed && job.meta?.waitingReason === "membership-unavailable",
          failed,
          discardable: isDiscardableJob(job),
          createdAt: job.createdAt,
        });
      }
      if (failed) {
        failedCount += 1;
        if (commitmentId) {
          failedCommitmentIds.add(commitmentId);
          failedJobs.set(commitmentId, {
            jobId: job.id,
            discardable: isDiscardableJob(job),
            ...explainTerminalFailure(job.lastError),
          });
        }
        continue;
      }
      if (commitmentId) pendingCommitmentIds.add(commitmentId);
      else if (job.kind === "commitment") hasPendingCreate = true;
    }
    pendingCreates.sort((left, right) => right.createdAt - left.createdAt);

    return {
      pendingCommitmentIds,
      failedCount,
      failedCommitmentIds,
      failedJobs,
      hasPendingCreate,
      pendingCreates,
      isUnavailable: Boolean(viewer) && query.isError,
      refresh,
    };
  }, [query.data, query.isError, viewer, refresh]);
}
