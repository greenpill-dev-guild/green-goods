import { useQuery } from "@tanstack/react-query";

import type { Address } from "viem";
import type { AttestationFilters, HypercertAttestation } from "../../types/hypercerts";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getWorkApprovals, getWorks } from "../../modules/data/eas";
import { extractWorkMetadata, applyAttestationFilters } from "../../modules/data/hypercerts";
import { logger } from "../../modules/app/logger";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export interface UseAttestationsResult {
  attestations: HypercertAttestation[];
  isLoading: boolean;
  error: Error | null;
  hasError: boolean;
  /** Triggers a refetch and returns a promise that resolves when complete */
  refetch: () => Promise<HypercertAttestation[]>;
}

export type { AttestationFilters };

/**
 * Fetches approved work attestations for a garden.
 *
 * Uses the same data fetching approach as useWorks - fetches works and approvals
 * from EAS, joins them, and filters for approved status.
 */
export function useAttestations(
  gardenId?: string,
  filters?: AttestationFilters
): UseAttestationsResult {
  const chainId = DEFAULT_CHAIN_ID;

  const query = useQuery({
    queryKey: queryKeys.hypercerts.attestations(gardenId, filters),
    queryFn: async (): Promise<HypercertAttestation[]> => {
      if (!gardenId) return [];

      // Fetch works and approvals in parallel - same as useWorks
      const [works, approvals] = await Promise.all([
        getWorks(gardenId, chainId),
        getWorkApprovals(undefined, chainId),
      ]);

      // Build approval map by workUID - same join logic as useWorks
      const approvalMap = new Map(approvals.map((approval) => [approval.workUID, approval]));

      // Join works with approvals and filter for approved
      const attestations: HypercertAttestation[] = [];

      for (const work of works) {
        const approval = approvalMap.get(work.id);

        // Skip works without approval or not approved
        if (!approval || !approval.approved) {
          continue;
        }

        const metadata = extractWorkMetadata(work.metadata);

        attestations.push({
          id: approval.id,
          uid: approval.id,
          workUid: work.id,
          gardenId: work.gardenAddress,
          title: work.title || "Untitled work",
          actionType: metadata.actionType,
          domain: metadata.domain,
          workScope: metadata.workScope ?? [],
          gardenerAddress: work.gardenerAddress as Address,
          gardenerName: null,
          mediaUrls: work.media ?? [],
          metrics: metadata.metrics ?? null,
          createdAt: work.createdAt,
          approvedAt: approval.createdAt,
          approvedBy: approval.operatorAddress as Address,
          feedback: approval.feedback || null,
        });
      }

      // Sort by approvedAt descending (most recent first)
      attestations.sort((a, b) => b.approvedAt - a.approvedAt);

      return applyAttestationFilters(attestations, filters);
    },
    enabled: Boolean(gardenId),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    attestations: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error) ?? null,
    hasError: Boolean(query.error),
    refetch: async () => {
      try {
        const result = await query.refetch();
        return result.data ?? [];
      } catch (error) {
        logger.error("[useAttestations] Refetch failed", {
          gardenId,
          filters,
          error: error instanceof Error ? error.stack || error.message : String(error),
        });
        throw error;
      }
    },
  };
}
