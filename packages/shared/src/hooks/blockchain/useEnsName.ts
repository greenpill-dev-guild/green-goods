import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { resolveEnsName } from "../../utils/blockchain/ens";

type UseEnsNameOptions = {
  enabled?: boolean;
  chainId?: number;
};

/** React Query wrapper around resolveEnsName with sensible caching defaults. */
export function useEnsName(address?: string | null, options: UseEnsNameOptions = {}) {
  const normalized = address?.toLowerCase() ?? null;
  const enabled = options.enabled ?? Boolean(normalized && isAddress(normalized));

  return useQuery({
    queryKey: ["ens-name", normalized],
    queryFn: async () => (normalized ? resolveEnsName(normalized, options) : null),
    staleTime: 5 * 60 * 1000, // cache ENS names for 5 minutes
    enabled,
  });
}
