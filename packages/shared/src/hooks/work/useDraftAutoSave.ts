/**
 * Draft Auto-Save Hook
 *
 * Manages draft creation and auto-saving with debouncing.
 * Extracts draft management logic from the Garden submission flow.
 *
 * @module hooks/work/useDraftAutoSave
 */

import { useCallback, useEffect, useRef } from "react";
import { useDrafts } from "./useDrafts";

interface DraftFormData {
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount: number | null | undefined;
}

interface UseDraftAutoSaveOptions {
  /** Debounce delay in milliseconds (default: 1000) */
  debounceMs?: number;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

/**
 * Hook for managing draft auto-save with debouncing.
 *
 * Handles:
 * - Draft creation when first image is added
 * - Auto-saving form data with debouncing
 * - Image syncing to drafts
 *
 * @example
 * ```tsx
 * const { triggerSave, createDraftWithImages } = useDraftAutoSave({
 *   formData: { gardenAddress, actionUID, feedback, plantSelection, plantCount },
 *   images,
 *   debounceMs: 1000,
 * });
 * ```
 */
export function useDraftAutoSave(
  formData: DraftFormData,
  images: File[],
  options: UseDraftAutoSaveOptions = {}
) {
  const { debounceMs = 1000, enabled = true } = options;

  const { activeDraftId, createDraft, updateDraft, setImages: setDraftImages } = useDrafts();

  // Track previous image count for draft creation trigger
  const prevImageCountRef = useRef(0);
  // Debounce timer reference
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if a save is in progress to avoid overlapping saves
  const isSavingRef = useRef(false);

  /**
   * Save draft data with debouncing
   */
  const saveDraft = useCallback(async () => {
    if (!activeDraftId || isSavingRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = setTimeout(async () => {
      if (!activeDraftId) return;

      isSavingRef.current = true;
      try {
        await updateDraft({
          draftId: activeDraftId,
          data: {
            gardenAddress: formData.gardenAddress,
            actionUID: formData.actionUID,
            feedback: formData.feedback,
            plantSelection: formData.plantSelection,
            plantCount: formData.plantCount ?? undefined,
          },
        });

        // Sync images if there are any
        if (images.length > 0) {
          await setDraftImages({ draftId: activeDraftId, files: images });
        }
      } catch (error) {
        console.error("[useDraftAutoSave] Failed to auto-save draft:", error);
      } finally {
        isSavingRef.current = false;
      }
    }, debounceMs);
  }, [activeDraftId, updateDraft, setDraftImages, formData, images, debounceMs]);

  /**
   * Create a new draft when first image is added
   */
  const createDraftWithImages = useCallback(async () => {
    if (activeDraftId) return null; // Already have a draft

    try {
      const draftId = await createDraft({
        gardenAddress: formData.gardenAddress,
        actionUID: formData.actionUID,
        feedback: formData.feedback,
        plantSelection: formData.plantSelection,
        plantCount: formData.plantCount ?? undefined,
        currentStep: "media",
        firstIncompleteStep: "media",
      });

      if (draftId && images.length > 0) {
        await setDraftImages({ draftId, files: images });
      }

      return draftId;
    } catch (error) {
      console.error("[useDraftAutoSave] Failed to create draft:", error);
      return null;
    }
  }, [activeDraftId, createDraft, setDraftImages, formData, images]);

  // Create draft on first image added
  useEffect(() => {
    if (!enabled) return;

    const hadNoImages = prevImageCountRef.current === 0;
    const hasImagesNow = images.length > 0;

    if (hadNoImages && hasImagesNow && !activeDraftId) {
      createDraftWithImages();
    }

    prevImageCountRef.current = images.length;
  }, [images.length, activeDraftId, createDraftWithImages, enabled]);

  // Auto-save on form changes
  useEffect(() => {
    if (!enabled || !activeDraftId) return;

    saveDraft();

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    formData.gardenAddress,
    formData.actionUID,
    formData.feedback,
    formData.plantSelection,
    formData.plantCount,
    images.length,
    saveDraft,
    activeDraftId,
    enabled,
  ]);

  return {
    /** Manually trigger a save (debounced) */
    triggerSave: saveDraft,
    /** Create a new draft with current images */
    createDraftWithImages,
    /** Whether there's an active draft */
    hasDraft: !!activeDraftId,
    /** Current draft ID */
    draftId: activeDraftId,
  };
}
