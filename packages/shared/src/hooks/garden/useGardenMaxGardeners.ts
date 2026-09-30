import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { gardensKeys } from "../../config/query-keys/garden";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";

/**
 * How many gardeners a garden's account lets join; 0 means no limit. The indexer cannot carry
 * it, since `setMaxGardeners` emits no event, so it is read from the account itself.
 */
export function useGardenMaxGardeners(
  gardenAddress: Address | undefined,
  chainId: number | undefined
) {
  return useQuery({
    queryKey: gardensKeys.maxGardeners(gardenAddress ?? "", chainId ?? 0),
    queryFn: async () =>
      Number(
        await readContract(getWagmiConfig(), {
          address: gardenAddress!,
          abi: GardenAccountABI,
          functionName: "maxGardeners",
          chainId: chainId!,
        })
      ),
    enabled: Boolean(gardenAddress && chainId),
  });
}
