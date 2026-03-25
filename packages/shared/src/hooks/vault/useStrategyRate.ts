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
  const enabled = (options.enabled ?? true) && Boolean(poolAddress) && Boolean(assetAddress);

  const query = useReadContract({
    address: poolAddress!,
    abi: AAVE_V3_POOL_ABI,
    functionName: "getReserveData",
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled,
      staleTime: STALE_TIME_SLOW,
    },
  });

  const result = useMemo(() => {
    if (!query.data) return { apy: undefined, liquidityRate: undefined };

    // getReserveData returns a tuple — access by index (2 = currentLiquidityRate)
    const tupleData = query.data as readonly unknown[];
    const rawRate = tupleData?.[2];
    if (typeof rawRate !== "bigint") {
      return { apy: undefined, liquidityRate: undefined };
    }

    const liquidityRate = rawRate;
    const apy = rayToApy(liquidityRate);

    // Guard against NaN from unexpected values
    if (!Number.isFinite(apy)) {
      return { apy: undefined, liquidityRate };
    }

    return { apy, liquidityRate };
  }, [query.data]);

  return {
    ...result,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
