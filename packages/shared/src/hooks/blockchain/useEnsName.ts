/**
 * ENS Name Resolution Hook
 *
 * Resolves an Ethereum address to its ENS name.
 *
 * @module hooks/blockchain/useEnsName
 */

import { isAddress } from "viem";
import { resolveEnsName } from "../../utils/blockchain/ens";
import { queryKeys } from "../query-keys";
import { useEnsQuery, type UseEnsQueryOptions, type UseEnsQueryResult } from "./useEnsQuery";

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
  address?: string | null,
  options: UseEnsQueryOptions = {}
): UseEnsQueryResult<string> {
  return useEnsQuery(
    address,
    (normalizedAddress, opts) => resolveEnsName(normalizedAddress, opts),
    queryKeys.ens.name(address?.toLowerCase() ?? ""),
    {
      ...options,
      validator: isAddress,
    }
  );
}
