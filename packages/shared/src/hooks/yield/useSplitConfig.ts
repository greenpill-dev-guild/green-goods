import { useMemo } from "react";
import { useReadContract } from "wagmi";
import type { Address } from "../../types/domain";
import { DEFAULT_SPLIT_CONFIG, type SplitConfig } from "../../types/gardens-community";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_RARE } from "../query-keys";

interface UseSplitConfigOptions {
  enabled?: boolean;
}

/**
 * Reads the yield split configuration for a garden from the YieldResolver.
 *
 * Returns the three-way split ratios in basis points (bps, where 10000 = 100%):
 * - cookieJarBps: gardener operational compensation
 * - fractionsBps: Hypercert fraction purchases
 * - juiceboxBps: GOODS token treasury backing
 *
 * Falls back to protocol defaults (48.65% / 48.65% / 2.7%) when the garden
 * has no custom config (all-zero return from contract).
 */
export function useSplitConfig(gardenAddress?: Address, options: UseSplitConfigOptions = {}) {
  const chainId = useCurrentChain();
  const yieldSplitter = getNetworkContracts(chainId).yieldSplitter as Address;
  const hasYieldSplitter = !isZeroAddress(yieldSplitter);
  const enabled = (options.enabled ?? true) && hasYieldSplitter && Boolean(gardenAddress);

  const query = useReadContract({
    address: yieldSplitter,
    chainId,
    abi: YIELD_SPLITTER_ABI,
    functionName: "getSplitConfig",
    args: gardenAddress ? [gardenAddress] : undefined,
    query: {
      enabled,
      staleTime: STALE_TIME_RARE,
    },
  });

  const config = useMemo((): SplitConfig => {
    if (!query.data) return DEFAULT_SPLIT_CONFIG;

    const raw = query.data as { cookieJarBps: bigint; fractionsBps: bigint; juiceboxBps: bigint };
    const cookieJarBps = Number(raw.cookieJarBps);
    const fractionsBps = Number(raw.fractionsBps);
    const juiceboxBps = Number(raw.juiceboxBps);

    // All-zero means no custom config — use protocol defaults
    if (cookieJarBps === 0 && fractionsBps === 0 && juiceboxBps === 0) {
      return DEFAULT_SPLIT_CONFIG;
    }

    return { cookieJarBps, fractionsBps, juiceboxBps };
  }, [query.data]);

  return {
    config,
    isLoading: enabled ? query.isLoading : false,
    isError: enabled ? query.isError : false,
  };
}
