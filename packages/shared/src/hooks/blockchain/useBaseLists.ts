import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";
import { queryKeys } from "../query-keys";

/** Fetches and caches the catalog of actions for the active chain. */
export function useActions(chainId: number = DEFAULT_CHAIN_ID) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.actions.byChain(chainId);

  return useQuery({
    queryKey,
    queryFn: () => getActions(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    // Show cached data immediately if available (from IndexedDB persistence)
    initialData: () => queryClient.getQueryData(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
    placeholderData: (previousData) => previousData ?? [],
  });
}

/** Retrieves gardens scoped to the active chain and keeps the list warm. */
export function useGardens(chainId: number = DEFAULT_CHAIN_ID) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.gardens.byChain(chainId);

  return useQuery({
    queryKey,
    queryFn: () => getGardens(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    // Show cached data immediately if available (from IndexedDB persistence)
    initialData: () => queryClient.getQueryData(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
    placeholderData: (previousData) => previousData ?? [],
  });
}

/** Loads gardener profiles for operator dashboards. */
export function useGardeners() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.gardeners.all;

  return useQuery({
    queryKey,
    queryFn: () => getGardeners(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    initialData: () => queryClient.getQueryData(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
    placeholderData: (previousData) => previousData ?? [],
  });
}
