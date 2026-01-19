/**
 * Draft Save Hook
 *
 * Manages draft saving when user exits the garden flow.
 * Drafts are only created/saved when explicitly triggered (on exit),
 * not automatically when images are added or form data changes.
 *
 * @module hooks/work/useDraftAutoSave
 */

import { useCallback, useMemo, useRef } from "react";

import { trackStorageError } from "../../modules/app/error-tracking";
import { useDrafts } from "./useDrafts";

interface DraftFormData {
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount: number | null | undefined;
  timeSpentMinutes?: number;
}

interface UseDraftAutoSaveOptions {
  /** Whether draft saving is enabled */
  enabled?: boolean;
}

/**
 * Check if there's meaningful progress worth saving as a draft
 */
function hasMeaningfulProgress(formData: DraftFormData, imageCount: number): boolean {
  // Images are the strongest indicator of progress
  if (imageCount > 0) return true;

  // Having form input (feedback, plant selection, plant count, or time spent) indicates progress
  const hasFormInput =
    formData.feedback.trim().length > 0 ||
    formData.plantSelection.length > 0 ||
    (formData.plantCount ?? 0) > 0 ||
    (formData.timeSpentMinutes ?? 0) > 0;

  return hasFormInput;
}

/**
 * Hook for managing draft saves on exit from garden flow.
 *
 * Drafts are NOT created automatically when images are added.
 * Instead, call `saveOnExit()` when the user navigates away from
 * the garden flow to persist their progress.
 *
 * @example
 * ```tsx
 * const { saveOnExit, hasMeaningfulProgress } = useDraftAutoSave(
 *   { gardenAddress, actionUID, feedback, plantSelection, plantCount },
 *   images
 * );
 *
 * // Call when user navigates away
 * const handleBack = async () => {
 *   await saveOnExit();
 *   navigate('/home');
 * };
 * ```
 */
export function useDraftAutoSave(
  formData: DraftFormData,
  images: File[] | undefined,
  options: UseDraftAutoSaveOptions = {}
) {
  const { enabled = true } = options;
  // Handle undefined images array - memoize to prevent unnecessary re-renders
  const safeImages = useMemo(() => images ?? [], [images]);

  const { activeDraftId, createDraft, updateDraft, setImages: setDraftImages } = useDrafts();

  // Track if a save is in progress to avoid overlapping saves
  const isSavingRef = useRef(false);

  /**
   * Save draft on exit - creates a new draft or updates existing one.
   * Only saves if there's meaningful progress (images or form data).
   *
   * @returns The draft ID if saved, null otherwise
   */
  const saveOnExit = useCallback(async (): Promise<string | null> => {
    if (!enabled || isSavingRef.current) return null;

    // Only save if there's meaningful progress
    if (!hasMeaningfulProgress(formData, safeImages.length)) {
      return null;
    }

    isSavingRef.current = true;

    try {
      let draftId = activeDraftId;

      // Create a new draft if we don't have one
      if (!draftId) {
        draftId = await createDraft({
          gardenAddress: formData.gardenAddress,
          actionUID: formData.actionUID,
          feedback: formData.feedback,
          plantSelection: formData.plantSelection,
          plantCount: formData.plantCount ?? undefined,
          timeSpentMinutes: formData.timeSpentMinutes,
          currentStep: "intro",
          firstIncompleteStep: "intro",
        });
      } else {
        // Update existing draft
        await updateDraft({
          draftId,
          data: {
            gardenAddress: formData.gardenAddress,
            actionUID: formData.actionUID,
            feedback: formData.feedback,
            plantSelection: formData.plantSelection,
            plantCount: formData.plantCount ?? undefined,
            timeSpentMinutes: formData.timeSpentMinutes,
          },
        });
      }

      // Sync images if there are any
      if (draftId && safeImages.length > 0) {
        await setDraftImages({ draftId, files: safeImages });
      }

      return draftId;
    } catch (error) {
      console.error("[useDraftAutoSave] Failed to save draft on exit:", error);
      trackStorageError(error, {
        source: "useDraftAutoSave.saveOnExit",
        userAction: "saving draft on navigation exit",
        recoverable: true,
        metadata: {
          draft_id: activeDraftId,
          has_images: safeImages.length > 0,
          image_count: safeImages.length,
          garden_address: formData.gardenAddress,
          action_uid: formData.actionUID,
          has_feedback: formData.feedback.length > 0,
        },
      });
      return null;
    } finally {
      isSavingRef.current = false;
    }
  }, [enabled, activeDraftId, createDraft, updateDraft, setDraftImages, formData, safeImages]);

  return {
    /** Save draft when exiting the flow (only if there's meaningful progress) */
    saveOnExit,
    /** Whether there's an active draft */
    hasDraft: !!activeDraftId,
    /** Current draft ID */
    draftId: activeDraftId,
    /** Whether there's meaningful progress worth saving */
    hasMeaningfulProgress: hasMeaningfulProgress(formData, safeImages.length),
  };
}
