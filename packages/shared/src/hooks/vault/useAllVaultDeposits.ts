import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getAllVaultDeposits } from "../../modules/data/vaults";
import type { VaultDeposit } from "../../types/vaults";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { vaultsKeys } from "../../config/query-keys/vault";

/** Stable empty array to avoid referential instability in downstream hooks. */
const EMPTY_DEPOSITS: VaultDeposit[] = [];

interface UseAllVaultDepositsOptions {
  chainId?: number;
  enabled?: boolean;
}

/**
 * Fetches all vault deposits across all gardens for a chain.
 * Used for the protocol-wide ranked funder view.
 */
export function useAllVaultDeposits(options: UseAllVaultDepositsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: vaultsKeys.allDeposits(chainId),
    queryFn: () => getAllVaultDeposits(chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    deposits: query.data ?? EMPTY_DEPOSITS,
  };
}
