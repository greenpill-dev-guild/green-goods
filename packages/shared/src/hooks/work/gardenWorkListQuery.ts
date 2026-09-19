import type { QueryClient } from "@tanstack/react-query";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { readWorkList, WORK_LIST_PAGE_SIZE } from "../../modules/work/work-list";
import type { EASWorkListRow } from "../../types/eas-responses";
import { reportConnectivityFailure } from "../app/useOnlineStatus";

/**
 * The query every screen uses to read a garden's work list. The garden Work
 * tab, the Work Dashboard, and offline preparation share this cache entry, so
 * they must read it the same way: the garden's shared window plus one lookahead
 * row, pausing offline instead of failing.
 */
export function gardenWorkListQuery(queryClient: QueryClient, gardenId: string, chainId: number) {
  const queryKey = worksKeys.online(gardenId, chainId);
  return {
    queryKey,
    queryFn: async (): Promise<EASWorkListRow[]> => {
      try {
        const cached = queryClient.getQueryData<EASWorkListRow[]>(queryKey);
        const requested =
          queryClient.getQueryData<number>(worksKeys.window(gardenId, chainId)) ??
          WORK_LIST_PAGE_SIZE;
        return await readWorkList({
          garden: gardenId,
          chainId,
          // The extra row is the continuation signal. Preserve a wider cached
          // read when a background refresh arrives after its window query GC'd.
          take: Math.max(requested + 1, cached?.length ?? 0),
        });
      } catch (error) {
        void reportConnectivityFailure();
        throw error;
      }
    },
    enabled: Boolean(gardenId),
    networkMode: "online" as const,
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  };
}
