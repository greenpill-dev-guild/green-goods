/**
 * ENS Address Resolution Hook
 *
 * Resolves an ENS name to its Ethereum address.
 *
 * @module hooks/blockchain/useEnsAddress
 */

import { resolveEnsAddress } from "../../utils/blockchain/ens";
import { queryKeys } from "../query-keys";
import { useEnsQuery, type UseEnsQueryOptions, type UseEnsQueryResult } from "./useEnsQuery";

/**
 * React Query wrapper around resolveEnsAddress with sensible caching defaults.
 *
 * @param name - ENS name to resolve (e.g., "vitalik.eth")
 * @param options - Query options
 * @returns Query result with address or null
 *
 * @example
 * ```typescript
 * const { data: address, isLoading } = useEnsAddress("vitalik.eth");
 * ```
 */
export function useEnsAddress(
  name?: string | null,
  options: UseEnsQueryOptions = {}
): UseEnsQueryResult<string> {
  return useEnsQuery(
    name,
    (normalizedName, opts) => resolveEnsAddress(normalizedName, opts),
    queryKeys.ens.address(name?.toLowerCase().trim() ?? ""),
    options
  );
}
