import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { fetchPublicCommitmentImpact } from "../../modules/commitment-pooling/public-impact-transport";

/**
 * The public commitment totals. The website shows the counts only, so a snapshot
 * is read again every 30 seconds while the counts are missing; a snapshot that
 * lacks only the payout valuation is complete for every page that reads it.
 */
export function usePublicCommitmentImpact(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: publicKeys.commitmentImpact(chainId),
    queryFn: ({ signal }) => fetchPublicCommitmentImpact(chainId, signal),
    staleTime: STALE_TIME_RARE,
    refetchInterval: (query) =>
      query.state.data?.unavailableSources.commitmentPools ? 30_000 : false,
  });
}
