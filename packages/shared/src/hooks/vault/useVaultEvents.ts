import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getVaultEvents } from "../../modules/data/vaults";
import type { Address } from "../../types/domain";
import type { VaultEvent } from "../../types/vaults";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { vaultsKeys } from "../../config/query-keys/vault";

interface UseVaultEventsOptions {
  chainId?: number;
  limit?: number;
  enabled?: boolean;
}

export function useVaultEvents(gardenAddress?: Address, options: UseVaultEventsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const limit = options.limit ?? 100;
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress?.toLowerCase();

  const query = useQuery({
    queryKey: vaultsKeys.events(normalizedGarden ?? "", chainId, limit),
    queryFn: () => getVaultEvents(normalizedGarden ?? "", chainId, limit),
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    events: (query.data ?? []) as VaultEvent[],
  };
}
