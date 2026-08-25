import { useCallback, useEffect, useRef, useState } from "react";
import { getSafeMediaMetadata, getWorkMediaId } from "../../../modules/work/media-processing";
import type { AuthMode } from "../../../modules/auth/session";
import { mediaResourceManager } from "../../../modules/job-queue/media-resource-manager";

type MediaSurface = "media" | "review";
type MediaJourneyEvent =
  | "work_media_preview_failed"
  | "work_media_removed"
  | "work_broken_media_removed";

interface WorkMediaLifecycleOptions {
  actionUID: number | null;
  authMode: AuthMode;
  ensureJourneyId: () => string;
  setImages: (update: (previous: File[]) => File[]) => void;
  trackEvent: (event: MediaJourneyEvent, properties: Record<string, unknown>) => void;
}

export function useWorkMediaLifecycle({
  actionUID,
  authMode,
  ensureJourneyId,
  setImages,
  trackEvent,
}: WorkMediaLifecycleOptions) {
  const [brokenMediaIds, setBrokenMediaIds] = useState<Set<string>>(() => new Set());
  const brokenMediaIdsRef = useRef(brokenMediaIds);
  const mediaClickRef = useRef<(() => void) | null>(null);
  const cameraClickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    brokenMediaIdsRef.current = brokenMediaIds;
  }, [brokenMediaIds]);
  useEffect(
    () => () => {
      mediaResourceManager.cleanupUrls("work-draft");
      mediaResourceManager.cleanupUrls("work-draft-video");
    },
    []
  );

  const markMediaPreviewFailed = useCallback(
    (file: File, surface: MediaSurface) => {
      const mediaId = getWorkMediaId(file);
      if (brokenMediaIdsRef.current.has(mediaId)) return;
      const journeyId = ensureJourneyId();
      setBrokenMediaIds((previous) => {
        const next = new Set(previous).add(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });
      trackEvent("work_media_preview_failed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        parsed_error_family: "preview_failed",
        broken_count: brokenMediaIdsRef.current.size,
        ...getSafeMediaMetadata(file),
      });
    },
    [actionUID, authMode, ensureJourneyId, trackEvent]
  );
  const removeMedia = useCallback(
    (file: File, surface: MediaSurface) => {
      const mediaId = getWorkMediaId(file);
      const journeyId = ensureJourneyId();
      setImages((previous) => previous.filter((item) => getWorkMediaId(item) !== mediaId));
      setBrokenMediaIds((previous) => {
        if (!previous.has(mediaId)) return previous;
        const next = new Set(previous);
        next.delete(mediaId);
        brokenMediaIdsRef.current = next;
        return next;
      });
      trackEvent("work_media_removed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        file_count: 1,
        broken_count: brokenMediaIdsRef.current.size,
        ...getSafeMediaMetadata(file),
      });
    },
    [actionUID, authMode, ensureJourneyId, setImages, trackEvent]
  );
  const removeBrokenMedia = useCallback(
    (surface: MediaSurface) => {
      const ids = new Set(brokenMediaIdsRef.current);
      if (ids.size === 0) return;
      const journeyId = ensureJourneyId();
      setImages((previous) => previous.filter((file) => !ids.has(getWorkMediaId(file))));
      setBrokenMediaIds(new Set());
      brokenMediaIdsRef.current = new Set();
      trackEvent("work_broken_media_removed", {
        work_submission_journey_id: journeyId,
        source: surface,
        auth_mode: authMode,
        action_uid: actionUID,
        submission_phase: surface,
        file_count: ids.size,
        broken_count: ids.size,
      });
    },
    [actionUID, authMode, ensureJourneyId, setImages, trackEvent]
  );

  return {
    brokenMediaIds,
    cameraClickRef,
    markMediaPreviewFailed,
    mediaClickRef,
    removeBrokenMedia,
    removeMedia,
    resetBrokenMedia: () => setBrokenMediaIds(new Set()),
  };
}
