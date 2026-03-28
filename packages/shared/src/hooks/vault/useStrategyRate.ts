import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { AAVE_V3_POOL_ABI, rayToApy } from "../../utils/blockchain/aave";
import { AAVE_V3_POOL } from "../../utils/blockchain/vaults";
import { STALE_TIME_SLOW } from "../query-keys";

interface UseStrategyRateOptions {
  chainId?: number;
  enabled?: boolean;
}

/**
 * Reads the live AAVE V3 liquidity rate for an asset and converts it to APY.
 *
 * Calls `getReserveData(asset)` on the AAVE V3 pool, extracts `currentLiquidityRate`,
 * and converts the ray value to an annual percentage.
 */
export function useStrategyRate(assetAddress?: Address, options: UseStrategyRateOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const poolAddress = AAVE_V3_POOL[chainId] as Address | undefined;
  const unsupported = !poolAddress;
  const enabled = (options.enabled ?? true) && !unsupported && Boolean(assetAddress);

  const query = useReadContract({
    address: (poolAddress ?? "0x0000000000000000000000000000000000000000") as Address,
    abi: AAVE_V3_POOL_ABI,
    chainId,
    functionName: "getReserveData",
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled,
      staleTime: STALE_TIME_SLOW,
    },
  });

  const result = useMemo(() => {
    if (!query.data) return { apy: undefined, liquidityRate: undefined };

    const liquidityRate = query.data.currentLiquidityRate;
    const apy = rayToApy(liquidityRate);

    // Guard against NaN from unexpected values
    if (!Number.isFinite(apy)) {
      return { apy: undefined, liquidityRate };
    }

    return { apy, liquidityRate };
  }, [query.data]);

  return {
    ...result,
    unsupported,
    isLoading: unsupported ? false : query.isLoading,
    isError: unsupported ? false : query.isError,
  };
}
