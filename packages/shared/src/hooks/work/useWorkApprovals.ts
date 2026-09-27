import { useQuery } from "@tanstack/react-query";
import { getEASConfig } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import { parseEasAttestationRecord } from "../../modules/data/eas-parse";
import { getWorksByUIDs, parseWorkApprovalAttestation } from "../../modules/data/eas";
import { easStoredAddress } from "../../modules/data/eas-read-validation";
import { easGraphQL } from "../../modules/data/graphql";
import { createEasClient } from "../../modules/data/graphql-client";
import { type Address, type WorkApproval } from "../../types/domain";
import { STALE_TIME_MEDIUM, STALE_TIME_RARE } from "../../config/query-keys/constants";
import { workApprovalsKeys } from "../../config/query-keys/work";

// Enhanced work approval interface for UI
export interface EnhancedWorkApproval extends WorkApproval {
  type: "work_approval";
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  size: number;
  gardenName?: string;
  // Add missing properties that UI expects
  title: string;
  description: string;
  gardenId?: Address;
}

// Function to get work approvals by attester address.
// Throws on network/server errors so React Query can surface them.
// Individual attestation parse failures are logged and skipped gracefully.
async function getWorkApprovalsByAttester(
  attesterAddress: Address,
  chainId: number
): Promise<Array<WorkApproval & { gardenId?: Address; title?: string }>> {
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
        attester: { equals: easStoredAddress(attesterAddress) }, // Filter by attester (reviewer)
      },
    },
    "getWorkApprovalsByAttester"
  );

  if (error) {
    throw new Error(`Failed to fetch work approvals: ${error.message}`);
  }
  if (!data) {
    return [];
  }

  const approvals = (data.attestations as unknown[]).flatMap((attestation: unknown) => {
    try {
      const att = parseEasAttestationRecord(attestation);
      const approval: WorkApproval = parseWorkApprovalAttestation(att);
      return [approval];
    } catch (parseError) {
      logger.warn("Failed to parse attestation data", {
        source: "useWorkApprovals",
        attestationId: (attestation as { id?: string }).id,
        error: parseError,
      });
      return [];
    }
  });
  if (approvals.length === 0) return approvals;

  // An approval attestation has the work UID but no garden. Resolve the linked
  // work in one read so history cards can open their detail route.
  try {
    const works = await getWorksByUIDs(
      [...new Set(approvals.map((approval) => approval.workUID))],
      chainId
    );
    const byId = new Map(works.map((work) => [work.id.toLowerCase(), work]));
    return approvals.map((approval) => {
      const work = byId.get(approval.workUID.toLowerCase());
      return work ? { ...approval, gardenId: work.gardenAddress, title: work.title } : approval;
    });
  } catch (error) {
    logger.warn("Could not resolve gardens for reviewed work", { error, count: approvals.length });
    return approvals;
  }
}

/**
 * Hook for work approvals where the user is the attester (reviewer)
 * Used by WorkDashboard to show all work the user has reviewed
 */
export function useWorkApprovals(attesterAddress?: Address) {
  const chainId = DEFAULT_CHAIN_ID;

  // Online work approvals query (where user is attester)
  const onlineApprovalsQuery = useQuery({
    queryKey: workApprovalsKeys.byAttester(attesterAddress, chainId),
    queryFn: () => getWorkApprovalsByAttester(attesterAddress!, chainId),
    enabled: !!attesterAddress,
    staleTime: STALE_TIME_MEDIUM, // 30 seconds for approval updates
    gcTime: STALE_TIME_RARE, // 5 minutes garbage collection
    throwOnError: false, // Don't throw — surface via onlineApprovalsQuery.error
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
        title: approval.title || `Work ${(approval.workUID || "").slice(0, 8) || "Unknown"}...`,
        description:
          approval.feedback || `${approval.approved ? "Approved" : "Rejected"} work submission`,
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
    isFetching: onlineApprovalsQuery.isFetching,
    /** When the review history last read successfully; 0 before the first read. */
    dataUpdatedAt: onlineApprovalsQuery.dataUpdatedAt,
    error: onlineApprovalsQuery.error,
    hasError,
    errorMessage,
    refetch: () => onlineApprovalsQuery.refetch(),
  };
}
