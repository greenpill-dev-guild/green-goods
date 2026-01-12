/**
 * Generic ENS Query Hook
 *
 * Provides a reusable pattern for all ENS-related queries with consistent
 * caching, normalization, and error handling.
 *
 * @module hooks/blockchain/useEnsQuery
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { STALE_TIME_RARE } from "../query-keys";

/** Default stale time for ENS queries (5 minutes) */
const DEFAULT_ENS_STALE_TIME = STALE_TIME_RARE;

export interface UseEnsQueryOptions {
  /** Whether the query is enabled (default: auto-detected from input) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Optional chain ID for multi-chain support */
  chainId?: number;
}

/**
 * Generic hook for ENS-related queries with consistent patterns.
 *
 * Handles input normalization, caching, and query lifecycle for any ENS resolver function.
 *
 * @param input - The input value (address or ENS name)
 * @param resolver - Async function that resolves the input to the desired type
 * @param queryKey - React Query cache key
 * @param options - Additional query options
 * @returns UseQueryResult with the resolved value
 *
 * @example
 * ```typescript
 * // Used internally by specific ENS hooks
 * export const useEnsName = (address: string | null) =>
 *   useEnsQuery(
 *     address,
 *     (addr) => resolveEnsName(addr),
 *     queryKeys.ens.name(address ?? ""),
 *     { validator: isAddress }
 *   );
 * ```
 */
export function useEnsQuery<T>(
  input: string | null | undefined,
  resolver: (normalizedInput: string, options?: UseEnsQueryOptions) => Promise<T | null>,
  queryKey: readonly unknown[],
  options: UseEnsQueryOptions & {
    /** Optional validator function to check if input is valid */
    validator?: (input: string) => boolean;
  } = {}
): UseQueryResult<T | null> {
  const { enabled, staleTime = DEFAULT_ENS_STALE_TIME, validator, ...resolverOptions } = options;

  // Normalize input (lowercase, trim)
  const normalized = input?.toLowerCase().trim() || null;

  // Determine if query should be enabled
  const isInputValid = normalized ? (validator ? validator(normalized) : true) : false;
  const isEnabled = enabled ?? isInputValid;

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!normalized) return null;
      return resolver(normalized, resolverOptions);
    },
    staleTime,
    enabled: isEnabled,
  });
}

export type UseEnsQueryResult<T> = UseQueryResult<T | null>;
