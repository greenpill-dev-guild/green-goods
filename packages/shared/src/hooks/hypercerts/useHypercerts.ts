import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useMemo } from "react";

import type { HypercertRecord, HypercertStatus } from "../../types/hypercerts";
import {
  getGardenHypercerts,
  getHypercertById,
  getHypercertFromSdkApi,
  hydrateHypercertMetadata,
  hydrateHypercertRecords,
} from "../../modules/data/hypercerts";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";
import { ValidationError } from "../../utils/errors/validation-error";
import { logger } from "../../modules/app/logger";
import { useCurrentChain } from "../blockchain/useChainConfig";

/**
 * Sync status for newly minted hypercerts.
 * Used to show appropriate UI feedback during indexer lag.
 */
export type HypercertSyncStatus = "synced" | "syncing" | "optimistic" | "failed";

/**
 * Optimistic data for a hypercert that was just minted.
 * Passed via React Router navigation state to provide immediate feedback.
 */
export interface OptimisticHypercertData {
  id: string;
  title: string;
  description: string;
  workScopes: string[];
  imageUri?: string;
  attestationCount: number;
  mintedAt: number;
  txHash?: `0x${string}`;
}

export interface UseHypercertsResult {
  hypercerts: HypercertRecord[];
  hypercert: HypercertRecord | null;
  isLoading: boolean;
  error: Error | null;
  hasError: boolean;
  /**
   * Sync status for newly minted hypercerts.
   * - "synced": Data is fully indexed and available
   * - "syncing": Polling for indexer to catch up
   * - "optimistic": Showing optimistic data, indexer not yet caught up
   * - "failed": Failed to fetch after max retries
   */
  syncStatus: HypercertSyncStatus;
  /** Triggers a refetch and returns a promise that resolves when complete */
  refetch: () => Promise<HypercertRecord[] | HypercertRecord | null>;
}

export interface UseHypercertsParams {
  gardenId?: string;
  status?: HypercertStatus;
  hypercertId?: string;
  /**
   * Optimistic data for a newly minted hypercert.
   * When provided, shows this data while polling for indexer sync.
   */
  optimisticData?: OptimisticHypercertData;
}

/** Max polling attempts for newly minted hypercerts */
const MAX_POLL_ATTEMPTS = 10;
/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 2000;

/**
 * Fetches hypercert data with multi-source fallback strategy.
 *
 * Order of precedence:
 * 1. Envio indexer (has garden-specific data like attestationUIDs)
 * 2. SDK API fallback (faster indexing, more reliable for basic data)
 *
 * Returns null only if both sources fail to find the hypercert.
 */
async function fetchHypercertWithFallback(hypercertId: string): Promise<HypercertRecord | null> {
  // Try Envio indexer first (has richer Green Goods data)
  const envioResult = await getHypercertById(hypercertId);
  if (envioResult) {
    return envioResult;
  }

  // Fall back to SDK API (faster indexing for basic hypercert data)
  logger.debug("[useHypercerts] Envio miss, trying SDK API", { hypercertId });
  const sdkResult = await getHypercertFromSdkApi(hypercertId);

  if (sdkResult) {
    // SDK API returns partial data - construct a full HypercertRecord
    return {
      id: sdkResult.id ?? hypercertId,
      tokenId: sdkResult.tokenId ?? 0n,
      gardenId: sdkResult.gardenId ?? "",
      metadataUri: sdkResult.metadataUri ?? "",
      imageUri: sdkResult.imageUri,
      mintedAt: sdkResult.mintedAt ?? 0,
      mintedBy: sdkResult.mintedBy ?? ("0x" as `0x${string}`),
      txHash: sdkResult.txHash ?? ("0x" as `0x${string}`),
      totalUnits: sdkResult.totalUnits ?? 0n,
      claimedUnits: sdkResult.claimedUnits ?? 0n,
      attestationCount: sdkResult.attestationCount ?? 0,
      title: sdkResult.title,
      description: sdkResult.description,
      workScopes: sdkResult.workScopes,
      status: sdkResult.status ?? "active",
      allowlistEntries: [],
    } satisfies HypercertRecord;
  }

  return null;
}

/**
 * Converts optimistic data to a HypercertRecord for display.
 */
function optimisticToRecord(data: OptimisticHypercertData, gardenId?: string): HypercertRecord {
  return {
    id: data.id,
    tokenId: 0n, // Unknown until indexed
    gardenId: gardenId ?? "",
    metadataUri: "",
    imageUri: data.imageUri,
    mintedAt: data.mintedAt,
    mintedBy: "0x" as `0x${string}`, // Unknown from optimistic data
    txHash: data.txHash ?? ("0x" as `0x${string}`),
    totalUnits: 0n,
    claimedUnits: 0n,
    attestationCount: data.attestationCount,
    title: data.title,
    description: data.description,
    workScopes: data.workScopes,
    status: "active",
    allowlistEntries: [],
  };
}

function mergeRecordWithMetadata(
  record: HypercertRecord,
  metadata?: Partial<HypercertRecord>
): HypercertRecord {
  if (!metadata) return record;

  return {
    ...record,
    title: metadata.title ?? record.title,
    description: metadata.description ?? record.description,
    imageUri: metadata.imageUri ?? record.imageUri,
    workScopes: metadata.workScopes ?? record.workScopes,
  };
}

export function useHypercerts(params: UseHypercertsParams = {}): UseHypercertsResult {
  const { gardenId, status, hypercertId, optimisticData } = params;
  const chainId = useCurrentChain();

  // Polling state for newly minted hypercerts
  const [pollAttempts, setPollAttempts] = useState(0);
  const [hasFoundData, setHasFoundData] = useState(false);
  const [syncStatus, setSyncStatus] = useState<HypercertSyncStatus>(
    optimisticData ? "syncing" : "synced"
  );
  const [metadataById, setMetadataById] = useState<Record<string, Partial<HypercertRecord>>>({});

  // Reset polling state when hypercertId changes
  useEffect(() => {
    setPollAttempts(0);
    setHasFoundData(false);
    setSyncStatus(optimisticData ? "syncing" : "synced");
  }, [hypercertId, optimisticData]);

  // Prevent metadata bleed when chain context changes.
  useEffect(() => {
    setMetadataById({});
  }, [chainId]);

  const listQuery = useQuery({
    queryKey: queryKeys.hypercerts.list(gardenId, chainId, status),
    queryFn: () => {
      if (!gardenId) {
        throw new ValidationError("gardenId is required for listing hypercerts");
      }
      return getGardenHypercerts(gardenId, chainId, status);
    },
    enabled: Boolean(gardenId) && !hypercertId,
    staleTime: STALE_TIME_MEDIUM,
  });

  const listMetadataQuery = useQuery({
    queryKey: [
      ...queryKeys.hypercerts.all,
      "metadata",
      "list",
      chainId,
      (listQuery.data ?? [])
        .map((record) => record.id)
        .sort()
        .join(","),
    ] as const,
    queryFn: async () => hydrateHypercertRecords(listQuery.data ?? [], chainId),
    enabled: Boolean(listQuery.data?.length) && !hypercertId,
    staleTime: STALE_TIME_MEDIUM,
  });

  useEffect(() => {
    if (!listMetadataQuery.data) return;
    setMetadataById((current) => ({ ...current, ...listMetadataQuery.data }));
  }, [listMetadataQuery.data]);

  // Should poll: have optimistic data, haven't found real data yet, haven't exceeded attempts
  const shouldPoll = Boolean(optimisticData) && !hasFoundData && pollAttempts < MAX_POLL_ATTEMPTS;

  const detailQuery = useQuery({
    queryKey: queryKeys.hypercerts.detail(hypercertId),
    queryFn: () => {
      if (!hypercertId) return Promise.resolve(null);
      return fetchHypercertWithFallback(hypercertId);
    },
    enabled: Boolean(hypercertId),
    staleTime: STALE_TIME_MEDIUM,
    // Enable polling when we have optimistic data but no real data yet
    refetchInterval: shouldPoll ? POLL_INTERVAL_MS : false,
  });

  const detailMetadataQuery = useQuery({
    queryKey: [
      ...queryKeys.hypercerts.all,
      "metadata",
      "detail",
      chainId,
      hypercertId,
      detailQuery.data?.metadataUri ?? "",
    ] as const,
    queryFn: async () => {
      if (!hypercertId) return null;
      return hydrateHypercertMetadata(hypercertId, detailQuery.data?.metadataUri, chainId);
    },
    enabled: Boolean(hypercertId),
    staleTime: STALE_TIME_MEDIUM,
  });

  useEffect(() => {
    if (!detailMetadataQuery.data || !hypercertId) return;
    setMetadataById((current) => ({
      ...current,
      [hypercertId]: {
        ...(current[hypercertId] ?? {}),
        ...detailMetadataQuery.data,
      },
    }));
  }, [detailMetadataQuery.data, hypercertId]);

  // Track polling attempts and update sync status
  useEffect(() => {
    if (!optimisticData || !hypercertId) return;

    if (detailQuery.data) {
      // Data arrived from indexer - we're synced!
      setHasFoundData(true);
      setSyncStatus("synced");
      logger.info("[useHypercerts] Hypercert synced from indexer", {
        hypercertId,
        attempts: pollAttempts,
      });
    } else if (detailQuery.isFetching && pollAttempts < MAX_POLL_ATTEMPTS) {
      // Still polling - increment attempts
      setPollAttempts((prev) => prev + 1);
    } else if (pollAttempts >= MAX_POLL_ATTEMPTS && !detailQuery.data) {
      // Max attempts reached, fall back to optimistic
      setSyncStatus("optimistic");
      logger.warn("[useHypercerts] Max poll attempts reached, using optimistic data", {
        hypercertId,
        attempts: pollAttempts,
      });
    }
  }, [detailQuery.data, detailQuery.isFetching, optimisticData, hypercertId, pollAttempts]);

  const mergedList = useMemo(
    () =>
      (listQuery.data ?? []).map((record) => mergeRecordWithMetadata(record, metadataById[record.id])),
    [listQuery.data, metadataById]
  );

  const mergedDetail = useMemo(() => {
    if (!detailQuery.data) return null;
    return mergeRecordWithMetadata(detailQuery.data, metadataById[detailQuery.data.id]);
  }, [detailQuery.data, metadataById]);

  const optimisticFallback =
    optimisticData && hypercertId
      ? mergeRecordWithMetadata(
          optimisticToRecord(optimisticData, gardenId),
          metadataById[hypercertId] ?? metadataById[optimisticData.id]
        )
      : optimisticData
        ? optimisticToRecord(optimisticData, gardenId)
        : null;

  const isLoading = listQuery.isLoading || detailQuery.isLoading;
  const error = (listQuery.error as Error) ?? (detailQuery.error as Error) ?? null;

  // Determine the hypercert to return:
  // 1. Real indexed data if available
  // 2. Optimistic data as fallback
  const hypercert = mergedDetail ?? optimisticFallback;

  const refetch = useCallback(async () => {
    if (hypercertId) {
      const result = await detailQuery.refetch();
      return result.data ?? null;
    }
    const result = await listQuery.refetch();
    return result.data ?? [];
  }, [hypercertId, detailQuery, listQuery]);

  return {
    hypercerts: mergedList,
    hypercert,
    isLoading: isLoading && !optimisticData, // Don't show loading if we have optimistic data
    error,
    hasError: Boolean(error),
    syncStatus,
    refetch,
  };
}
