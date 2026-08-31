import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { getPublicCommitmentImpact } from "../../modules/commitment-pooling/data-public-impact";

export function usePublicCommitmentImpact(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: publicKeys.commitmentImpact(chainId),
    queryFn: () => getPublicCommitmentImpact(chainId),
    staleTime: STALE_TIME_RARE,
  });
}
