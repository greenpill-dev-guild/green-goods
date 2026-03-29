import { useEffect, useMemo } from "react";
import { useReadContract } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
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
  const enabled = (options.enabled ?? true) && Boolean(poolAddress) && Boolean(assetAddress);

  const query = useReadContract({
    address: poolAddress!,
    chainId,
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

    const liquidityRate = query.data.currentLiquidityRate;
    const apy = rayToApy(liquidityRate);

    // Guard against NaN from unexpected values
    if (!Number.isFinite(apy)) {
      return { apy: undefined, liquidityRate };
    }

    return { apy, liquidityRate };
  }, [query.data]);

  // Diagnostic: log when APY fetch settles to help debug missing values
  useEffect(() => {
    if (query.isLoading || !assetAddress) return;

    if (unsupported) {
      logger.debug("[useStrategyRate] No Aave pool for chain", {
        chainId,
        assetAddress,
      });
    } else if (query.isError) {
      logger.debug("[useStrategyRate] getReserveData call failed", {
        chainId,
        assetAddress,
        poolAddress,
        error: query.error?.message,
      });
    } else if (!query.data) {
      logger.debug("[useStrategyRate] getReserveData returned no data", {
        chainId,
        assetAddress,
        poolAddress,
        enabled,
      });
    } else if (result.apy === undefined) {
      logger.debug("[useStrategyRate] APY calculation produced NaN", {
        chainId,
        assetAddress,
        liquidityRate: String(query.data.currentLiquidityRate),
      });
    }
  }, [
    query.isLoading,
    query.isError,
    query.data,
    query.error,
    unsupported,
    assetAddress,
    chainId,
    poolAddress,
    enabled,
    result.apy,
  ]);

  return {
    ...result,
    unsupported,
    isLoading: enabled ? query.isLoading : false,
    isError: enabled ? query.isError : false,
  };
}
