/**
 * Work Images Hook
 *
 * Manages work submission images with IndexedDB persistence.
 * Automatically loads images on mount and saves changes.
 *
 * @module hooks/work/useWorkImages
 */

import { get as idbGet, set as idbSet } from "idb-keyval";
import { useEffect, useRef } from "react";

import { logger } from "../../modules/app/logger";
import { trackStorageError } from "../../modules/app/error-tracking";
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
    let isMounted = true;
    const loadImages = async () => {
      try {
        const storedImages = (await idbGet(WORK_IMAGES_KEY)) as File[] | undefined;
        if (!isMounted) return;
        if (storedImages && Array.isArray(storedImages) && storedImages.length > 0) {
          if (DEBUG_ENABLED) {
            debugLog("[useWorkImages] Restored images from IDB", {
              count: storedImages.length,
            });
          }
          _setImages(storedImages);
        }
      } catch (error) {
        if (!isMounted) return;
        logger.error("Failed to load images from IDB", { source: "useWorkImages", error });
        trackStorageError(error, {
          source: "useWorkImages.loadImages",
          userAction: "loading draft images from IndexedDB",
          recoverable: true,
          metadata: { operation: "idb_get", key: WORK_IMAGES_KEY },
        });
      }
    };
    loadImages();
    return () => {
      isMounted = false;
    };
  }, [_setImages]);

  // Save images to IndexedDB on change
  useEffect(() => {
    const saveImages = async () => {
      try {
        // If images is empty, we still save it (as empty array) to clear IDB
        // This handles the reset case as well
        await idbSet(WORK_IMAGES_KEY, images);
      } catch (error) {
        logger.error("Failed to save images to IDB", { source: "useWorkImages", error });
        trackStorageError(error, {
          source: "useWorkImages.saveImages",
          userAction: "saving images to IndexedDB",
          recoverable: true,
          metadata: { operation: "idb_set", key: WORK_IMAGES_KEY, image_count: images.length },
        });
      }
    };
    saveImages();
  }, [images]);

  // Track latest images via ref so the unmount cleanup sees the current array
  // without causing the effect to re-run on every image change.
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Revoke blob preview URLs only on unmount (not on every images change,
  // which would break displayed thumbnails mid-session).
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        const maybePreviewUrl = (image as File & { preview?: string }).preview;
        if (typeof maybePreviewUrl === "string" && maybePreviewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(maybePreviewUrl);
        }
      });
    };
  }, []);

  return {
    images,
    setImages,
  };
}

export type UseWorkImagesReturn = ReturnType<typeof useWorkImages>;
