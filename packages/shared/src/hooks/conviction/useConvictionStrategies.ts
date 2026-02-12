import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import { wagmiConfig } from "../../config/appkit";
import { HATS_MODULE_CONVICTION_ABI } from "../../utils/blockchain/abis";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseConvictionStrategiesOptions {
  enabled?: boolean;
}

export function useConvictionStrategies(
  gardenAddress?: Address,
  options: UseConvictionStrategiesOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.strategies(normalizedGarden ?? "", chainId),
    queryFn: async (): Promise<Address[]> => {
      if (!normalizedGarden) return [];

      const hatsModule = await fetchHatsModuleAddress(normalizedGarden, chainId);
      if (!hatsModule) return [];

      const result = await readContract(wagmiConfig, {
        address: hatsModule,
        abi: HATS_MODULE_CONVICTION_ABI,
        functionName: "getConvictionStrategies",
        args: [normalizedGarden],
        chainId,
      });

      return (result as Address[]) ?? [];
    },
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    strategies: (query.data ?? []) as Address[],
  };
}
