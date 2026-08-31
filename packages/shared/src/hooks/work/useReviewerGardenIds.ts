/**
 * useReviewerGardenIds Hook
 *
 * Determines which gardens the current user can review work for,
 * combining steward and evaluator roles via a single multicall.
 *
 * @module hooks/work/useReviewerGardenIds
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Abi } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { createPublicClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { getGardens } from "../../modules/data/greengoods";
import {
  DEFAULT_RETRY_COUNT,
  STALE_TIME_MEDIUM,
  STALE_TIME_SLOW,
} from "../../config/query-keys/constants";
import { gardensKeys } from "../../config/query-keys/garden";
import { roleKeys } from "../../config/query-keys/identity";

interface UseReviewerGardenIdsResult {
  /** All garden IDs the user can review (steward + evaluator union) */
  reviewerGardenIds: string[];
  /** Only the steward garden IDs */
  stewardGardenIds: string[];
  /** Only the evaluator garden IDs */
  evaluatorGardenIds: string[];
  /** Whether garden/role data is still loading */
  isLoading: boolean;
}

/**
 * Computes the set of gardens where the user has reviewer privileges
 * (steward or evaluator role). Uses a single multicall to batch
 * evaluator checks across all gardens.
 */
export function useReviewerGardenIds(address: Address | undefined): UseReviewerGardenIdsResult {
  const { data: gardens = [] } = useQuery({
    queryKey: gardensKeys.byChain(DEFAULT_CHAIN_ID),
    queryFn: () => getGardens(),
    staleTime: STALE_TIME_SLOW,
    retry: DEFAULT_RETRY_COUNT,
  });

  const stewardGardenIds = useMemo(
    () =>
      (gardens || [])
        .filter((g) => {
          if (!address) return false;
          const stewards = (g.stewards || []).map((op: string) => op.toLowerCase());
          return stewards.includes(address.toLowerCase());
        })
        .map((g) => g.id),
    [gardens, address]
  );

  const { data: evaluatorGardenIds = [], isLoading: isLoadingEvaluator } = useQuery({
    queryKey: roleKeys.evaluatorGardens(
      address || undefined,
      (gardens || []).map((g) => g.id)
    ),
    queryFn: async () => {
      if (!address || !gardens?.length) return [];
      const publicClient = createPublicClientForChain(DEFAULT_CHAIN_ID);

      // Batch all evaluator checks into a single multicall RPC request
      const results = await publicClient.multicall({
        contracts: gardens.map((garden) => ({
          address: garden.id as Address,
          abi: GardenAccountABI as Abi,
          functionName: "isEvaluator" as const,
          args: [address as Address],
        })),
        allowFailure: true,
      });

      return gardens
        .filter((_, index) => results[index].status === "success" && Boolean(results[index].result))
        .map((garden) => garden.id);
    },
    enabled: !!address && (gardens?.length ?? 0) > 0,
    staleTime: STALE_TIME_MEDIUM,
  });

  const reviewerGardenIds = useMemo(() => {
    const combined = new Set<string>();
    stewardGardenIds.forEach((id) => combined.add(id));
    evaluatorGardenIds.forEach((id) => combined.add(id));
    return Array.from(combined);
  }, [stewardGardenIds, evaluatorGardenIds]);

  return {
    reviewerGardenIds,
    stewardGardenIds,
    evaluatorGardenIds,
    isLoading: isLoadingEvaluator,
  };
}
