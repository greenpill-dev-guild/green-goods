import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { getGardenMemberHistory } from "../../modules/data/garden-member-history";
import type { Address } from "../../types/domain";

/** Optional metadata only; these dates never grant or revoke membership. */
export function useGardenMemberHistory({
  garden,
  account,
  chainId = DEFAULT_CHAIN_ID,
}: {
  garden?: Address;
  account?: Address;
  chainId?: number;
}) {
  const query = useQuery({
    queryKey: gardensKeys.memberHistory(garden, account, chainId),
    queryFn: ({ signal }) =>
      getGardenMemberHistory({ garden, account, chainId }, undefined, signal),
    enabled: Boolean(garden || account),
    staleTime: 30_000,
    retry: false,
  });
  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
