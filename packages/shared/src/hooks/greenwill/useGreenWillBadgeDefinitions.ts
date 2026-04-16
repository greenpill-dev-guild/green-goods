import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { getGreenWillBadgeDefinitions } from "../../modules/data/greenwill";
import type { GreenWillBadgeDefinition } from "../../types/greenwill";

interface UseGreenWillBadgeDefinitionsOptions {
  chainId?: number;
  enabled?: boolean;
}

export function useGreenWillBadgeDefinitions(options: UseGreenWillBadgeDefinitionsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: queryKeys.greenWill.definitions(chainId),
    queryFn: () => getGreenWillBadgeDefinitions(chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    badgeDefinitions: (query.data ?? []) as GreenWillBadgeDefinition[],
  };
}
