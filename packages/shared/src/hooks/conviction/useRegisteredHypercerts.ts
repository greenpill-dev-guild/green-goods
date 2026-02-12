import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import { wagmiConfig } from "../../config/appkit";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseRegisteredHypercertsOptions {
  enabled?: boolean;
}

export function useRegisteredHypercerts(
  poolAddress?: Address,
  options: UseRegisteredHypercertsOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedPool = poolAddress ? normalizeAddress(poolAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.registeredHypercerts(normalizedPool ?? "", chainId),
    queryFn: async (): Promise<bigint[]> => {
      if (!normalizedPool) return [];

      const result = await readContract(wagmiConfig, {
        address: normalizedPool,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "getRegisteredHypercerts",
        chainId,
      });

      return (result as bigint[]) ?? [];
    },
    enabled: enabled && Boolean(normalizedPool),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    hypercertIds: (query.data ?? []) as bigint[],
  };
}
