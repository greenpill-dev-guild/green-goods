import { useIsRestoring, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { STALE_TIMES } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorkApprovals, getWorks } from "../../modules/data/eas";
import type { EASGardenAssessment, EASWork, EASWorkApproval } from "../../types/eas-responses";
import { queryKeys } from "../query-keys";

export interface PlatformStats {
  totalWorks: number;
  pendingWorks: number;
  approvedWorks: number;
  totalAssessments: number;
  works: EASWork[];
  assessments: EASGardenAssessment[];
  workApprovals: EASWorkApproval[];
}

/**
 * Fetches platform-wide work and assessment counts from EAS.
 *
 * Uses batched queries — all garden addresses in a single `{ recipient: { in: [...] } }` clause
 * rather than N+1 per-garden fetches. Stale time matches baseLists (5 min) since the
 * dashboard doesn't need real-time counts.
 *
 * @param gardenAddresses - Array of garden contract addresses to query works/assessments for
 */
export function usePlatformStats(gardenAddresses: string[]) {
  const chainId = DEFAULT_CHAIN_ID;
  const isRestoring = useIsRestoring();

  // Ref ensures the queryFn always reads the latest addresses without
  // requiring them in the queryKey (which would create a new cache entry
  // every time the address list changes).
  const addressesRef = useRef(gardenAddresses);
  addressesRef.current = gardenAddresses;

  return useQuery({
    queryKey: queryKeys.platform.stats(chainId),
    queryFn: async (): Promise<PlatformStats> => {
      const addresses = addressesRef.current;

      // Use allSettled so one failing EAS query doesn't kill the entire dashboard.
      // Works require garden addresses; assessments and approvals are platform-wide.
      const [worksResult, assessmentsResult, approvalsResult] = await Promise.allSettled([
        addresses.length > 0 ? getWorks(addresses, chainId) : Promise.resolve([] as EASWork[]),
        getGardenAssessments(undefined, chainId),
        getWorkApprovals(undefined, chainId),
      ]);

      const works = worksResult.status === "fulfilled" ? worksResult.value : [];
      const assessments = assessmentsResult.status === "fulfilled" ? assessmentsResult.value : [];
      const workApprovals = approvalsResult.status === "fulfilled" ? approvalsResult.value : [];

      // Log any partial failures so they're visible in dev tools
      if (worksResult.status === "rejected") {
        logger.warn("Failed to fetch works for platform stats", { error: worksResult.reason });
      }
      if (assessmentsResult.status === "rejected") {
        logger.warn("Failed to fetch assessments for platform stats", {
          error: assessmentsResult.reason,
        });
      }
      if (approvalsResult.status === "rejected") {
        logger.warn("Failed to fetch work approvals for platform stats", {
          error: approvalsResult.reason,
        });
      }

      // Build a set of approved work UIDs for accurate pending/approved counts
      const approvedWorkUIDs = new Set(
        workApprovals.filter((a) => a.approved).map((a) => a.workUID)
      );
      const approvedCount = works.filter((w) => approvedWorkUIDs.has(w.id)).length;

      logger.debug("Platform stats fetched", {
        works: works.length,
        assessments: assessments.length,
        workApprovals: workApprovals.length,
      });

      return {
        totalWorks: works.length,
        pendingWorks: works.length - approvedCount,
        approvedWorks: approvedCount,
        totalAssessments: assessments.length,
        works,
        assessments,
        workApprovals,
      };
    },
    staleTime: STALE_TIMES.baseLists,
    // Only gate on cache restoration — NOT on gardenAddresses length.
    // The queryFn handles empty addresses gracefully (returns [] for works).
    // Previously `enabled: gardenAddresses.length > 0` caused data loss:
    // any re-render that briefly emptied gardenAddresses would disable the
    // query, and TQ v5's placeholderData cannot retain data when the observer
    // has no #lastQueryWithDefinedData (first mount / restoration race).
    enabled: !isRestoring,
  });
}
