import { useQuery } from "@tanstack/react-query";
import type { Address } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getAllGardenVaults, getGardenVaults } from "../../modules/data/vaults";
import type { GardenVault } from "../../types/vaults";
import { queryKeys, STALE_TIME_FAST } from "../query-keys";

interface UseGardenVaultsOptions {
  chainId?: number;
  enabled?: boolean;
}

export function useGardenVaults(gardenAddress?: Address, options: UseGardenVaultsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress?.toLowerCase();

  const query = useQuery({
    queryKey: normalizedGarden
      ? queryKeys.vaults.byGarden(normalizedGarden, chainId)
      : queryKeys.vaults.byChain(chainId),
    queryFn: () =>
      normalizedGarden ? getGardenVaults(normalizedGarden, chainId) : getAllGardenVaults(chainId),
    enabled: enabled && (normalizedGarden ? normalizedGarden.length > 0 : true),
    staleTime: STALE_TIME_FAST,
  });

  return {
    ...query,
    vaults: (query.data ?? []) as GardenVault[],
  };
}
