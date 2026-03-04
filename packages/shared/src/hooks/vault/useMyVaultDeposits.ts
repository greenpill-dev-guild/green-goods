import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getVaultDepositsByUser } from "../../modules/data/vaults";
import type { Address } from "../../types/domain";
import type { VaultDeposit } from "../../types/vaults";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseMyVaultDepositsOptions {
  chainId?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useMyVaultDeposits(
  userAddress?: Address,
  options: UseMyVaultDepositsOptions = {}
) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;
  const refetchInterval = options.refetchInterval ?? false;
  const normalizedUser = userAddress?.toLowerCase();

  const query = useQuery({
    queryKey: normalizedUser
      ? queryKeys.vaults.myDepositsByUser(normalizedUser, chainId)
      : queryKeys.vaults.myDepositsByUser("__disabled__", chainId),
    queryFn: () => getVaultDepositsByUser(normalizedUser ?? "", chainId),
    enabled: enabled && Boolean(normalizedUser),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval,
  });

  return {
    ...query,
    deposits: (query.data ?? []) as VaultDeposit[],
  };
}
