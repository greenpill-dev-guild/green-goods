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
  hasRole: boolean;
  isLoading: boolean;
  error?: Error | null;
}

async function fetchHasRole(
  gardenAddress: Address,
  userAddress: Address,
  role: GardenRole,
  chainId: number
): Promise<boolean> {
  try {
    return await readGardenRole(gardenAddress, userAddress, role, chainId);
  } catch {
    return false;
  }
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
      fetchHasRole(gardenAddress as Address, userAddress as Address, role as GardenRole, chainId),
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
