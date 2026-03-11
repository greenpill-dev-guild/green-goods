import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { getConvictionStrategiesFromSubgraph } from "../../modules/data/gardens";
import type { Address } from "../../types/domain";
import { HATS_MODULE_CONVICTION_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseConvictionStrategiesOptions {
  enabled?: boolean;
}

/**
 * Fetches conviction strategy addresses for a garden.
 *
 * When `communityAddress` is provided as the second positional argument,
 * uses the Gardens V2 subgraph (fast). Otherwise falls back to RPC calls
 * through the HatsModule contract.
 */
export function useConvictionStrategies(
  gardenAddress?: Address,
  communityAddressOrOptions?: Address | UseConvictionStrategiesOptions,
  options: UseConvictionStrategiesOptions = {}
) {
  const chainId = useCurrentChain();

  // Support both positional and options-based API:
  // useConvictionStrategies(garden, community)
  // useConvictionStrategies(garden, community, { enabled })
  // useConvictionStrategies(garden, { enabled })
  let communityAddress: Address | undefined;
  let resolvedOptions: UseConvictionStrategiesOptions;

  if (typeof communityAddressOrOptions === "string") {
    communityAddress = communityAddressOrOptions as Address;
    resolvedOptions = options;
  } else {
    communityAddress = undefined;
    resolvedOptions = communityAddressOrOptions ?? options;
  }

  const enabled = resolvedOptions.enabled ?? true;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;
  const normalizedCommunity = communityAddress ? normalizeAddress(communityAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.strategies(normalizedGarden ?? "", chainId),
    queryFn: async (): Promise<Address[]> => {
      if (!normalizedGarden) return [];

      // Fast path: subgraph when community address is known
      if (normalizedCommunity) {
        return getConvictionStrategiesFromSubgraph(normalizedCommunity, chainId);
      }

      // Fallback: RPC via HatsModule
      const hatsModule = await fetchHatsModuleAddress(normalizedGarden, chainId);
      if (!hatsModule) return [];

      const result = await readContract(getWagmiConfig(), {
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
