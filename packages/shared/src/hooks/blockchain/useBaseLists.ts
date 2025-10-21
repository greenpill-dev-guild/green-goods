import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";

/** Fetches and caches the catalog of actions for the active chain. */
export function useActions(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ["actions", chainId],
    queryFn: () => getActions(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Retrieves gardens scoped to the active chain and keeps the list warm. */
export function useGardens(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ["gardens", chainId],
    queryFn: () => getGardens(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Loads gardener profiles for operator dashboards. */
export function useGardeners() {
  return useQuery({
    queryKey: ["gardeners"],
    queryFn: () => getGardeners(),
    staleTime: 5 * 60 * 1000,
  });
}
