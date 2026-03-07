import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import { WeightScheme, type GardenCommunity } from "../../types/gardens-community";
import { wagmiConfig } from "../../config/appkit";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { getGardenCommunityFromSubgraph } from "../../modules/data/gardens";
import { normalizeAddress } from "../../utils/blockchain/address";
import { logger } from "../../modules/app/logger";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseGardenCommunityOptions {
  /** RegistryCommunity address -- when provided, uses subgraph instead of RPC */
  communityAddress?: Address;
  enabled?: boolean;
}

export function useGardenCommunity(
  gardenAddress?: Address,
  options: UseGardenCommunityOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;
  const communityAddress = options.communityAddress;

  const query = useQuery({
    // Safe fallback: query is disabled when normalizedGarden is undefined (see enabled below),
    // so the "" key is never used for an actual fetch.
    queryKey: queryKeys.community.garden(normalizedGarden ?? "", chainId),
    queryFn: async (): Promise<GardenCommunity | null> => {
      if (!normalizedGarden) return null;

      // Fast path: use subgraph when community address is known
      if (communityAddress) {
        const subgraphResult = await getGardenCommunityFromSubgraph(
          communityAddress,
          normalizedGarden as Address,
          chainId
        );
        if (subgraphResult) {
          // Enrich with on-chain data not available in subgraph
          // (weightScheme requires an RPC call)
          try {
            const gardensModule = await fetchGardensModuleAddress(
              normalizedGarden as Address,
              chainId
            );
            if (gardensModule) {
              const weightSchemeRaw = await readContract(wagmiConfig, {
                address: gardensModule,
                abi: GARDENS_MODULE_ABI,
                functionName: "getGardenWeightScheme",
                args: [normalizedGarden],
                chainId,
              });
              subgraphResult.weightScheme = Number(weightSchemeRaw) as WeightScheme;
            } else {
              logger.warn("GardensModule not found — weight scheme defaulting to subgraph value", {
                source: "useGardenCommunity",
                gardenAddress: normalizedGarden,
                chainId,
                defaultScheme: subgraphResult.weightScheme,
              });
            }
          } catch (enrichError) {
            logger.warn("Failed to enrich weight scheme from RPC — using subgraph default", {
              source: "useGardenCommunity",
              gardenAddress: normalizedGarden,
              chainId,
              defaultScheme: subgraphResult.weightScheme,
              error: enrichError,
            });
          }
          return subgraphResult;
        }
      }

      // Fallback: full RPC resolution when community address is not known
      const gardensModule = await fetchGardensModuleAddress(normalizedGarden as Address, chainId);
      if (!gardensModule) return null;

      const [resolvedCommunity, weightSchemeRaw, goodsTokenAddress, stakeAmount] =
        await Promise.all([
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
            functionName: "goodsToken",
            chainId,
          }),
          readContract(wagmiConfig, {
            address: gardensModule,
            abi: GARDENS_MODULE_ABI,
            functionName: "stakeAmountPerMember",
            chainId,
          }),
        ]);

      let communityName: string | undefined;
      try {
        const subgraphCommunity = await getGardenCommunityFromSubgraph(
          resolvedCommunity as Address,
          normalizedGarden as Address,
          chainId
        );
        communityName = subgraphCommunity?.communityName;
      } catch (subgraphError) {
        logger.warn("Failed to enrich community name from subgraph", {
          source: "useGardenCommunity",
          gardenAddress: normalizedGarden,
          communityAddress: resolvedCommunity,
          chainId,
          error: subgraphError,
        });
      }

      return {
        gardenAddress: normalizedGarden as Address,
        communityAddress: resolvedCommunity as Address,
        communityName,
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
