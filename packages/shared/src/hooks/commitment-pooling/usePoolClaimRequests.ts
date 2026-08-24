/**
 * usePoolClaimRequests Hook
 *
 * The steward's claims queue: every claim across one pool, joined to the
 * commitment it sits on, so a row can say who asked, for what, and in which
 * state without a second read. Pending by default; any claim state reads.
 *
 * @module hooks/commitment-pooling/usePoolClaimRequests
 */

import { useQuery } from "@tanstack/react-query";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { getPoolClaimRequests } from "../../modules/commitment-pooling/data";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";

export function usePoolClaimRequests(
  input: { chainId: number; poolId: bigint; state?: string },
  /** A caller that may not know the pool yet gates here; the key stays the same. */
  options: { enabled?: boolean } = {}
) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.poolClaims(input.chainId, input.poolId, input.state),
    queryFn: () => getPoolClaimRequests(input),
    enabled: availability.status === "available" && options.enabled !== false,
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, rows: query.data ?? [], availability };
}
