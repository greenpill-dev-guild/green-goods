import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";
import { queryKeys } from "../query-keys";

/** Fetches and caches the catalog of actions for the active chain. */
export function useActions(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.actions.byChain(chainId),
    queryFn: () => getActions(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    placeholderData: (previousData) => previousData ?? [],
  });
}

/** Retrieves gardens scoped to the active chain and keeps the list warm. */
export function useGardens(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.gardens.byChain(chainId),
    queryFn: () => getGardens(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    placeholderData: (previousData) => previousData ?? [],
  });
}

/** Loads gardener profiles for operator dashboards. */
export function useGardeners() {
  return useQuery({
    queryKey: queryKeys.gardeners.all,
    queryFn: () => getGardeners(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    placeholderData: (previousData) => previousData ?? [],
  });
}
