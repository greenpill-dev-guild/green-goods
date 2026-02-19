import { useQuery } from "@tanstack/react-query";
import type { Address } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getVaultDeposits } from "../../modules/data/vaults";
import type { VaultDeposit } from "../../types/vaults";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseVaultDepositsOptions {
  chainId?: number;
  userAddress?: Address;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useVaultDeposits(gardenAddress?: Address, options: UseVaultDepositsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;
  const refetchInterval = options.refetchInterval ?? false;
  const normalizedGarden = gardenAddress?.toLowerCase();
  const normalizedUser = options.userAddress?.toLowerCase();

  const query = useQuery({
    queryKey:
      normalizedGarden && normalizedUser
        ? queryKeys.vaults.myDeposits(normalizedGarden, normalizedUser, chainId)
        : queryKeys.vaults.deposits(normalizedGarden ?? "__disabled__", chainId),
    queryFn: () => getVaultDeposits(normalizedGarden ?? "", chainId, normalizedUser),
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval,
  });

  return {
    ...query,
    deposits: (query.data ?? []) as VaultDeposit[],
  };
}
