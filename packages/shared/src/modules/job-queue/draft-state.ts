import type { DraftStep, WorkDraftRecord } from "../../types/job-queue";
import type { ProfileAvatarDraft } from "../profile-avatar/types";

export type AvatarDraftRecord = ProfileAvatarDraft & {
  kind: "profile-avatar";
  id: string;
  userAddress: ProfileAvatarDraft["address"];
  /** Tombstones stop an unresolved legacy copy from resurrecting a discarded avatar. */
  deleted?: boolean;
};
/** Every row the drafts table holds: work drafts and profile avatar drafts. */
export type CanonicalDraftRecord = WorkDraftRecord | AvatarDraftRecord;
export function isWorkDraft(record: CanonicalDraftRecord): record is WorkDraftRecord {
  return record.kind === undefined || record.kind === "work";
}

function isMeaningfulDraftValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(isMeaningfulDraftValue);
  if (value && typeof value === "object") {
    return Object.values(value).some(isMeaningfulDraftValue);
  }
  return false;
}

export function hasMeaningfulDraftDetails(details: Record<string, unknown> | undefined): boolean {
  return details ? Object.values(details).some(isMeaningfulDraftValue) : false;
}

/**
 * Compute the first incomplete step based on draft data
 */
export function computeFirstIncompleteStep(
  draft: Partial<WorkDraftRecord>,
  hasImages: boolean
): DraftStep {
  // Step 1: Intro - needs garden and action selected
  if (!draft.gardenAddress || draft.actionUID === null || draft.actionUID === undefined) {
    return "intro";
  }

  // Step 2: Media - needs at least one image
  if (!hasImages) {
    return "media";
  }

  // Step 3: Details - needs feedback
  if (!draft.feedback || draft.feedback.trim() === "") {
    return "details";
  }

  // All steps complete, ready for review
  return "review";
}
