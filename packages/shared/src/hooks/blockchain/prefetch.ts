import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryClient } from "../../config/react-query";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";
import { queryKeys } from "../query-keys";

/** Warms the TanStack Query cache with baseline lists needed across dashboards. */
export function ensureBaseLists(chainId: number = DEFAULT_CHAIN_ID) {
  const actionsPromise = queryClient.ensureQueryData({
    queryKey: queryKeys.actions.byChain(chainId),
    queryFn: () => getActions(),
  });
  const gardensPromise = queryClient.ensureQueryData({
    queryKey: queryKeys.gardens.byChain(chainId),
    queryFn: () => getGardens(),
  });
  const gardenersPromise = queryClient.ensureQueryData({
    queryKey: queryKeys.gardeners.all,
    queryFn: () => getGardeners(),
  });

  return { actionsPromise, gardensPromise, gardenersPromise };
}

/** Prefetches base lists and resolves their values for use in loaders or SSR. */
export async function ensureHomeData(chainId: number = DEFAULT_CHAIN_ID) {
  const { actionsPromise, gardensPromise, gardenersPromise } = ensureBaseLists(chainId);
  const [actions, gardens, gardeners] = await Promise.all([
    actionsPromise,
    gardensPromise,
    gardenersPromise,
  ]);
  return { actions, gardens, gardeners };
}
