import { v4 as uuidv4 } from "uuid";
import {
  Confidence,
  type Action,
  type Address,
  type Work,
  type WorkApprovalDraft,
  type WorkDraft,
} from "../../types/domain";
import { getActionTitle } from "../../utils/action/parsers";
import { serviceWorkerManager } from "../app/service-worker";
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
  gardenAddress: Address,
  actionUID: number,
  actions: Action[],
  chainId: number,
  images: File[],
  userAddress: Address
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

  const clientWorkId = uuidv4();

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
    userAddress,
    { chainId, clientWorkId }
  );

  // Progressive enhancement: request background sync so queued jobs can flush
  // when connectivity returns (supported browsers only).
  void serviceWorkerManager.requestBackgroundSync();

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
  userAddress: Address
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
export const MAX_IMAGE_COUNT = 10;
export const MAX_TOTAL_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_APPROVAL_CONFIDENCE = Confidence.HIGH;
export const MAX_APPROVAL_VERIFICATION_METHOD = 15;

/**
 * Options for validating work submission context
 */
export interface ValidateWorkContextOptions {
  /** Minimum required images (from action config). Defaults to 0 if not provided. */
  minRequired?: number;
}

/**
 * Validate submission context before work submission.
 * Note: Form field validation (feedback) is handled
 * by the Zod schema in useWorkForm.ts. This function only validates context.
 *
 * @param gardenAddress - Selected garden address
 * @param actionUID - Selected action UID
 * @param images - Work images to upload
 * @param options - Validation options including minRequired images
 * @returns Array of error messages (empty if valid)
 */
export function validateWorkSubmissionContext(
  gardenAddress: Address | null,
  actionUID: number | null,
  images: File[],
  options: ValidateWorkContextOptions = {}
): string[] {
  const errors: string[] = [];

  // Default to 0 so direct callers don't accidentally require media.
  const minRequired = options.minRequired ?? 0;

  if (!gardenAddress) {
    errors.push("Garden must be selected");
  }

  if (typeof actionUID !== "number") {
    errors.push("Action must be selected");
  }

  if (images.length < minRequired) {
    if (minRequired === 1) {
      errors.push("At least one image is required");
    } else {
      errors.push(`At least ${minRequired} images are required`);
    }
  }

  if (images.length > MAX_IMAGE_COUNT) {
    errors.push(`You can upload up to ${MAX_IMAGE_COUNT} images`);
  }

  // Check image file sizes
  const oversizedImages = images.filter((img) => img.size > MAX_IMAGE_SIZE_BYTES);
  if (oversizedImages.length > 0) {
    errors.push(`${oversizedImages.length} image(s) exceed 10MB limit`);
  }

  const totalSize = images.reduce((acc, image) => acc + image.size, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    errors.push("Total image upload size cannot exceed 50MB");
  }

  const invalidImageTypes = images.filter((img) => !ALLOWED_IMAGE_TYPES.has(img.type));
  if (invalidImageTypes.length > 0) {
    errors.push("Only JPEG, PNG, and WebP images are supported");
  }

  return errors;
}

/**
 * @deprecated Use validateWorkSubmissionContext instead.
 * This function is kept for backward compatibility.
 */
export function validateWorkDraft(
  _draft: WorkDraft,
  gardenAddress: Address | null,
  actionUID: number | null,
  images: File[],
  options: ValidateWorkContextOptions = {}
): string[] {
  return validateWorkSubmissionContext(gardenAddress, actionUID, images, options);
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

  if (
    typeof draft.confidence !== "number" ||
    !Number.isInteger(draft.confidence) ||
    draft.confidence < Confidence.NONE ||
    draft.confidence > MAX_APPROVAL_CONFIDENCE
  ) {
    errors.push("Confidence must be between NONE and HIGH");
  }

  if (
    typeof draft.verificationMethod !== "number" ||
    !Number.isInteger(draft.verificationMethod) ||
    draft.verificationMethod < 0 ||
    draft.verificationMethod > MAX_APPROVAL_VERIFICATION_METHOD
  ) {
    errors.push("Verification method must be between 0 and 15");
  }

  // Feedback is optional. Treat an empty string as "not provided", but reject whitespace-only input.
  if (
    draft.feedback !== undefined &&
    draft.feedback.length > 0 &&
    draft.feedback.trim().length === 0
  ) {
    errors.push("Feedback cannot only contain whitespace");
  }

  // Confidence validation (decision #31: approvals require >= LOW, rejections use NONE)
  if (draft.approved && typeof draft.confidence === "number" && draft.confidence < 1) {
    errors.push("Confidence must be at least LOW for approvals");
  }

  // Verification method must be set for approvals
  if (draft.approved && (!draft.verificationMethod || draft.verificationMethod === 0)) {
    errors.push("At least one verification method is required for approvals");
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
