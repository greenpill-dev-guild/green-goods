/**
 * Fetch FractionPurchased events for a hypercert to display trade history.
 */
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config";
import { logger } from "../../modules/app/logger";
import { getTradeHistory } from "../../modules/data/marketplace";
import type { FractionTrade } from "../../types/hypercerts";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export interface UseTradeHistoryResult {
  trades: FractionTrade[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTradeHistory(hypercertId?: bigint): UseTradeHistoryResult {
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.marketplace.tradeHistory(hypercertId?.toString() ?? "", chainId),
    queryFn: () => {
      logger.debug("[useTradeHistory] Fetching trade history", {
        hypercertId: hypercertId?.toString(),
        chainId,
      });
      return getTradeHistory(hypercertId!, chainId);
    },
    enabled: hypercertId !== undefined && hypercertId !== null,
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    trades: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
