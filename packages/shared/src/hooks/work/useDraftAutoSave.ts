/**
 * Draft Save Hook
 *
 * Manages draft saving when user exits the garden flow.
 * Drafts are only created/saved when explicitly triggered (on exit),
 * not automatically when images are added or form data changes.
 *
 * @module hooks/work/useDraftAutoSave
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { trackStorageError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { useDrafts } from "./useDrafts";

interface DraftFormData {
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
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

  // Having form input (feedback or time spent) indicates progress
  const hasFormInput = formData.feedback.trim().length > 0 || (formData.timeSpentMinutes ?? 0) > 0;

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
 *   { gardenAddress, actionUID, feedback },
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

  // Use ref for formData and images so the callback always reads the latest
  // values without being recreated on every render (stale closure prevention)
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const imagesRef = useRef(safeImages);
  useEffect(() => {
    imagesRef.current = safeImages;
  }, [safeImages]);

  /**
   * Save draft on exit - creates a new draft or updates existing one.
   * Only saves if there's meaningful progress (images or form data).
   *
   * @returns The draft ID if saved, null otherwise
   */
  const saveOnExit = useCallback(async (): Promise<string | null> => {
    if (!enabled || isSavingRef.current) return null;

    const currentFormData = formDataRef.current;
    const currentImages = imagesRef.current;

    // Only save if there's meaningful progress
    if (!hasMeaningfulProgress(currentFormData, currentImages.length)) {
      return null;
    }

    isSavingRef.current = true;

    try {
      let draftId = activeDraftId;

      // Create a new draft if we don't have one
      if (!draftId) {
        draftId = await createDraft({
          gardenAddress: currentFormData.gardenAddress,
          actionUID: currentFormData.actionUID,
          feedback: currentFormData.feedback,
          timeSpentMinutes: currentFormData.timeSpentMinutes,
          currentStep: "intro",
          firstIncompleteStep: "intro",
        });
      } else {
        // Update existing draft
        await updateDraft({
          draftId,
          data: {
            gardenAddress: currentFormData.gardenAddress,
            actionUID: currentFormData.actionUID,
            feedback: currentFormData.feedback,
            timeSpentMinutes: currentFormData.timeSpentMinutes,
          },
        });
      }

      // Sync images if there are any
      if (draftId && currentImages.length > 0) {
        await setDraftImages({ draftId, files: currentImages });
      }

      return draftId;
    } catch (error) {
      logger.error("Failed to save draft on exit", { source: "useDraftAutoSave", error });
      trackStorageError(error, {
        source: "useDraftAutoSave.saveOnExit",
        userAction: "saving draft on navigation exit",
        recoverable: true,
        metadata: {
          draft_id: activeDraftId,
          has_images: currentImages.length > 0,
          image_count: currentImages.length,
          garden_address: currentFormData.gardenAddress,
          action_uid: currentFormData.actionUID,
          has_feedback: currentFormData.feedback.length > 0,
        },
      });
      return null;
    } finally {
      isSavingRef.current = false;
    }
  }, [enabled, activeDraftId, createDraft, updateDraft, setDraftImages]);

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
