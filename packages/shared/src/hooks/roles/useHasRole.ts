/**
 * Single role check hook for a user + garden.
 */

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { readGardenRole } from "../../utils/blockchain/garden-role-reads";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { roleKeys } from "../../config/query-keys/identity";

export interface UseHasRoleResult {
  /** False until the chain says yes, and after a failed read. */
  hasRole: boolean;
  isLoading: boolean;
  /** Set when the read failed: then `hasRole` is false because the answer is unknown. */
  error?: Error | null;
  /** The chain is being asked, the first time or again. */
  isFetching: boolean;
  /** Ask the chain again, as a retry after a failed read does. */
  refetch: () => Promise<unknown>;
}

/**
 * The chain's answer to whether an account may act as `role` in a garden (`readGardenRole`), as
 * one query. A list that asks it for several gardens at once (`useQueries`) shares each answer
 * with the single checks here.
 */
export function hasRoleQuery(
  gardenAddress?: Address | null,
  userAddress?: Address | null,
  role?: GardenRole,
  chainId: number = DEFAULT_CHAIN_ID
) {
  return {
    queryKey: roleKeys.hasRole(gardenAddress ?? undefined, userAddress ?? undefined, role),
    queryFn: () =>
      readGardenRole(gardenAddress as Address, userAddress as Address, role as GardenRole, chainId),
    enabled: Boolean(gardenAddress && userAddress && role && !isZeroAddress(gardenAddress)),
    staleTime: STALE_TIME_MEDIUM,
    retry: false,
  };
}

export function useHasRole(
  gardenAddress?: Address | null,
  userAddress?: Address | null,
  role?: GardenRole,
  chainId: number = DEFAULT_CHAIN_ID
): UseHasRoleResult {
  const query = useQuery(hasRoleQuery(gardenAddress, userAddress, role, chainId));

  return {
    hasRole: query.data ?? false,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
