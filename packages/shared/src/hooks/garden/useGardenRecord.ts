import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getGarden } from "../../modules/data/indexer-garden";
import type { Address } from "../../types/domain";

/**
 * One garden's own indexer record, read by id. The base garden list holds a
 * chain's newest 50 gardens only; this reads one past them. `data` is null when
 * the indexer holds no such garden, and a failed read fails like the list does.
 */
export function useGardenRecord(
  gardenId: Address | null,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: gardensKeys.detail(gardenId ?? "", DEFAULT_CHAIN_ID),
    queryFn: () => getGarden(gardenId as Address),
    enabled: enabled && gardenId !== null,
    staleTime: STALE_TIMES.baseLists,
    gcTime: GC_TIMES.baseLists,
    networkMode: "offlineFirst",
  });
}
