/**
 * useViewerTakeUps Hook
 *
 * What the reader has already done toward taking a pool's promises up: the requests they made
 * that no steward has answered, and the take-ups still on this phone. Home's Take Part and
 * Highlights offer neither again, and neither does Submit Work's Start step (decision 18).
 *
 * @module hooks/commitment-pooling/useViewerTakeUps
 */

import { useMemo } from "react";

import { type ViewerTakeUps, viewerTakeUps } from "../../modules/garden/journal";
import type { Address } from "../../types/domain";
import { useCommitmentQueueState } from "./useCommitmentQueueState";
import { usePoolClaimRequests } from "./usePoolClaimRequests";

export interface ViewerTakeUpsRead {
  takeUps: ViewerTakeUps;
  /**
   * This phone's queue has answered, and the requests read has answered, failed, or is
   * waiting for the network. Only a read in flight holds a list back: a failed requests read
   * leaves the listing rule standing, since the promise's own page still shows a pending
   * request.
   */
  settled: boolean;
  /**
   * This phone's queue could not be read, so a take-up already on it cannot be ruled out. A
   * surface that offers taking promises up offers none rather than offer one again.
   */
  unavailable: boolean;
  /** Reads this phone's queue again. */
  retry: () => void;
}

export function useViewerTakeUps(input: {
  chainId: number;
  poolId: bigint;
  viewer: Address | null | undefined;
  /** False until the pool is known. */
  enabled: boolean;
}): ViewerTakeUpsRead {
  const viewer = input.viewer ?? null;
  const reading = input.enabled && viewer !== null;
  const requests = usePoolClaimRequests(
    { chainId: input.chainId, poolId: input.poolId, state: "PENDING" },
    { enabled: reading }
  );
  const queue = useCommitmentQueueState(viewer);
  const takeUps = useMemo(
    () =>
      viewerTakeUps({
        viewer,
        pendingRequests: requests.rows.map((row) => row.claim),
        queued: queue.takeUpIds,
      }),
    [viewer, requests.rows, queue.takeUpIds]
  );
  const requestsAnswered =
    requests.availability.status !== "available" ||
    requests.data !== undefined ||
    requests.isError ||
    requests.isPaused;
  return {
    takeUps,
    settled: !reading || (requestsAnswered && !queue.isLoading),
    unavailable: reading && queue.isUnavailable,
    retry: queue.refresh,
  };
}
