import { useQuery } from "@tanstack/react-query";
import { type WorkApproval } from "../../types/domain";
import { DEFAULT_CHAIN_ID, getEASConfig } from "../../config/blockchain";
import { parseWorkApprovalAttestation } from "../../modules/data/eas";
import { easGraphQL } from "../../modules/data/graphql";
import { createEasClient } from "../../modules/data/graphql-client";
import { logger } from "../../modules/app/logger";
import { queryKeys, STALE_TIME_MEDIUM, STALE_TIME_RARE } from "../query-keys";

// Enhanced work approval interface for UI
export interface EnhancedWorkApproval extends WorkApproval {
  type: "work_approval";
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  size: number;
  gardenName?: string;
  // Add missing properties that UI expects
  title: string;
  description: string;
  gardenId: string;
}

// Function to get work approvals by attester address
async function getWorkApprovalsByAttester(
  attesterAddress: string,
  chainId: number
): Promise<WorkApproval[]> {
  try {
    const QUERY = easGraphQL(/* GraphQL */ `
      query Attestations($where: AttestationWhereInput) {
        attestations(where: $where) {
          id
          attester
          recipient
          timeCreated
          decodedDataJson
        }
      }
    `);

    const easConfig = getEASConfig(chainId);
    const client = createEasClient(chainId);

    const { data, error } = await client.query(
      QUERY,
      {
        where: {
          schemaId: { equals: easConfig.WORK_APPROVAL.uid },
          attester: { equals: attesterAddress }, // Filter by attester (reviewer)
        },
      },
      "getWorkApprovalsByAttester"
    );

    if (error) {
      return []; // Return empty array instead of throwing
    }
    if (!data) {
      return [];
    }

    return (data.attestations as unknown[]).flatMap((attestation: unknown) => {
      try {
        const att = attestation as {
          id: string;
          attester: string;
          recipient: string;
          timeCreated: number;
          decodedDataJson: string;
        };
        const approval: WorkApproval = parseWorkApprovalAttestation(att);
        return [approval];
      } catch (error) {
        logger.warn("Failed to parse attestation data", {
          source: "useWorkApprovals",
          attestationId: (attestation as { id?: string }).id,
          error,
        });
        return [];
      }
    });
  } catch (error) {
    logger.warn("Failed to fetch work approvals", {
      source: "useWorkApprovals",
      attesterAddress,
      chainId,
      error,
    });
    return [];
  }
}

/**
 * Hook for work approvals where the user is the attester (reviewer)
 * Used by WorkDashboard to show all work the user has reviewed
 */
export function useWorkApprovals(attesterAddress?: string) {
  const chainId = DEFAULT_CHAIN_ID;

  // Online work approvals query (where user is attester)
  const onlineApprovalsQuery = useQuery({
    queryKey: queryKeys.workApprovals?.byAttester?.(attesterAddress, chainId) || [
      "workApprovals",
      "byAttester",
      attesterAddress,
      chainId,
    ],
    queryFn: async () => {
      try {
        return await getWorkApprovalsByAttester(attesterAddress!, chainId);
      } catch (error) {
        logger.warn("Error in online approvals query", { source: "useWorkApprovals", error });
        return []; // Return empty array on error
      }
    },
    enabled: !!attesterAddress,
    staleTime: STALE_TIME_MEDIUM, // 30 seconds for approval updates
    gcTime: STALE_TIME_RARE, // 5 minutes garbage collection
    throwOnError: false, // Don't throw errors
  });

  // Convert to enhanced format for UI
  const enhancedApprovals: EnhancedWorkApproval[] = [
    // Online approvals (completed)
    ...(onlineApprovalsQuery.data || []).map(
      (approval): EnhancedWorkApproval => ({
        ...approval,
        type: "work_approval" as const,
        status: approval.approved ? "approved" : "rejected",
        size: JSON.stringify(approval).length,
        // Add missing UI properties to prevent errors
        title: `Work ${(approval.workUID || "").slice(0, 8) || "Unknown"}...`,
        description:
          approval.feedback || `${approval.approved ? "Approved" : "Rejected"} work submission`,
        gardenId: approval.workUID || approval.id, // Use workUID as gardenId fallback
      })
    ),
  ];

  // Sort by creation date (newest first)
  const sortedApprovals = enhancedApprovals.sort((a, b) => b.createdAt - a.createdAt);

  // Check if we have any errors
  const hasError = !!onlineApprovalsQuery.error;
  const errorMessage = (onlineApprovalsQuery.error as Error)?.message;

  return {
    approvals: sortedApprovals,
    pendingApprovals: sortedApprovals.filter((a) =>
      ["pending", "syncing", "failed"].includes(a.status)
    ),
    completedApprovals: sortedApprovals.filter((a) => ["approved", "rejected"].includes(a.status)),
    approvedCount: sortedApprovals.filter((a) => a.status === "approved").length,
    rejectedCount: sortedApprovals.filter((a) => a.status === "rejected").length,
    pendingCount: sortedApprovals.filter((a) => ["pending", "syncing", "failed"].includes(a.status))
      .length,
    isLoading: onlineApprovalsQuery.isLoading,
    error: onlineApprovalsQuery.error,
    hasError,
    errorMessage,
    refetch: () => {
      onlineApprovalsQuery.refetch();
    },
  };
}
