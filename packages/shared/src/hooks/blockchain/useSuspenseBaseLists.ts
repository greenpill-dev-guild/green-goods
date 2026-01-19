import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import type { Action, Garden, GardenerCard } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions, getGardeners, getGardens } from "../../modules/data/greengoods";
import { queryKeys } from "../query-keys";

/**
 * Suspense-enabled hooks for base lists
 *
 * These hooks use React 19's Suspense integration with TanStack Query v5.
 * They will throw a promise while loading, which must be caught by a Suspense boundary.
 *
 * IMPORTANT: Only use these hooks inside a SuspenseBoundary component.
 *
 * @example
 * import { SuspenseBoundary } from "@/components/Boundaries";
 * import { useSuspenseGardens } from "@green-goods/shared/hooks";
 *
 * function GardenList() {
 *   // This will suspend while loading - no need to check isLoading!
 *   const { data: gardens } = useSuspenseGardens();
 *   return <div>{gardens.map(g => <GardenCard key={g.id} {...g} />)}</div>;
 * }
 *
 * // Wrap with SuspenseBoundary
 * <SuspenseBoundary fallback={<GardenListSkeleton />}>
 *   <GardenList />
 * </SuspenseBoundary>
 */

/**
 * Suspense-enabled hook for fetching gardens
 *
 * This hook will throw a promise while loading, which will be caught
 * by a Suspense boundary. The data is guaranteed to be available
 * when the component renders.
 *
 * @param chainId - Optional chain ID, defaults to DEFAULT_CHAIN_ID
 * @returns Query result with guaranteed data (no undefined)
 * @throws Error if chainId is not DEFAULT_CHAIN_ID (multi-chain not yet implemented)
 */
export function useSuspenseGardens(chainId: number = DEFAULT_CHAIN_ID) {
  // Guard: Only DEFAULT_CHAIN_ID is currently supported
  if (chainId !== DEFAULT_CHAIN_ID) {
    throw new Error(
      `useSuspenseGardens: chainId ${chainId} is not supported. ` +
        `Only DEFAULT_CHAIN_ID (${DEFAULT_CHAIN_ID}) is currently implemented.`
    );
  }

  const queryClient = useQueryClient();
  const queryKey = queryKeys.gardens.byChain(chainId);

  return useSuspenseQuery({
    queryKey,
    queryFn: () => getGardens(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    // Show cached data immediately if available
    initialData: () => queryClient.getQueryData<Garden[]>(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
  });
}

/**
 * Suspense-enabled hook for fetching actions
 *
 * @param chainId - Optional chain ID, defaults to DEFAULT_CHAIN_ID
 * @returns Query result with guaranteed data (no undefined)
 * @throws Error if chainId is not DEFAULT_CHAIN_ID (multi-chain not yet implemented)
 */
export function useSuspenseActions(chainId: number = DEFAULT_CHAIN_ID) {
  // Guard: Only DEFAULT_CHAIN_ID is currently supported
  if (chainId !== DEFAULT_CHAIN_ID) {
    throw new Error(
      `useSuspenseActions: chainId ${chainId} is not supported. ` +
        `Only DEFAULT_CHAIN_ID (${DEFAULT_CHAIN_ID}) is currently implemented.`
    );
  }

  const queryClient = useQueryClient();
  const queryKey = queryKeys.actions.byChain(chainId);

  return useSuspenseQuery({
    queryKey,
    queryFn: () => getActions(),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    initialData: () => queryClient.getQueryData<Action[]>(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
  });
}

/**
 * Suspense-enabled hook for fetching gardeners
 *
 * @returns Query result with guaranteed data (no undefined)
 */
export function useSuspenseGardeners() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.gardeners.all;

  return useSuspenseQuery({
    queryKey,
    queryFn: getGardeners,
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    initialData: () => queryClient.getQueryData<GardenerCard[]>(queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKey)?.dataUpdatedAt,
  });
}
