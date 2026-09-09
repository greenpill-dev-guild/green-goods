import { validateWorkAttachments } from "./work-attachments";
import type { Action, Address, Work, WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { getActionTitle } from "../../utils/action/parsers";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import { serviceWorkerManager } from "../app/service-worker";
import { jobQueue } from "../job-queue/default-instance";
import type { JobQueueHandle } from "../job-queue/ports";
import { createOfflineTxHash } from "../job-queue/queue-policy";

export interface WorkSubmissionDependencies {
  queue: Pick<JobQueueHandle, "addJob">;
  backgroundSync: Pick<typeof serviceWorkerManager, "requestBackgroundSync">;
  newClientWorkId: () => string;
}

const defaultWorkSubmissionDependencies: WorkSubmissionDependencies = {
  queue: jobQueue,
  backgroundSync: serviceWorkerManager,
  newClientWorkId: () => crypto.randomUUID(),
};

function resolveWorkSubmissionDependencies(
  overrides: Partial<WorkSubmissionDependencies>
): WorkSubmissionDependencies {
  return { ...defaultWorkSubmissionDependencies, ...overrides };
}

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
  userAddress: Address,
  dependencies: Partial<WorkSubmissionDependencies> = {}
): Promise<{ txHash: `0x${string}`; jobId: string; clientWorkId: string }> {
  const deps = resolveWorkSubmissionDependencies(dependencies);
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

  const clientWorkId = deps.newClientWorkId();

  // Add job to queue - this handles both offline and online scenarios
  const jobId = await deps.queue.addJob(
    "work",
    {
      ...draft,
      clientWorkId,
      title: resolveWorkSubmissionTitle({ draftTitle: draft.title, actionTitle, actionUID }),
      actionUID,
      gardenAddress,
      media: images,
    },
    userAddress,
    { chainId, clientWorkId }
  );

  // Progressive enhancement: request background sync so queued jobs can flush
  // when connectivity returns (supported browsers only).
  void deps.backgroundSync.requestBackgroundSync();

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
  userAddress: Address,
  dependencies: Partial<WorkSubmissionDependencies> = {}
): Promise<{ txHash: `0x${string}`; jobId: string }> {
  const deps = resolveWorkSubmissionDependencies(dependencies);
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
  const jobId = await deps.queue.addJob(
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
 * Options for validating work submission context
 */
export interface ValidateWorkContextOptions {
  audioNotes?: File[];
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

  const messages: Record<string, string> = {
    "photos-required":
      minRequired === 1
        ? "At least one image is required"
        : `At least ${minRequired} images are required`,
    "media-count": "You can upload up to 10 photos and videos",
    "media-type": "Only JPEG, PNG, WebP, MP4, and WebM are supported",
    "media-size": "Photos must be 10MB or smaller; videos must be 20MB or smaller",
    "audio-type": "Audio recordings must use an audio format",
    "empty-media": "An attachment is empty. Please select it again",
    "total-size": "All attachments together must be 50MB or smaller",
  };
  errors.push(
    ...validateWorkAttachments(images, options.audioNotes, minRequired).map(
      (code) => messages[code]
    )
  );

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

  // Confidence validation (decision #31: approvals require >= LOW, rejections use NONE)
  if (draft.approved && typeof draft.confidence === "number" && draft.confidence < 1) {
    errors.push("Confidence must be at least LOW for approvals");
  }

  // Verification method must be a valid 4-bit bitmask (0-15)
  if (
    typeof draft.verificationMethod === "number" &&
    (draft.verificationMethod < 0 || draft.verificationMethod > 15)
  ) {
    errors.push("Verification method must be between 0 and 15");
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
