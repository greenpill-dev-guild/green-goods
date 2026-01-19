import {
  type QueryKey,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Action, Garden, GardenerCard } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";
import { queryKeys } from "../query-keys";

/**
 * Factory function for creating base list hooks with consistent caching behavior.
 * Reduces code duplication across action, garden, and gardener list hooks.
 *
 * @param getQueryKey - Function to get the query key
 * @param fetchFn - Function to fetch the data
 * @returns A hook that fetches and caches the list data
 */
function createBaseListHook<T>(
  getQueryKey: (chainId: number) => QueryKey,
  fetchFn: () => Promise<T[]>
): (chainId?: number) => UseQueryResult<T[], Error> {
  return function useBaseList(chainId: number = DEFAULT_CHAIN_ID) {
    const queryClient = useQueryClient();
    const queryKey = getQueryKey(chainId);

    return useQuery({
      queryKey,
      queryFn: fetchFn,
      staleTime: STALE_TIMES.baseLists,
      gcTime: GC_TIMES.baseLists,
      // Show cached data immediately if available (from IndexedDB persistence)
      initialData: () => queryClient.getQueryData<T[]>(queryKey),
      initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
      placeholderData: (previousData) => previousData ?? [],
    });
  };
}

/** Fetches and caches the catalog of actions for the active chain. */
export const useActions = createBaseListHook<Action>(
  (chainId) => queryKeys.actions.byChain(chainId),
  getActions
);

/** Retrieves gardens scoped to the active chain and keeps the list warm. */
export const useGardens = createBaseListHook<Garden>(
  (chainId) => queryKeys.gardens.byChain(chainId),
  getGardens
);

/** Loads gardener profiles for operator dashboards. */
export const useGardeners = createBaseListHook<GardenerCard>(
  () => queryKeys.gardeners.all,
  getGardeners
);
