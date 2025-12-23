import { v4 as uuidv4 } from "uuid";
import { getActionTitle } from "../../utils/action/parsers";
import { createOfflineTxHash, jobQueue } from "../job-queue";

/**
 * Consolidated work submission utility
 * Handles both online and offline work submission scenarios
 *
 * @param draft - Work draft data
 * @param gardenAddress - Garden address to submit to
 * @param actionUID - Action UID
 * @param actions - List of available actions (for title lookup)
 * @param chainId - Chain ID
 * @param images - Work images
 * @param userAddress - User address who is submitting (required for user-scoped queue)
 */
export async function submitWorkToQueue(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actions: Action[],
  chainId: number,
  images: File[],
  userAddress: string
): Promise<{ txHash: `0x${string}`; jobId: string; clientWorkId: string }> {
  if (!gardenAddress) {
    throw new Error("Garden address is required");
  }

  if (typeof actionUID !== "number") {
    throw new Error("Action UID must be a number");
  }

  if (!userAddress) {
    throw new Error("User address is required");
  }

  const actionTitle = getActionTitle(actions, actionUID);

  // Use existing clientWorkId if provided, otherwise generate new one
  const incomingId =
    draft.metadata && typeof draft.metadata === "object"
      ? ((draft.metadata as Record<string, unknown>).clientWorkId as string | undefined)
      : undefined;
  const clientWorkId = incomingId && incomingId.length > 0 ? incomingId : uuidv4();

  // Add to metadata for deduplication
  const enrichedDraft = {
    ...draft,
    metadata: {
      ...(draft.metadata || {}),
      clientWorkId,
      submittedAt: Date.now(),
    },
  };

  // Add job to queue - this handles both offline and online scenarios
  const jobId = await jobQueue.addJob(
    "work",
    {
      ...enrichedDraft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      gardenAddress,
      media: images,
    },
    userAddress,
    { chainId, clientWorkId }
  );

  // Return an offline transaction hash for UI compatibility and clientWorkId for deduplication
  return { txHash: createOfflineTxHash(jobId), jobId, clientWorkId };
}

/**
 * Consolidated work approval submission utility
 * Handles both online and offline approval scenarios
 *
 * @param draft - Approval draft data
 * @param work - Work being approved/rejected
 * @param chainId - Chain ID
 * @param userAddress - User address who is approving (required for user-scoped queue)
 */
export async function submitApprovalToQueue(
  draft: WorkApprovalDraft,
  work: Work | undefined,
  chainId: number,
  userAddress: string
): Promise<{ txHash: `0x${string}`; jobId: string }> {
  if (!draft.workUID) {
    throw new Error("Work UID is required");
  }

  if (!work) {
    throw new Error("Work not found");
  }

  if (!userAddress) {
    throw new Error("User address is required");
  }

  // Add approval job to queue - this handles both offline and online scenarios
  const jobId = await jobQueue.addJob(
    "approval",
    {
      ...draft,
      gardenAddress: work.gardenAddress,
      gardenerAddress: work.gardenerAddress || "",
    },
    userAddress,
    { chainId }
  );

  // Return an offline transaction hash for UI compatibility
  return { txHash: createOfflineTxHash(jobId), jobId };
}

/**
 * Maximum file size for work images (10MB)
 */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Validate submission context before work submission.
 * Note: Form field validation (feedback, plantSelection, plantCount) is handled
 * by the Zod schema in useWorkForm.ts. This function only validates context.
 *
 * @param gardenAddress - Selected garden address
 * @param actionUID - Selected action UID
 * @param images - Work images to upload
 * @returns Array of error messages (empty if valid)
 */
export function validateWorkSubmissionContext(
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

  if (images.length === 0) {
    errors.push("At least one image is required");
  }

  // Check image file sizes
  const oversizedImages = images.filter((img) => img.size > MAX_IMAGE_SIZE_BYTES);
  if (oversizedImages.length > 0) {
    errors.push(`${oversizedImages.length} image(s) exceed 10MB limit`);
  }

  return errors;
}

/**
 * @deprecated Use validateWorkSubmissionContext instead.
 * This function is kept for backward compatibility.
 */
export function validateWorkDraft(
  _draft: WorkDraft,
  gardenAddress: string | null,
  actionUID: number | null,
  images: File[]
): string[] {
  return validateWorkSubmissionContext(gardenAddress, actionUID, images);
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

// Re-export formatJobError from centralized error utilities
export { formatJobError } from "../../utils/errors/user-messages";
