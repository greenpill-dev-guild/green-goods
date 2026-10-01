import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { fetchPublicCommitmentImpact } from "../../modules/commitment-pooling/public-impact-transport";

export function usePublicCommitmentImpact(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: publicKeys.commitmentImpact(chainId),
    queryFn: ({ signal }) => fetchPublicCommitmentImpact(chainId, signal),
    staleTime: STALE_TIME_RARE,
    refetchInterval: (query) => (query.state.data?.partialData ? 30_000 : false),
  });
}
