import type { Address, Work } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";

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
  actionUID: number | string;
  gardenerAddress: string;
  gardenId?: string;
  feedback?: string;
  createdAt: number;
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
}

/** Shape of a received approval from fetchApprovalsByRecipients. */
interface ReceivedApproval {
  workUID: string;
  actionUID: number | string;
  gardenerAddress: string;
  feedback?: string;
  createdAt: number;
  approved: boolean;
}

function toActionUID(value: number | string | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      actionUID: toActionUID(approval.actionUID),
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
export function receivedApprovalsToWorks(
  approvals: ReceivedApproval[],
  originalWorksById: Map<string, Work> = new Map()
): Work[] {
  return approvals.map((a) => {
    const originalWork = originalWorksById.get(a.workUID);
    return {
      id: a.workUID,
      title: originalWork?.title || `Work ${String(a.workUID || "").slice(0, 8)}...`,
      actionUID: originalWork?.actionUID ?? toActionUID(a.actionUID),
      gardenerAddress: originalWork?.gardenerAddress ?? a.gardenerAddress,
      gardenAddress: originalWork?.gardenAddress ?? "",
      feedback: a.feedback ?? "",
      metadata: originalWork?.metadata ?? "",
      media: originalWork?.media ?? [],
      createdAt: a.createdAt,
      status: a.approved ? ("approved" as const) : ("rejected" as const),
    };
  });
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
