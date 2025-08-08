import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEASConfig } from "@/config";
import { easGraphQL } from "@/modules/graphql";
import { jobQueue } from "@/modules/job-queue";
import { useJobQueueEvents } from "@/modules/job-queue/event-bus";
import { createEasClient } from "@/modules/urql";
import { queryKeys } from "./query-keys";
import { useCurrentChain } from "./useChainConfig";

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
      console.warn("GraphQL error fetching work approvals:", error);
      return []; // Return empty array instead of throwing
    }
    if (!data) {
      console.warn("No data returned from work approvals query");
      return [];
    }

    return (data.attestations as any[])
      .map((attestation: any) => {
        try {
          const decodedData = JSON.parse(attestation.decodedDataJson);

          const actionUID = decodedData.find((d: any) => d.name === "actionUID")?.value?.value || 0;
          const workUID = decodedData.find((d: any) => d.name === "workUID")?.value?.value || "";
          const approved =
            decodedData.find((d: any) => d.name === "approved")?.value?.value || false;
          const feedback = decodedData.find((d: any) => d.name === "feedback")?.value?.value || "";

          return {
            id: attestation.id,
            operatorAddress: attestation.attester,
            gardenerAddress: attestation.recipient,
            actionUID,
            workUID,
            approved,
            feedback,
            createdAt: attestation.timeCreated * 1000, // Convert to milliseconds
          };
        } catch (parseError) {
          console.warn(
            "Failed to parse attestation data:",
            parseError,
            "for attestation:",
            attestation?.id
          );
          return null; // Return null for failed parsing
        }
      })
      .filter((a: WorkApproval | null): a is WorkApproval => Boolean(a));
  } catch (networkError) {
    console.warn(
      "Network error fetching work approvals:",
      (networkError as any)?.message || networkError
    );
    return []; // Always return empty array on any error
  }
}

/**
 * Hook for work approvals where the user is the attester (reviewer)
 * Used by WorkDashboard to show all work the user has reviewed
 */
export function useWorkApprovals(attesterAddress?: string) {
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();

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

  // Offline approval jobs query
  const offlineApprovalsQuery = useQuery({
    queryKey: queryKeys.workApprovals?.offline?.(attesterAddress) || [
      "workApprovals",
      "offline",
      attesterAddress,
    ],
    queryFn: async () => {
      try {
        const jobs = await jobQueue.getJobs({ kind: "approval", synced: false });
        return jobs.filter((job: any) => {
          const payload = job.payload as any;
          return payload?.gardenerAddress?.toLowerCase() === attesterAddress?.toLowerCase();
        });
      } catch (error) {
        console.warn("Error fetching offline approval jobs:", error);
        return []; // Return empty array on error
      }
    },
    enabled: !!attesterAddress,
    staleTime: 5000, // 5 seconds
    gcTime: 30000, // 30 seconds
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

    // Offline approvals (pending/uploading)
    ...(offlineApprovalsQuery.data || []).map((job: any): EnhancedWorkApproval => {
      const payload = job.payload as any;
      return {
        id: job.id,
        operatorAddress: attesterAddress || "",
        gardenerAddress: payload.gardenerAddress || "",
        actionUID: payload.actionUID || 0,
        workUID: payload.workUID || "",
        approved: payload.approved || false,
        feedback: payload.feedback || "",
        createdAt: job.createdAt,
        type: "work_approval" as const,
        status: job.synced ? "approved" : job.lastError ? "failed" : "pending",
        size: JSON.stringify(job).length,
        // Add missing UI properties to prevent errors
        title: `Work ${(payload.workUID || "").slice(0, 8) || "Unknown"}...`,
        description:
          payload.feedback || `${payload.approved ? "Approved work" : "Work submission"}`,
        gardenId: payload.workUID || job.id, // Use workUID as gardenId fallback
      };
    }),
  ];

  // Event-driven invalidation for approval jobs
  useJobQueueEvents(["job:added", "job:completed", "job:failed"], (eventType, data) => {
    if ("job" in data && data.job.kind === "approval") {
      queryClient.invalidateQueries({
        queryKey: ["workApprovals", "byAttester", attesterAddress, chainId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workApprovals", "offline", attesterAddress],
      });
    }
  });

  // Sort by creation date (newest first)
  const sortedApprovals = enhancedApprovals.sort((a, b) => b.createdAt - a.createdAt);

  // Check if we have any errors
  const hasError = !!onlineApprovalsQuery.error || !!offlineApprovalsQuery.error;
  const errorMessage =
    (onlineApprovalsQuery.error as any)?.message || (offlineApprovalsQuery.error as any)?.message;

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
    isLoading: onlineApprovalsQuery.isLoading || offlineApprovalsQuery.isLoading,
    error: onlineApprovalsQuery.error || offlineApprovalsQuery.error,
    hasError,
    errorMessage,
    refetch: () => {
      onlineApprovalsQuery.refetch();
      offlineApprovalsQuery.refetch();
    },
  };
}
