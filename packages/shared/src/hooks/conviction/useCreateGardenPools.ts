import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import type { Address } from "../../types/domain";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { normalizeAddress } from "../../utils/blockchain/address";
import { logger } from "../../modules/app/logger";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { queryKeys } from "../query-keys";

/**
 * Hook for creating signal pools for a garden.
 *
 * In v14, pools are no longer created during mint. Operators must
 * call GardensModule.createGardenPools(garden) separately after
 * the community has been established.
 *
 * This is idempotent on-chain: the contract reverts with PoolsAlreadyExist
 * if pools are already created.
 */
export function useCreateGardenPools(gardenAddress?: Address) {
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const invalidatePools = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.community.pools(normalizedGarden ?? "", chainId),
      }),
    [queryClient, normalizedGarden, chainId]
  );

  const { start: schedulePoolSync } = useDelayedInvalidation(invalidatePools, 10000);

  const createPools = useCallback(async (): Promise<string | undefined> => {
    if (!normalizedGarden) {
      setError(new Error("Garden address is required"));
      return undefined;
    }

    setIsCreating(true);
    setError(null);

    try {
      const gardensModule = await fetchGardensModuleAddress(normalizedGarden as Address, chainId);

      if (!gardensModule) {
        throw new Error("GardensModule not found for this garden");
      }

      const txHash = await writeContractAsync({
        address: gardensModule,
        abi: GARDENS_MODULE_ABI,
        functionName: "createGardenPools",
        args: [normalizedGarden],
        chainId,
      });

      schedulePoolSync();
      setIsCreating(false);
      return txHash;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create pools");
      logger.error("Failed to create garden pools", {
        source: "useCreateGardenPools",
        error,
        gardenAddress: normalizedGarden,
      });
      setError(error);
      setIsCreating(false);
      throw error;
    }
  }, [normalizedGarden, chainId, writeContractAsync, schedulePoolSync]);

  return {
    createPools,
    isCreating,
    error,
  };
}
