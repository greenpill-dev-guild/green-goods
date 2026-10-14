/**
 * useGardenMembership Hook
 *
 * Whether an account holds any role in a garden, read from chain the way the
 * contract and the queue's send gate test it (`readGardenMembership`). Unlike
 * `useHasRole`, a failed read stays unknown instead of reading as "no", so a
 * screen can say it could not check rather than tell a member to join.
 *
 * @module hooks/roles/useGardenMembership
 */

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { roleKeys } from "../../config/query-keys/identity";
import { isZeroAddress } from "../../utils/blockchain/address";
import { readGardenMembership } from "../../utils/blockchain/garden-role-reads";

export function useGardenMembership(
  gardenAddress?: Address | null,
  userAddress?: Address | null,
  chainId: number = DEFAULT_CHAIN_ID
): { isMember: boolean | null; isLoading: boolean; isError: boolean; refetch: () => void } {
  const enabled = Boolean(gardenAddress && userAddress && !isZeroAddress(gardenAddress));
  const query = useQuery({
    queryKey: roleKeys.membership(gardenAddress ?? undefined, userAddress ?? undefined, chainId),
    queryFn: async () => {
      const answer = await readGardenMembership(
        gardenAddress as Address,
        userAddress as Address,
        chainId
      );
      if (answer === null) throw new Error("Garden membership could not be read");
      return answer;
    },
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    retry: 1,
  });

  return {
    isMember: query.isSuccess ? query.data : null,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
