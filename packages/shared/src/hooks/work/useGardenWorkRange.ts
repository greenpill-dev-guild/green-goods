import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { type OverlayWork, resolveGardenWorkRows } from "../../modules/work/local-status-overlay";
import { readGardenWorkRange } from "../../modules/work/work-list";
import type { Address, Work } from "../../types/domain";
import { reportConnectivityFailure, useOnlineStatus } from "../app/useOnlineStatus";
import { workVisibilityQuery } from "./useWorkVisibility";

const NO_WORKS: Work[] = [];
const NO_UNKNOWN: ReadonlySet<string> = new Set();

/**
 * Every work a garden received between two moments, for a screen that shows a whole period
 * such as a month or a day. `useWorks` holds only the garden's newest page, so a period read
 * from it would miss older work without saying so. `range` is in seconds, `from` included and
 * `to` not; pass null to read nothing.
 */
export function useGardenWorkRange(
  gardenId: Address | undefined,
  range: { from: number; to: number } | null
) {
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const read = useQuery({
    queryKey: worksKeys.range(gardenId ?? "", chainId, range?.from ?? 0, range?.to ?? 0),
    queryFn: async () => {
      // Disabled without a garden and a range, so neither is missing when this runs.
      if (!gardenId || !range) return { rows: [], complete: true, readThrough: null };
      try {
        return await readGardenWorkRange({
          garden: gardenId,
          chainId,
          from: range.from,
          to: range.to,
          visibility: await queryClient.fetchQuery(workVisibilityQuery(chainId)),
        });
      } catch (error) {
        void reportConnectivityFailure();
        throw error;
      }
    },
    enabled: Boolean(gardenId) && range !== null,
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  // Decisions made on this device, which the indexer may not report yet.
  const overlay = useQuery<OverlayWork[]>({
    queryKey: worksKeys.merged(gardenId ?? "", chainId),
    queryFn: () =>
      queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId ?? "", chainId)) ?? [],
    enabled: false,
  });
  const { works, unknownIds } = useMemo(() => {
    if (!read.data) return { works: NO_WORKS, unknownIds: NO_UNKNOWN };
    const resolved = resolveGardenWorkRows({
      remote: read.data.rows,
      saved: undefined,
      overlay: overlay.data,
    });
    return { works: resolved.rows as Work[], unknownIds: resolved.unknownIds };
  }, [read.data, overlay.data]);

  return {
    /** The period's works, oldest first. */
    works,
    /** Works whose review status could not be read: unknown, never guessed as pending. */
    unknownIds,
    /** False when the period holds more works than one read lists. */
    complete: read.data?.complete ?? true,
    /** Where a cut read stopped (seconds): later works are missing. Null when read in full. */
    readThrough: read.data?.readThrough ?? null,
    hasRead: read.data !== undefined,
    isLoading: isOnline && read.isPending && range !== null && Boolean(gardenId),
    isFetching: read.isFetching,
    isError: read.isError,
    isPaused: !isOnline || read.isPaused,
    refetch: read.refetch,
  };
}
