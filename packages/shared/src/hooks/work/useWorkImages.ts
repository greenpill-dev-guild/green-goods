import { useEffect, useId, useState } from "react";
import { mediaResourceManager } from "../../modules/job-queue/media-resource-manager";
import { identifyWorkFile } from "../../modules/work/work-attachments";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { createDispatchAdapter } from "../../utils/dispatch-adapter";

/** Live bytes only. Mounted preview consumers own their URLs. */
export function useWorkImages() {
  const images = useWorkFlowStore((state) => state.images);
  const update = useWorkFlowStore((state) => state.setImages);
  const setImages = createDispatchAdapter(() => useWorkFlowStore.getState().images, update);
  return { images, setImages };
}
export type UseWorkImagesReturn = ReturnType<typeof useWorkImages>;

export function useWorkPreviewUrls(files: File[]): string[] {
  const owner = useId();
  const [preview, setPreview] = useState<{ files: File[]; urls: string[] }>({
    files: [],
    urls: [],
  });
  useEffect(() => {
    let active = true;
    void Promise.all(
      files.map(async (file) => {
        try {
          const identity = await identifyWorkFile(file);
          if (!active) return "";
          return mediaResourceManager.getOrCreateUrl(
            file,
            owner,
            `${identity.id}:${identity.contentHash}`
          );
        } catch {
          return "";
        }
      })
    ).then((urls) => {
      if (active) setPreview({ files, urls });
    });
    return () => {
      active = false;
      mediaResourceManager.cleanupUrls(owner);
    };
  }, [files, owner]);
  return preview.files === files ? preview.urls : files.map(() => "");
}
