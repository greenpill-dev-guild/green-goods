import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getAllVaultDeposits } from "../../modules/data/vaults";
import type { VaultDeposit } from "../../types/vaults";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

/** Stable empty array to avoid referential instability in downstream hooks. */
const EMPTY_DEPOSITS: VaultDeposit[] = [];

interface UseAllVaultDepositsOptions {
  chainId?: number;
  enabled?: boolean;
}

/**
 * Fetches all vault deposits across all gardens for a chain.
 * Used for the protocol-wide funder leaderboard.
 */
export function useAllVaultDeposits(options: UseAllVaultDepositsOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: queryKeys.vaults.allDeposits(chainId),
    queryFn: () => getAllVaultDeposits(chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    deposits: query.data ?? EMPTY_DEPOSITS,
  };
}
