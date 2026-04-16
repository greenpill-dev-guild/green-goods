import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { getGreenWillRecentGrants } from "../../modules/data/greenwill";
import type { GreenWillBadgeGrant } from "../../types/greenwill";

interface UseGreenWillRecentGrantsOptions {
  chainId?: number;
  limit?: number;
  enabled?: boolean;
}

export function useGreenWillRecentGrants(options: UseGreenWillRecentGrantsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const limit = options.limit ?? 20;
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: queryKeys.greenWill.recentGrants(chainId, limit),
    queryFn: () => getGreenWillRecentGrants(chainId, limit),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    grants: (query.data ?? []) as GreenWillBadgeGrant[],
  };
}
