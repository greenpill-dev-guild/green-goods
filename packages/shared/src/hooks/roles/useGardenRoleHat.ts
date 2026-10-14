/**
 * Exact role-hat check for one account in one garden, read from chain.
 */

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_FAST } from "../../config/query-keys/constants";
import { roleKeys } from "../../config/query-keys/identity";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { readGardenRoleHat } from "../../utils/blockchain/garden-role-reads";
import type { GardenRole } from "../../utils/blockchain/garden-roles";

export interface UseGardenRoleHatResult {
  /** Whether the account wears the role's exact hat; undefined until the chain answers. */
  wearsHat: boolean | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Whether `account` wears the exact hat for `role` in `gardenAddress`: the
 * membership `grantRole` checks, not the inclusive permission view. Use it to
 * check an indexed roster before acting on it, since the roster can lag a grant
 * or a revoke. Pass `enabled: false` when the answer cannot change a decision
 * (for example, the person is already queued), so reads stay purposeful.
 */
export function useGardenRoleHat(
  gardenAddress?: Address | null,
  account?: Address | null,
  role?: GardenRole,
  { enabled = true, chainId = DEFAULT_CHAIN_ID }: { enabled?: boolean; chainId?: number } = {}
): UseGardenRoleHatResult {
  const canRead = Boolean(
    enabled && gardenAddress && account && role && !isZeroAddress(gardenAddress)
  );

  const query = useQuery({
    queryKey: roleKeys.roleHat(gardenAddress?.toLowerCase(), account?.toLowerCase(), role, chainId),
    queryFn: () =>
      readGardenRoleHat(gardenAddress as Address, account as Address, role as GardenRole, chainId),
    enabled: canRead,
    staleTime: STALE_TIME_FAST,
    retry: false,
  });

  return {
    wearsHat: query.data,
    isLoading: canRead && query.isLoading,
    isError: query.isError,
  };
}
