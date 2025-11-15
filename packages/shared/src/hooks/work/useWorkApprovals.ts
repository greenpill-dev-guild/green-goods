import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID, getEASConfig } from "../../config/blockchain";
import { easGraphQL } from "../../modules/data/graphql";
import { createEasClient } from "../../modules/data/urql";
import { queryKeys } from "../query-keys";

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

    const { data, error } = await client
      .query(QUERY, {
        where: {
          schemaId: { equals: easConfig.WORK_APPROVAL.uid },
          attester: { equals: attesterAddress }, // Filter by attester (reviewer)
        },
      })
      .toPromise();

    if (error) {
      return []; // Return empty array instead of throwing
    }
    if (!data) {
      return [];
    }

    return (data.attestations as unknown[]).flatMap((attestation: unknown) => {
      try {
        const decodedData = JSON.parse(
          (attestation as { decodedDataJson: string }).decodedDataJson
        );

        const actionUID =
          ((decodedData as Array<{ name: string; value?: { value?: unknown } }>).find(
            (d) => d.name === "actionUID"
          )?.value?.value as number) || 0;
        const workUID =
          ((decodedData as Array<{ name: string; value?: { value?: unknown } }>).find(
            (d) => d.name === "workUID"
          )?.value?.value as string) || "";
        const approved =
          ((decodedData as Array<{ name: string; value?: { value?: unknown } }>).find(
            (d) => d.name === "approved"
          )?.value?.value as boolean) || false;
        const feedback =
          ((decodedData as Array<{ name: string; value?: { value?: unknown } }>).find(
            (d) => d.name === "feedback"
          )?.value?.value as string) || "";

        const approval: WorkApproval = {
          id: (attestation as { id: string }).id,
          operatorAddress: (attestation as { attester: string }).attester,
          gardenerAddress: (attestation as { recipient: string }).recipient,
          actionUID,
          workUID,
          approved,
          feedback,
          createdAt: (attestation as { timeCreated: number }).timeCreated * 1000, // Convert to milliseconds
        };
        return [approval];
      } catch {
        return [];
      }
    });
  } catch {
    return []; // Always return empty array on any error
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
        console.warn("Error in online approvals query:", error);
        return []; // Return empty array on error
      }
    },
    enabled: !!attesterAddress,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
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
