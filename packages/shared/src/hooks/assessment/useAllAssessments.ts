import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getGardenAssessments } from "../../modules/data/eas";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export function useAllAssessments(chainId?: number) {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;

  return useQuery({
    queryKey: queryKeys.assessments.byChain(resolvedChainId),
    queryFn: () => getGardenAssessments(undefined, resolvedChainId),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
