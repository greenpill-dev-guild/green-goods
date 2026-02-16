import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import { PoolType, type GardenSignalPool } from "../../types/gardens-community";
import { wagmiConfig } from "../../config/appkit";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { getGardenPoolsFromSubgraph } from "../../modules/data/gardens";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseGardenPoolsOptions {
  /** RegistryCommunity address -- when provided, uses subgraph instead of RPC */
  communityAddress?: Address;
  enabled?: boolean;
}

/**
 * Query a garden's signal pools (HypercertSignalPool + ActionSignalPool).
 * Returns pool addresses with their type annotation.
 *
 * The GardensModule deploys exactly two pools per garden:
 * - Index 0: HypercertSignalPool (conviction-weighted hypercert curation)
 * - Index 1: ActionSignalPool (priority signaling on registered Actions)
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

      // Fast path: use subgraph when community address is known
      if (communityAddress) {
        return getGardenPoolsFromSubgraph(communityAddress, normalizedGarden as Address, chainId);
      }

      // Fallback: RPC resolution
      const gardensModule = await fetchGardensModuleAddress(normalizedGarden as Address, chainId);
      if (!gardensModule) return [];

      const [poolAddresses, resolvedCommunity] = await Promise.all([
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenSignalPools",
          args: [normalizedGarden],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenCommunity",
          args: [normalizedGarden],
          chainId,
        }),
      ]);

      const addresses = (poolAddresses as Address[]) ?? [];

      // Pool ordering is deterministic: GardensModule._createSignalPools() pushes
      // HypercertSignal first (index 0) and ActionSignal second (index 1).
      // This ordering is guaranteed by the contract and immutable post-deployment.
      return addresses.map((poolAddress, index) => ({
        poolAddress,
        poolType: index === 0 ? PoolType.Hypercert : PoolType.Action,
        gardenAddress: normalizedGarden as Address,
        communityAddress: resolvedCommunity as Address,
      }));
    },
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    pools: (query.data ?? []) as GardenSignalPool[],
  };
}
