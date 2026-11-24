import type { Query, QueryClient } from "@tanstack/react-query";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { readWorkList, WORK_LIST_PAGE_SIZE } from "../../modules/work/work-list";
import type { EASWorkListRow } from "../../types/eas-responses";
import { reportConnectivityFailure } from "../app/useOnlineStatus";
import { workVisibilityQuery } from "./useWorkVisibility";

let sessionStartedAt: number | undefined;
/** Gardens whose work list this session has read, as only the read itself records. */
const readThisSession = new Set<string>();

/**
 * Whether this session has read the garden's work list. Only a successful read counts: a status
 * this device writes into the cached list, such as a decision it just made, never does.
 */
export function gardenReadThisSession(gardenId: string, chainId: number): boolean {
  return readThisSession.has(JSON.stringify(worksKeys.online(gardenId, chainId)));
}

/**
 * When this app session first read garden work: rows read before it were
 * restored from storage. Taken at first use rather than at module load, so a
 * clock installed after load, such as Storybook's frozen one, agrees with it.
 */
export function workSessionStartedAt(): number {
  sessionStartedAt ??= Date.now();
  return sessionStartedAt;
}

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
        const rows = await readWorkList({
          garden: gardenId,
          chainId,
          visibility: await queryClient.fetchQuery(workVisibilityQuery(chainId)),
          // The extra row is the continuation signal. Preserve a wider cached
          // read when a background refresh arrives after its window query GC'd.
          take: Math.max(requested + 1, cached?.length ?? 0),
        });
        readThisSession.add(JSON.stringify(queryKey));
        return rows;
      } catch (error) {
        void reportConnectivityFailure();
        throw error;
      }
    },
    enabled: Boolean(gardenId),
    networkMode: "online" as const,
    // Rows restored from an earlier session are stale however recent they are,
    // so a screen that opens on them reads the garden again: queue health can
    // prove a stall only from a read in this session.
    staleTime: (query: Query<EASWorkListRow[]>) =>
      query.state.dataUpdatedAt < workSessionStartedAt() ? 0 : STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  };
}
