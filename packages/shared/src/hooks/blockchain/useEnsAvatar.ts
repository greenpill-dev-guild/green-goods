import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { resolveEnsAvatar } from "../../utils/blockchain/ens";
import { getCachedAvatar, cacheAvatar } from "../../utils/storage/avatar-cache";

type UseEnsAvatarOptions = {
  enabled?: boolean;
  chainId?: number;
};

/** React Query wrapper around resolveEnsAvatar with local caching for offline support. */
export function useEnsAvatar(address?: string | null, options: UseEnsAvatarOptions = {}) {
  const normalized = address?.toLowerCase() ?? null;
  const enabled = options.enabled ?? Boolean(normalized && isAddress(normalized));

  return useQuery({
    queryKey: ["ens-avatar", normalized],
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
    staleTime: 5 * 60 * 1000, // cache ENS avatars for 5 minutes in React Query
    enabled,
  });
}

