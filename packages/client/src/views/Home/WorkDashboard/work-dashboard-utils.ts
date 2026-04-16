import { type Address, type Work, compareAddresses } from "@green-goods/shared";

/**
 * Combine offline queue work with recent online work, deduplicate, and sort.
 * Offline items appear first, then sorted by creation time descending.
 */
export function combineRecentWork(offlineQueueWork: Work[], recentOnlineWork: Work[]): Work[] {
  const onlineWithStatus: Work[] = recentOnlineWork.map((w) => ({
    ...w,
    status: "pending" as const,
  }));
  const combined = [...offlineQueueWork, ...onlineWithStatus];

  const seen = new Set<string>();
  const deduplicated = combined.filter((work) => {
    if (seen.has(work.id)) return false;
    seen.add(work.id);
    return true;
  });

  return deduplicated.sort((a, b) => {
    const aIsOffline = a.id.startsWith("0xoffline_");
    const bIsOffline = b.id.startsWith("0xoffline_");

    if (aIsOffline && !bIsOffline) return -1;
    if (!aIsOffline && bIsOffline) return 1;

    return b.createdAt - a.createdAt;
  });
}

/**
 * Build a lookup map of work by ID for efficient access.
 */
export function buildWorkMap(works: Work[]): Map<string, Work> {
  const map = new Map<string, Work>();
  works.forEach((w) => map.set(w.id, w));
  return map;
}

/**
 * Combine pending needs-review and my-submissions lists, deduplicating by id.
 */
export function combinePendingWork(
  pendingNeedsReview: Work[],
  pendingMySubmissions: Work[]
): Work[] {
  const map = new Map<string, Work>();
  for (const w of pendingNeedsReview) map.set(w.id, w);
  for (const w of pendingMySubmissions) map.set(w.id, w);
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Check if the given address is one of the reviewer garden IDs.
 */
export function isOperatorForGarden(
  activeAddress: Address | undefined,
  reviewerGardenIds: string[],
  gardenAddress: string
): boolean {
  return Boolean(
    activeAddress && reviewerGardenIds.some((id) => compareAddresses(id, gardenAddress))
  );
}

/** Shape of a completed approval from useWorkApprovals. */
interface CompletedApproval {
  workUID: string;
  title?: string;
  actionUID: string;
  gardenerAddress: string;
  gardenId?: string;
  feedback?: string;
  createdAt: number;
  status: string;
}

/** Shape of a received approval from fetchApprovalsByRecipients. */
interface ReceivedApproval {
  workUID: string;
  actionUID: string;
  gardenerAddress: string;
  feedback?: string;
  createdAt: number;
  approved: boolean;
}

/**
 * Convert completed approvals (reviewed by you) to Work shape for MinimalWorkCard.
 */
export function approvalsToCompletedWorks(approvals: CompletedApproval[]): Work[] {
  return approvals
    .filter((approval) => ["approved", "rejected"].includes(approval.status))
    .map((approval) => ({
      id: approval.workUID,
      title: approval.title || `Work ${String(approval.workUID || "").slice(0, 8)}...`,
      actionUID: approval.actionUID,
      gardenerAddress: approval.gardenerAddress,
      gardenAddress: approval.gardenId || "",
      feedback: approval.feedback || "",
      metadata: "",
      media: [],
      createdAt: approval.createdAt,
      status: approval.status as "approved" | "rejected" | "pending",
    }));
}

/**
 * Convert received approvals (your work reviewed by others) to Work shape.
 */
export function receivedApprovalsToWorks(approvals: ReceivedApproval[]): Work[] {
  return approvals.map((a) => ({
    id: a.workUID,
    title: `Work ${String(a.workUID || "").slice(0, 8)}...`,
    actionUID: a.actionUID,
    gardenerAddress: a.gardenerAddress,
    gardenAddress: "",
    feedback: a.feedback || "",
    metadata: "",
    media: [],
    createdAt: a.createdAt,
    status: a.approved ? ("approved" as const) : ("rejected" as const),
  }));
}

/**
 * Extract unique garden addresses from a list of works.
 */
export function extractWorkGardenIds(works: Work[]): string[] {
  return Array.from(new Set(works.map((work) => work.gardenAddress).filter(Boolean)));
}

/**
 * Resolve work ID and garden ID from a work or approval click target.
 * Returns null if the IDs cannot be resolved.
 */
export function resolveWorkNavigation(
  work: Work | { workUID?: string; gardenAddress?: Address },
  operatorWorksById: Map<string, Work>
): { workId: string; gardenId: string } | null {
  let workId = "id" in work ? work.id : (work as { workUID?: string }).workUID;
  let gardenId = work.gardenAddress;

  if (!gardenId && "workUID" in work && work.workUID) {
    const found = operatorWorksById.get(work.workUID);
    if (found) {
      gardenId = found.gardenAddress;
      workId = found.id;
    }
  }

  if (!gardenId || !workId) return null;
  return { workId, gardenId };
}
