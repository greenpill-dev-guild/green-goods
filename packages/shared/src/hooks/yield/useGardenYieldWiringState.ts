import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";

import { getWagmiConfig } from "../../config/appkit";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import type { Address } from "../../types/domain";
import { GARDENS_MODULE_ABI, YIELD_RESOLVER_ABI } from "../../utils/blockchain/abis";
import { isZeroAddress, normalizeAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import {
  deriveGardenYieldWiringState,
  type GardenYieldWiringState,
} from "../../utils/blockchain/garden-yield-wiring";
import { useCurrentChain } from "../blockchain/useChainConfig";

interface UseGardenYieldWiringStateOptions {
  enabled?: boolean;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readGardenYieldWiringState(
  gardenAddress: Address,
  chainId: number
): Promise<GardenYieldWiringState> {
  const normalizedGarden = normalizeAddress(gardenAddress) as Address;
  const configuredYieldResolver = getNetworkContracts(chainId).yieldSplitter as Address;

  try {
    const gardensModule = await fetchGardensModuleAddress(normalizedGarden, chainId);
    if (!gardensModule) {
      return deriveGardenYieldWiringState({
        readStatus: "unavailable",
        gardenAddress: normalizedGarden,
        yieldResolverAddress: configuredYieldResolver,
        readErrorMessage: "GardensModule unavailable",
      });
    }

    const [typedHypercertPool, moduleYieldResolver] = await Promise.all([
      readContract(getWagmiConfig(), {
        address: gardensModule,
        abi: GARDENS_MODULE_ABI,
        functionName: "gardenHypercertSignalPools",
        args: [normalizedGarden],
        chainId,
      }),
      readContract(getWagmiConfig(), {
        address: gardensModule,
        abi: GARDENS_MODULE_ABI,
        functionName: "yieldResolver",
        chainId,
      }),
    ]);

    const resolverForRead = !isZeroAddress(configuredYieldResolver)
      ? configuredYieldResolver
      : (moduleYieldResolver as Address);
    const [resolverHypercertPool, resolverGardensModule] = !isZeroAddress(resolverForRead)
      ? await Promise.all([
          readContract(getWagmiConfig(), {
            address: resolverForRead,
            abi: YIELD_RESOLVER_ABI,
            functionName: "gardenHypercertPools",
            args: [normalizedGarden],
            chainId,
          }),
          readContract(getWagmiConfig(), {
            address: resolverForRead,
            abi: YIELD_RESOLVER_ABI,
            functionName: "gardensModule",
            chainId,
          }),
        ])
      : [undefined, undefined];

    return deriveGardenYieldWiringState({
      readStatus: "available",
      gardenAddress: normalizedGarden,
      gardensModuleAddress: gardensModule,
      yieldResolverAddress: resolverForRead,
      moduleYieldResolverAddress: moduleYieldResolver as Address,
      resolverGardensModuleAddress: resolverGardensModule as Address | undefined,
      typedHypercertPoolAddress: typedHypercertPool as Address,
      resolverHypercertPoolAddress: resolverHypercertPool as Address | undefined,
    });
  } catch (error) {
    return deriveGardenYieldWiringState({
      readStatus: "unavailable",
      gardenAddress: normalizedGarden,
      yieldResolverAddress: configuredYieldResolver,
      readErrorMessage: getErrorMessage(error),
    });
  }
}

export function useGardenYieldWiringState(
  gardenAddress?: Address,
  options: UseGardenYieldWiringStateOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress ? (normalizeAddress(gardenAddress) as Address) : undefined;

  const query = useQuery({
    queryKey: queryKeys.yield.wiring(normalizedGarden ?? "", chainId),
    queryFn: () => readGardenYieldWiringState(normalizedGarden as Address, chainId),
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    wiringState: query.data,
    wiringStatus: query.data?.status,
    repairHref: query.data?.repairHref,
  };
}
