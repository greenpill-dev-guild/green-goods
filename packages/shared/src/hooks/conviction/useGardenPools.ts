import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { queryKeys, STALE_TIME_SLOW } from "../../config/query-keys";
import { getGardenPoolsFromSubgraph } from "../../modules/data/gardens";
import type { Address } from "../../types/domain";
import type { GardenSignalPool } from "../../types/gardens-community";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { annotateGardenSignalPools } from "../../utils/blockchain/garden-yield-wiring";
import { useCurrentChain } from "../blockchain/useChainConfig";

interface UseGardenPoolsOptions {
  /** RegistryCommunity address -- when provided, uses subgraph instead of RPC */
  communityAddress?: Address;
  enabled?: boolean;
}

async function readTypedHypercertPool(
  gardensModule: Address | undefined,
  gardenAddress: Address,
  chainId: number
): Promise<Address | undefined> {
  if (!gardensModule) return undefined;

  try {
    return (await readContract(getWagmiConfig(), {
      address: gardensModule,
      abi: GARDENS_MODULE_ABI,
      functionName: "gardenHypercertSignalPools",
      args: [gardenAddress],
      chainId,
    })) as Address;
  } catch {
    return undefined;
  }
}

/**
 * Query a garden's signal pools (ActionSignalPool + HypercertSignalPool).
 * Returns pool addresses with their type annotation.
 *
 * When `communityAddress` is provided, fetches from the Gardens V2 subgraph
 * instead of making RPC calls to the GardensModule contract.
 */
export function useGardenPools(gardenAddress?: Address, options: UseGardenPoolsOptions = {}) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;
  const communityAddress = options.communityAddress;

  const query = useQuery({
    queryKey: queryKeys.community.pools(normalizedGarden ?? "", chainId),
    queryFn: async (): Promise<GardenSignalPool[]> => {
      if (!normalizedGarden) return [];
      const garden = normalizedGarden as Address;
      const gardensModule = await fetchGardensModuleAddress(garden, chainId);
      const typedHypercertPool = await readTypedHypercertPool(gardensModule, garden, chainId);

      // Fast path: use subgraph when community address is known
      if (communityAddress) {
        return getGardenPoolsFromSubgraph(communityAddress, garden, chainId, typedHypercertPool);
      }

      // Fallback: RPC resolution
      if (!gardensModule) return [];

      const [poolAddresses, resolvedCommunity] = await Promise.all([
        readContract(getWagmiConfig(), {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenSignalPools",
          args: [garden],
          chainId,
        }),
        readContract(getWagmiConfig(), {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenCommunity",
          args: [garden],
          chainId,
        }),
      ]);

      const addresses = (poolAddresses as Address[]) ?? [];

      return annotateGardenSignalPools({
        poolAddresses: addresses,
        typedHypercertPoolAddress: typedHypercertPool,
        gardenAddress: garden,
        communityAddress: resolvedCommunity as Address,
      });
    },
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    pools: (query.data ?? []) as GardenSignalPool[],
  };
}
