import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { roleKeys } from "../../config/query-keys/identity";
import { logger } from "../../modules/app/logger";
import { getGardenMemberHistory } from "../../modules/data/garden-member-history";
import type { Address } from "../../types/domain";
import { readGardenRoleHat } from "../../utils/blockchain/garden-role-reads";
import type { GardenRole } from "../../utils/blockchain/garden-roles";

/**
 * Reads, when a restore is pressed, which of the given roles a person still lacks on the chain and
 * every role their history records. The roster and the history a dialog rendered can both lag: a
 * role granted and revoked since then, an Owner grant included, has to rule a sub-role out before
 * the wallet opens, and only the history can say so. Resolves to `null` when any read fails or the
 * history has no row for the person: nothing should be sent on a guess.
 */
export function useSubRoleCheck(gardenAddress?: Address, chainId = DEFAULT_CHAIN_ID) {
  const queryClient = useQueryClient();
  return useCallback(
    async (
      account: Address,
      roles: readonly GardenRole[]
    ): Promise<{ lacking: GardenRole[]; recordedRoles: GardenRole[] } | null> => {
      if (!gardenAddress) return null;
      try {
        const [worn, history] = await Promise.all([
          Promise.all(
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
          ),
          queryClient.fetchQuery({
            queryKey: gardensKeys.memberHistory(gardenAddress, account, chainId),
            queryFn: ({ signal }) =>
              getGardenMemberHistory(
                { garden: gardenAddress, account, chainId },
                undefined,
                signal
              ),
            staleTime: 0,
            retry: false,
          }),
        ]);
        const recordedRoles = history.find(
          (member) => member.account.toLowerCase() === account.toLowerCase()
        )?.recordedRoles;
        if (!recordedRoles) return null;
        return {
          lacking: roles.filter((_, index) => !worn[index]),
          recordedRoles: [...recordedRoles],
        };
      } catch (error) {
        logger.warn("Sub-role check failed", { error, gardenAddress });
        return null;
      }
    },
    [queryClient, gardenAddress, chainId]
  );
}
