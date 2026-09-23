/**
 * ENS Name Resolution Hook
 *
 * Resolves an Ethereum address to its ENS name.
 *
 * @module hooks/blockchain/useEnsName
 */

import { useQueries } from "@tanstack/react-query";
import { type Address, isAddress } from "viem";
import { resolveEnsName } from "../../utils/blockchain/ens";
import { ensKeys } from "../../config/query-keys/identity";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { type UseEnsQueryOptions, type UseEnsQueryResult, useEnsQuery } from "./useEnsQuery";

/**
 * React Query wrapper around resolveEnsName with sensible caching defaults.
 *
 * @param address - Ethereum address to resolve
 * @param options - Query options
 * @returns Query result with ENS name or null
 *
 * @example
 * ```typescript
 * const { data: ensName, isLoading } = useEnsName("0x123...");
 * ```
 */
export function useEnsName(
  address?: Address | null,
  options: UseEnsQueryOptions = {}
): UseEnsQueryResult<string> {
  return useEnsQuery(
    address,
    (normalizedAddress, opts) => resolveEnsName(normalizedAddress, opts),
    ensKeys.name(address?.toLowerCase() ?? ""),
    {
      ...options,
      validator: isAddress,
    }
  );
}

/** Resolve a roster's ENS names through the same cache keys as AddressDisplay. */
export function useEnsNames(addresses: readonly Address[]): Map<string, string> {
  const uniqueAddresses = [...new Set(addresses.map((address) => address.toLowerCase()))];
  const results = useQueries({
    queries: uniqueAddresses.map((address) => ({
      queryKey: ensKeys.name(address),
      queryFn: () => resolveEnsName(address),
      staleTime: STALE_TIME_RARE,
      enabled: isAddress(address),
    })),
  });

  const names = new Map<string, string>();
  results.forEach((result, index) => {
    if (result.data) names.set(uniqueAddresses[index]!, result.data);
  });
  return names;
}
