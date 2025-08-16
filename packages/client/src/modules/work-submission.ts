import { createOfflineTxHash, jobQueue } from "@/modules/job-queue";

/**
 * Consolidated work submission utility
 * Handles both online and offline work submission scenarios
 */
export async function submitWorkToQueue(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actions: Action[],
  chainId: number,
  images: File[]
): Promise<{ txHash: `0x${string}`; jobId: string }> {
  if (!gardenAddress) {
    throw new Error("Garden address is required");
  }

  if (typeof actionUID !== "number") {
    throw new Error("Action UID must be a number");
  }

  const action = actions.find((a) => {
    const idPart = a.id?.split("-").pop();
    const numeric = Number(idPart);
    return Number.isFinite(numeric) && numeric === actionUID;
  });
  const actionTitle = action?.title || "Unknown Action";

  // Add job to queue - this handles both offline and online scenarios
  const jobId = await jobQueue.addJob(
    "work",
    {
      ...draft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      gardenAddress,
      media: images,
    },
    { chainId }
  );

  // Return an offline transaction hash for UI compatibility
  return { txHash: createOfflineTxHash(jobId), jobId };
}

/**
 * Consolidated work approval submission utility
 * Handles both online and offline approval scenarios
 */
export async function submitApprovalToQueue(
  draft: WorkApprovalDraft,
  work: Work | undefined,
  chainId: number
): Promise<`0x${string}`> {
  if (!draft.workUID) {
    throw new Error("Work UID is required");
  }

  if (!work) {
    throw new Error("Work not found");
  }

  // Add approval job to queue - this handles both offline and online scenarios
  const jobId = await jobQueue.addJob(
    "approval",
    {
      ...draft,
      gardenerAddress: work.gardenerAddress || "",
    },
    { chainId }
  );

  // Return an offline transaction hash for UI compatibility
  return createOfflineTxHash(jobId);
}

/**
 * Validate work draft before submission
 */
export function validateWorkDraft(
  draft: WorkDraft,
  gardenAddress: string | null,
  actionUID: number | null,
  images: File[]
): string[] {
  const errors: string[] = [];

  if (!gardenAddress) {
    errors.push("Garden must be selected");
  }

  if (typeof actionUID !== "number") {
    errors.push("Action must be selected");
  }

  if (!draft.feedback || draft.feedback.trim().length === 0) {
    errors.push("Feedback is required");
  }

  // Plant count is optional; only validate if provided and negative
  if (typeof (draft as any).plantCount === "number" && (draft as any).plantCount < 0) {
    errors.push("Plant count cannot be negative");
  }

  if (images.length === 0) {
    errors.push("At least one image is required");
  }

  // Check image file sizes (e.g., max 10MB each)
  const maxSize = 10 * 1024 * 1024; // 10MB
  const oversizedImages = images.filter((img) => img.size > maxSize);
  if (oversizedImages.length > 0) {
    errors.push(`${oversizedImages.length} image(s) exceed 10MB limit`);
  }

  return errors;
}

/**
 * Validate approval draft before submission
 */
export function validateApprovalDraft(draft: WorkApprovalDraft): string[] {
  const errors: string[] = [];

  if (!draft.workUID) {
    errors.push("Work UID is required");
  }

  if (typeof draft.actionUID !== "number") {
    errors.push("Action UID is required");
  }

  if (typeof draft.approved !== "boolean") {
    errors.push("Approval decision is required");
  }

  // Feedback is optional but if provided, should not be empty
  if (draft.feedback !== undefined && draft.feedback.trim().length === 0) {
    errors.push("Feedback cannot be empty if provided");
  }

  return errors;
}

/**
 * Get submission status text for UI
 */
export function getSubmissionStatusText(
  isOnline: boolean,
  syncStatus: "idle" | "syncing" | "error"
): string {
  if (!isOnline) {
    return "Saving offline...";
  }

  switch (syncStatus) {
    case "syncing":
      return "Syncing...";
    case "error":
      return "Sync failed";
    default:
      return "Saving...";
  }
}

/**
 * Format job error for user display
 */
export function formatJobError(error: string): string {
  // Common error patterns and their user-friendly messages
  const errorMappings: Record<string, string> = {
    gardener: "You don't have permission to submit work to this garden",
    permission: "Permission denied - check your garden access",
    unauthorized: "You're not authorized to perform this action",
    network: "Network connection error - your work is saved offline",
    quota: "Storage quota exceeded - please free up space",
    invalid: "Invalid data - please check your submission",
  };

  // Check for known error patterns
  for (const [pattern, message] of Object.entries(errorMappings)) {
    if (error.toLowerCase().includes(pattern)) {
      return message;
    }
  }

  // Return original error if no pattern matches
  return error;
}
