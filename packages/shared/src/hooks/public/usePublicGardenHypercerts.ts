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
      return getPublicGardenHypercerts(gardenId, chainId);
    },
    staleTime: STALE_TIME_MEDIUM,
  });
  const records = query.data ?? [];
  const metadata = useQuery({
    queryKey: publicKeys.gardenCertificateMetadata(gardenId ?? "none", chainId, records),
    enabled: query.isSuccess && records.length > 0,
    queryFn: () => hydrateHypercertRecords(records, chainId),
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    hypercerts: records.map((record) => ({
      ...record,
      title: metadata.data?.[record.id]?.title ?? record.title,
      description: metadata.data?.[record.id]?.description ?? record.description,
      imageUri: metadata.data?.[record.id]?.imageUri ?? record.imageUri,
      workScopes: metadata.data?.[record.id]?.workScopes ?? record.workScopes,
    })),
    isLoading: query.isLoading,
    hasError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
