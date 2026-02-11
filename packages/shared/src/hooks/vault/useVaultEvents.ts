import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getVaultEvents } from "../../modules/data/vaults";
import type { VaultEvent } from "../../types/vaults";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseVaultEventsOptions {
  chainId?: number;
  limit?: number;
  enabled?: boolean;
}

export function useVaultEvents(gardenAddress?: string, options: UseVaultEventsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const limit = options.limit ?? 100;
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress?.toLowerCase();

  const query = useQuery({
    queryKey: queryKeys.vaults.events(normalizedGarden ?? "", chainId, limit),
    queryFn: () => getVaultEvents(normalizedGarden ?? "", chainId, limit),
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    events: (query.data ?? []) as VaultEvent[],
  };
}
