import { useEffect, useState } from "react";
import { mediaResourceManager } from "../../modules/job-queue/media-resource-manager";

/**
 * Object URL for an unpublished profile photo draft, released together with
 * the file so the preview never leaks a blob URL. The URL is created in an
 * effect, not during render, so a render React abandons allocates nothing.
 * It lives apart from `useProfileAvatar`, which the offline content
 * preparation loads at boot, so that boot never loads the media manager.
 */
export function useProfileAvatarDraftPreview(file: File | null): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = mediaResourceManager.getOrCreateUrl(file, "profile-avatar-draft");
    setPreview({ file, url });
    return () => {
      mediaResourceManager.cleanupFile(file);
      setPreview((current) => (current?.file === file ? null : current));
    };
  }, [file]);
  return preview?.file === file ? preview.url : null;
}
