import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import type { ConvictionWeight } from "../../types/conviction";
import { wagmiConfig } from "../../config/appkit";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseHypercertConvictionOptions {
  enabled?: boolean;
}

export function useHypercertConviction(
  poolAddress?: Address,
  options: UseHypercertConvictionOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedPool = poolAddress ? normalizeAddress(poolAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.convictionWeights(normalizedPool ?? "", chainId),
    queryFn: async (): Promise<ConvictionWeight[]> => {
      if (!normalizedPool) return [];

      const result = await readContract(wagmiConfig, {
        address: normalizedPool,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "getConvictionWeights",
        chainId,
      });

      const [ids, weights] = result as [bigint[], bigint[]];
      return ids.map((id, i) => ({
        hypercertId: id,
        weight: weights[i],
      }));
    },
    enabled: enabled && Boolean(normalizedPool),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    weights: (query.data ?? []) as ConvictionWeight[],
  };
}
