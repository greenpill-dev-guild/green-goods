/**
 * ENS Avatar Resolution Hook
 *
 * Resolves an Ethereum address to its ENS avatar URL.
 * Includes local caching for offline support.
 *
 * @module hooks/blockchain/useEnsAvatar
 */

import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { resolveEnsAvatar } from "../../utils/blockchain/ens";
import { cacheAvatar, getCachedAvatar } from "../../utils/storage/avatar-cache";
import { queryKeys, STALE_TIME_RARE } from "../query-keys";
import type { UseEnsQueryOptions, UseEnsQueryResult } from "./useEnsQuery";

/**
 * React Query wrapper around resolveEnsAvatar with local caching for offline support.
 *
 * Note: This hook doesn't use the generic useEnsQuery because it has custom caching logic
 * that needs to check local storage before making network requests.
 *
 * @param address - Ethereum address to resolve avatar for
 * @param options - Query options
 * @returns Query result with avatar URL or null
 *
 * @example
 * ```typescript
 * const { data: avatarUrl, isLoading } = useEnsAvatar("0x123...");
 * if (avatarUrl) {
 *   return <img src={avatarUrl} alt="Avatar" />;
 * }
 * ```
 */
export function useEnsAvatar(
  address?: string | null,
  options: UseEnsQueryOptions = {}
): UseEnsQueryResult<string> {
  const normalized = address?.toLowerCase() ?? null;
  const enabled = options.enabled ?? Boolean(normalized && isAddress(normalized));

  return useQuery({
    queryKey: queryKeys.ens.avatar(normalized ?? ""),
    queryFn: async () => {
      if (!normalized) return null;

      // Try to get from local cache first for offline support
      const cached = getCachedAvatar(normalized);
      if (cached) {
        return cached;
      }

      // Fetch from ENS
      const avatarUrl = await resolveEnsAvatar(normalized, options);

      // Cache the result if found
      if (avatarUrl) {
        cacheAvatar(normalized, avatarUrl);
      }

      return avatarUrl;
    },
    staleTime: options.staleTime ?? STALE_TIME_RARE,
    enabled,
  });
}
