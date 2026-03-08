/**
 * Garden Roles Hook
 *
 * Fetches all Hats roles for a specific user + garden.
 * Works for both v1 and v2 gardens via GardenAccount role views.
 */

import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS, type GardenRole } from "../../utils/blockchain/garden-roles";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export interface UseGardenRolesResult {
  roles: GardenRole[];
  isLoading: boolean;
  error?: Error | null;
}

async function fetchGardenRoles(
  gardenAddress: Address,
  userAddress: Address,
  chainId: number
): Promise<GardenRole[]> {
  const entries = Object.entries(GARDEN_ROLE_FUNCTIONS) as Array<
    [GardenRole, (typeof GARDEN_ROLE_FUNCTIONS)[GardenRole]]
  >;

  const results = await Promise.all(
    entries.map(async ([role, fn]) => {
      try {
        const hasRole = await readContract(wagmiConfig, {
          address: gardenAddress,
          abi: GardenAccountABI,
          functionName: fn,
          args: [userAddress],
          chainId,
        });
        return { role, hasRole: Boolean(hasRole) };
      } catch {
        return { role, hasRole: false };
      }
    })
  );

  return results.filter((entry) => entry.hasRole).map((entry) => entry.role);
}

/**
 * Hook for checking all roles a user has in a specific garden.
 */
export function useGardenRoles(
  gardenAddress?: Address | null,
  userAddress?: Address | null,
  chainId: number = DEFAULT_CHAIN_ID
): UseGardenRolesResult {
  const enabled = Boolean(gardenAddress && userAddress && !isZeroAddress(gardenAddress));

  const query = useQuery({
    queryKey: queryKeys.role.gardenRoles(gardenAddress ?? undefined, userAddress ?? undefined),
    queryFn: () => fetchGardenRoles(gardenAddress as Address, userAddress as Address, chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    retry: false,
  });

  return {
    roles: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
