import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { roleKeys } from "../../config/query-keys/identity";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { readGardenRoleHat } from "../../utils/blockchain/garden-role-reads";
import type { GardenRole } from "../../utils/blockchain/garden-roles";

/**
 * Reads from the chain which of the given roles a person still lacks, so restoring a missing
 * sub-role asks the wallet only for what the chain is actually missing. The indexed roster can
 * lag a grant. Resolves to `null` when any read fails: nothing should be sent on a guess.
 */
export function useSubRoleCheck(gardenAddress?: Address, chainId = DEFAULT_CHAIN_ID) {
  const queryClient = useQueryClient();
  return useCallback(
    async (account: Address, roles: readonly GardenRole[]): Promise<GardenRole[] | null> => {
      if (!gardenAddress) return null;
      try {
        const worn = await Promise.all(
          roles.map((role) =>
            queryClient.fetchQuery({
              queryKey: roleKeys.roleHat(
                gardenAddress.toLowerCase(),
                account.toLowerCase(),
                role,
                chainId
              ),
              queryFn: () => readGardenRoleHat(gardenAddress, account, role, chainId),
              staleTime: 0,
              retry: false,
            })
          )
        );
        return roles.filter((_, index) => !worn[index]);
      } catch (error) {
        logger.warn("Sub-role check failed", { error, gardenAddress });
        return null;
      }
    },
    [queryClient, gardenAddress, chainId]
  );
}
