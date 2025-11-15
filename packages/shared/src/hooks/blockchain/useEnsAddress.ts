import { useQuery } from "@tanstack/react-query";
import { resolveEnsAddress } from "../../utils/blockchain/ens";

type UseEnsAddressOptions = {
  enabled?: boolean;
  chainId?: number;
};

export function useEnsAddress(name?: string | null, options: UseEnsAddressOptions = {}) {
  const normalized = name?.trim().toLowerCase() ?? null;
  const enabled = options.enabled ?? Boolean(normalized);

  return useQuery({
    queryKey: ["ens-address", normalized],
    queryFn: async () => (normalized ? resolveEnsAddress(normalized, options) : null),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
