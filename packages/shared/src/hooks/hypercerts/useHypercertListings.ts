/**
 * Fetch all registered marketplace orders for a garden's hypercerts.
 * Combines on-chain adapter reads with listing status derivation.
 */
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import { getRegisteredOrders } from "../../modules/data/marketplace";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { RegisteredOrderView } from "../../types/hypercerts";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { marketplaceKeys } from "../../config/query-keys/hypercert";

export interface UseHypercertListingsResult {
  listings: RegisteredOrderView[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useHypercertListings(gardenAddress?: Address): UseHypercertListingsResult {
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: marketplaceKeys.orders(gardenAddress!, chainId),
    queryFn: () => {
      logger.debug("[useHypercertListings] Fetching orders", { gardenAddress, chainId });
      return getRegisteredOrders(gardenAddress!, chainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    listings: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
