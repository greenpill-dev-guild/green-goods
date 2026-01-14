/**
 * Work Images Hook
 *
 * Manages work submission images with IndexedDB persistence.
 * Automatically loads images on mount and saves changes.
 *
 * @module hooks/work/useWorkImages
 */

import { get as idbGet, set as idbSet } from "idb-keyval";
import { useEffect } from "react";
import { useWorkFlowStore, type WorkFlowState } from "../../stores/useWorkFlowStore";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { createDispatchAdapter } from "../../utils/dispatch-adapter";

const WORK_IMAGES_KEY = "work_images_draft";

/**
 * Hook to manage work images with IndexedDB persistence
 *
 * @returns Images state and setter with React.SetStateAction API
 */
export function useWorkImages() {
  const images = useWorkFlowStore((s: WorkFlowState) => s.images);
  const _setImages = useWorkFlowStore((s: WorkFlowState) => s.setImages);

  // Create dispatch adapter for React.SetStateAction API compatibility
  // Use getState() to always get fresh value, avoiding stale closure issues
  const setImages = createDispatchAdapter(() => useWorkFlowStore.getState().images, _setImages);

  // Load images from IndexedDB on mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        const storedImages = (await idbGet(WORK_IMAGES_KEY)) as File[] | undefined;
        if (storedImages && Array.isArray(storedImages) && storedImages.length > 0) {
          if (DEBUG_ENABLED) {
            debugLog("[useWorkImages] Restored images from IDB", {
              count: storedImages.length,
            });
          }
          _setImages(storedImages);
        }
      } catch (error) {
        console.error("[useWorkImages] Failed to load images from IDB", error);
      }
    };
    loadImages();
  }, [_setImages]);

  // Save images to IndexedDB on change
  useEffect(() => {
    const saveImages = async () => {
      try {
        // If images is empty, we still save it (as empty array) to clear IDB
        // This handles the reset case as well
        await idbSet(WORK_IMAGES_KEY, images);
      } catch (error) {
        console.error("[useWorkImages] Failed to save images to IDB", error);
      }
    };
    saveImages();
  }, [images]);

  return {
    images,
    setImages,
  };
}

export type UseWorkImagesReturn = ReturnType<typeof useWorkImages>;
