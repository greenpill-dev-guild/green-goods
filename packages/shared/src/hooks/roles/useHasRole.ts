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
}

export function useHasRole(
  gardenAddress?: Address | null,
  userAddress?: Address | null,
  role?: GardenRole,
  chainId: number = DEFAULT_CHAIN_ID
): UseHasRoleResult {
  const enabled = Boolean(gardenAddress && userAddress && role && !isZeroAddress(gardenAddress));

  const query = useQuery({
    queryKey: roleKeys.hasRole(gardenAddress ?? undefined, userAddress ?? undefined, role),
    queryFn: () =>
      readGardenRole(gardenAddress as Address, userAddress as Address, role as GardenRole, chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    retry: false,
  });

  return {
    hasRole: query.data ?? false,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
