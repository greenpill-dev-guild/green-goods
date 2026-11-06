import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getGarden } from "../../modules/data/indexer-garden";
import {
  getGardenFenceFilters,
  getServerGardenFenceFilters,
  subscribeToGardenFences,
} from "../../modules/garden/garden-departures";
import type { Address } from "../../types/domain";

/** Share the same detail cache between individual and batched garden lookups. */
export function getGardenRecordOptions(gardenId: Address) {
  return {
    queryKey: gardensKeys.detail(gardenId, DEFAULT_CHAIN_ID),
    queryFn: () => getGarden(gardenId),
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    networkMode: "offlineFirst" as const,
  };
}

/**
 * One garden's own indexer record, read by id. The base garden list holds a
 * chain's newest 50 gardens only; this reads one past them. `data` is null when
 * the indexer holds no such garden, and a failed read fails like the list does.
 */
export function useGardenRecord(
  gardenId: Address | null,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const fences = useSyncExternalStore(
    subscribeToGardenFences,
    getGardenFenceFilters,
    getServerGardenFenceFilters
  );
  return useQuery({
    ...getGardenRecordOptions(gardenId ?? "0x"),
    enabled: enabled && gardenId !== null,
    select: (garden) => (garden ? fences.roster([garden], DEFAULT_CHAIN_ID)[0] : garden),
  });
}
