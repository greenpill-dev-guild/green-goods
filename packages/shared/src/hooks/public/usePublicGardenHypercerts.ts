import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { hydrateHypercertRecords } from "../../modules/data/hypercerts-fetch";
import { getPublicGardenHypercerts } from "./publicReportingRecords";

/** A separate public cache prevents reuse of the operational certificate list. */
export function usePublicGardenHypercerts({
  gardenId,
  chainId = DEFAULT_CHAIN_ID,
}: {
  gardenId?: string;
  chainId?: number;
}) {
  const query = useQuery({
    queryKey: publicKeys.gardenDetail(`certificates:${gardenId ?? "none"}`, chainId),
    enabled: Boolean(gardenId),
    queryFn: async () => {
      if (!gardenId) return [];
      const records = await getPublicGardenHypercerts(gardenId, chainId);
      const metadata = await hydrateHypercertRecords(records, chainId);
      return records.map((record) => ({
        ...record,
        title: metadata[record.id]?.title ?? record.title,
        description: metadata[record.id]?.description ?? record.description,
        imageUri: metadata[record.id]?.imageUri ?? record.imageUri,
        workScopes: metadata[record.id]?.workScopes ?? record.workScopes,
      }));
    },
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    hypercerts: query.data ?? [],
    isLoading: query.isLoading,
    hasError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
