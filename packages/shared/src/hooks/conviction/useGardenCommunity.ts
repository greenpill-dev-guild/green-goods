import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import { WeightScheme, type GardenCommunity } from "../../types/gardens-community";
import { wagmiConfig } from "../../config/appkit";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseGardenCommunityOptions {
  enabled?: boolean;
}

export function useGardenCommunity(
  gardenAddress?: Address,
  options: UseGardenCommunityOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const query = useQuery({
    // Safe fallback: query is disabled when normalizedGarden is undefined (see enabled below),
    // so the "" key is never used for an actual fetch.
    queryKey: queryKeys.community.garden(normalizedGarden ?? "", chainId),
    queryFn: async (): Promise<GardenCommunity | null> => {
      if (!normalizedGarden) return null;

      const gardensModule = await fetchGardensModuleAddress(normalizedGarden as Address, chainId);
      if (!gardensModule) return null;

      // All function names below are declared in GARDENS_MODULE_ABI (see abis.ts).
      // Per-garden calls (getGardenCommunity, getGardenWeightScheme, getGardenPowerRegistry)
      // take the garden address; module-level calls (goodsToken, STAKE_AMOUNT_PER_MEMBER) are
      // global to the GardensModule contract and take no args.
      const [
        communityAddress,
        weightSchemeRaw,
        powerRegistryAddress,
        goodsTokenAddress,
        stakeAmount,
      ] = await Promise.all([
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenCommunity",
          args: [normalizedGarden],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenWeightScheme",
          args: [normalizedGarden],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "getGardenPowerRegistry",
          args: [normalizedGarden],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "goodsToken",
          chainId,
        }),
        readContract(wagmiConfig, {
          address: gardensModule,
          abi: GARDENS_MODULE_ABI,
          functionName: "STAKE_AMOUNT_PER_MEMBER",
          chainId,
        }),
      ]);

      return {
        gardenAddress: normalizedGarden as Address,
        communityAddress: communityAddress as Address,
        powerRegistryAddress: powerRegistryAddress as Address,
        goodsTokenAddress: goodsTokenAddress as Address,
        weightScheme: Number(weightSchemeRaw) as WeightScheme,
        stakeAmount: stakeAmount as bigint,
      };
    },
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    community: query.data ?? null,
  };
}
