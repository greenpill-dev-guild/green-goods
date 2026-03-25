import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";

interface ConvertEntry {
  vaultAddress: Address;
  shares: bigint;
}

/**
 * Batches multiple `convertToAssets(shares)` calls across vaults into a single multicall.
 *
 * Returns a Map keyed by `${vaultAddress}:${shares}` → current asset value.
 * Deduplicates identical vault+shares pairs to minimize RPC calls.
 */
export function useBatchConvertToAssets(entries: ConvertEntry[]) {
  // Deduplicate by vault+shares key
  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    const deduped: ConvertEntry[] = [];
    for (const entry of entries) {
      const key = `${entry.vaultAddress}:${entry.shares}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(entry);
      }
    }
    return deduped;
  }, [entries]);

  const contracts = useMemo(
    () =>
      uniqueEntries.map((entry) => ({
        address: entry.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "convertToAssets" as const,
        args: [entry.shares] as const,
      })),
    [uniqueEntries]
  );

  const query = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: uniqueEntries.length > 0,
    },
  });

  const assetMap = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!query.data) return map;

    for (let i = 0; i < uniqueEntries.length; i++) {
      const entry = uniqueEntries[i];
      const result = query.data[i];
      const key = `${entry.vaultAddress}:${entry.shares}`;
      if (result?.status === "success") {
        map.set(key, result.result as bigint);
      }
    }

    return map;
  }, [query.data, uniqueEntries]);

  return {
    assetMap,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
