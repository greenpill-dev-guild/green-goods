/**
 * Single role check hook for a user + garden.
 */

import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS, type GardenRole } from "../../utils/blockchain/garden-roles";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

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
  const functionName = GARDEN_ROLE_FUNCTIONS[role];
  try {
    const result = await readContract(getWagmiConfig(), {
      address: gardenAddress,
      abi: GardenAccountABI,
      functionName,
      args: [userAddress],
      chainId,
    });

    return Boolean(result);
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
    queryKey: queryKeys.role.hasRole(gardenAddress ?? undefined, userAddress ?? undefined, role),
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
