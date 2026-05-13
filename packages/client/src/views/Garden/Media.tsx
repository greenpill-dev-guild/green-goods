import {
  type Action,
  AudioPlayer,
  cn,
  imageCompressor,
  mediaResourceManager,
  toastService,
  track,
} from "@green-goods/shared";
import {
  RiCloseLine,
  RiImageFill,
  RiLoader4Line,
  RiPlayFill,
  RiZoomInLine,
} from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { Badge } from "@/components/Communication";
import { ImagePreviewDialog } from "@/components/Dialogs";
import { Books } from "@/components/Features";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

const WORK_DRAFT_TRACKING_ID = "work-draft";
const VIDEO_TRACKING_ID = "work-draft-video";

/** Max video duration in seconds (Decision #28) */
const MAX_VIDEO_DURATION_SECONDS = 30;

interface WorkMediaProps {
  config?: Action["mediaInfo"];
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
  audioNotes: File[];
  setAudioNotes: (files: File[]) => void;
  minRequired?: number;
  onMediaClickRef?: React.MutableRefObject<(() => void) | null>;
  onCameraClickRef?: React.MutableRefObject<(() => void) | null>;
  isRecording?: boolean;
  recordingElapsed?: number;
}

/** Get platform context for analytics */
const getPlatformContext = () => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari standalone mode
    window.navigator?.standalone === true;

  const platform = /android/i.test(navigator.userAgent)
    ? "android"
    : /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? "ios"
      : "web";

  return { platform, isStandalone, isOnline: navigator.onLine };
};

/**
 * Validates video duration using a temporary HTMLVideoElement.
 * Resolves to true if duration <= MAX_VIDEO_DURATION_SECONDS, false otherwise.
 */
function validateVideoDuration(file: File): Promise<{ valid: boolean; duration: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      resolve({ valid: duration <= MAX_VIDEO_DURATION_SECONDS, duration });
    };

    video.onerror = () => {
      cleanup();
      resolve({ valid: false, duration: 0 });
    };

    const blobUrl = URL.createObjectURL(file);
    if (!blobUrl.startsWith("blob:")) {
      cleanup();
      resolve({ valid: false, duration: 0 });
      return;
    }
    video.src = blobUrl;
  });
}

/** Check if a file is a video type */
function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

/** Format seconds as m:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const WorkMedia: React.FC<WorkMediaProps> = ({
  config,
  images,
  setImages,
  audioNotes,
  setAudioNotes,
  minRequired = 0,
  onMediaClickRef,
  onCameraClickRef,
  isRecording = false,
  recordingElapsed = 0,
}) => {
  const intl = useIntl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playingVideoIndex, setPlayingVideoIndex] = useState<number | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadSourceRef = useRef<"gallery" | "camera" | null>(null);

  // Stable blob URLs for all media items
  const mediaUrls = useMemo(
    () =>
      images.map((file) => {
        const trackingId = isVideoFile(file) ? VIDEO_TRACKING_ID : WORK_DRAFT_TRACKING_ID;
        return mediaResourceManager.getOrCreateUrl(file, trackingId);
      }),
    [images]
  );

  // Photo-only URLs for the image preview dialog
  const photoOnlyData = useMemo(() => {
    const entries: Array<{ url: string; originalIndex: number }> = [];
    images.forEach((file, index) => {
      if (!isVideoFile(file)) {
        entries.push({ url: mediaUrls[index], originalIndex: index });
      }
    });
    return entries;
  }, [images, mediaUrls]);

  // Note: blob-URL cleanup lives on the parent Work component (Garden/index.tsx),
  // not here. Cleaning up on this component's unmount races with Review's
  // useMemo — Review obtains the cached URL during render, then this cleanup
  // revokes it during the same commit's passive-effect phase, breaking the
  // browser's in-flight blob fetch and producing the "no image in Review"
  // and "back-back-next error" regressions for gallery uploads.

  const handleUploadClick = useCallback((source: "gallery" | "camera") => {
    uploadSourceRef.current = source;
    track("media_upload_clicked", { source, ...getPlatformContext() });
    (source === "gallery" ? mediaInputRef : cameraInputRef).current?.click();
  }, []);

  // Expose handlers to parent
  useEffect(() => {
    if (onMediaClickRef) onMediaClickRef.current = () => handleUploadClick("gallery");
    if (onCameraClickRef) onCameraClickRef.current = () => handleUploadClick("camera");
  }, [handleUploadClick, onMediaClickRef, onCameraClickRef]);

  /**
   * Unified media upload handler for both the media picker and camera.
   * Handles mixed image+video selections: validates videos, compresses images,
   * and appends everything to the existing images[] array.
   */
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const source = uploadSourceRef.current;
    const context = getPlatformContext();
    setVideoError(null);

    if (!files?.length) {
      track("media_upload_cancelled", { source, ...context });
      uploadSourceRef.current = null;
      return;
    }

    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);

    track("media_upload_started", {
      source,
      count: fileArray.length,
      totalSizeKB: Math.round(totalSize / 1024),
      ...context,
    });

    // Split into images and videos
    const imageFiles = fileArray.filter((f) => !isVideoFile(f));
    const videoFiles = fileArray.filter(isVideoFile);

    setIsCompressing(true);
    setCompressionProgress(0);

    try {
      // --- Process videos: validate duration ---
      const validVideos: File[] = [];
      for (const vf of videoFiles) {
        const { valid, duration } = await validateVideoDuration(vf);
        if (valid) {
          validVideos.push(vf);
        } else {
          const errorMsg =
            duration === 0
              ? intl.formatMessage({
                  id: "app.garden.upload.videoCorrupt",
                  defaultMessage: "This video could not be loaded. Please try a different file.",
                })
              : intl.formatMessage(
                  {
                    id: "app.garden.upload.videoTooLong",
                    defaultMessage: "Video must be {max} seconds or shorter (yours is {actual}s)",
                  },
                  { max: MAX_VIDEO_DURATION_SECONDS, actual: Math.round(duration) }
                );
          setVideoError(errorMsg);
          track("media_upload_failed", {
            error: duration === 0 ? "video_corrupt" : "video_too_long",
            duration,
            ...context,
          });
        }
      }

      // --- Process images: compress ---
      const toCompress = imageFiles.filter((f) => imageCompressor.shouldCompress(f, 1024));
      const noCompress = imageFiles.filter((f) => !imageCompressor.shouldCompress(f, 1024));

      const processedImages = [...noCompress];

      if (toCompress.length > 0) {
        const results = await imageCompressor.compressImages(
          toCompress,
          { maxSizeMB: 0.8, maxWidthOrHeight: 2048, initialQuality: 0.8, useWebWorker: true },
          (progress) => setCompressionProgress(progress)
        );
        processedImages.push(...results.map((r) => r.file));

        const stats = imageCompressor.getCompressionStats(results);
        track("media_compression_complete", { ...stats, ...context });
      }

      // --- Combine and append (no mutual exclusivity) ---
      const newFiles = [...processedImages, ...validVideos];
      const maxCount =
        config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : Infinity;

      let droppedCount = 0;
      setImages((prev) => {
        const combined = [...prev, ...newFiles];
        if (combined.length > maxCount) {
          droppedCount = combined.length - maxCount;
          return combined.slice(0, maxCount);
        }
        return combined;
      });

      if (droppedCount > 0) {
        toastService.info({
          title: intl.formatMessage(
            {
              id: "app.garden.upload.truncatedTitle",
              defaultMessage: "{dropped, plural, one {# file not added} other {# files not added}}",
            },
            { dropped: droppedCount }
          ),
          message: intl.formatMessage(
            {
              id: "app.garden.upload.truncatedMessage",
              defaultMessage: "You can add up to {max} for this action.",
            },
            { max: maxCount }
          ),
          context: "mediaUpload",
        });
      }

      track("media_upload_complete", {
        count: newFiles.length,
        imageCount: processedImages.length,
        videoCount: validVideos.length,
        droppedCount,
        ...context,
      });
    } catch (error) {
      track("media_upload_failed", {
        error: error instanceof Error ? error.message : "Unknown",
        ...context,
      });
      // Don't fall back to uncompressed originals — they can blow IndexedDB
      // quota and silently exceed submission size limits. Surface the failure
      // and let the user retry.
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.upload.compressionFailedTitle",
          defaultMessage: "Couldn't process those images",
        }),
        message: intl.formatMessage({
          id: "app.garden.upload.compressionFailedMessage",
          defaultMessage: "Try fewer or smaller images, or check your connection.",
        }),
        context: "mediaUpload",
        error,
      });
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      event.target.value = "";
      uploadSourceRef.current = null;
    }
  };

  const removeMedia = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  // Config values with defaults
  const title =
    config?.title ||
    intl.formatMessage({ id: "app.garden.upload.title", defaultMessage: "Upload Media" });
  const description =
    config?.description ||
    intl.formatMessage({
      id: "app.garden.submit.tab.media.instruction",
      defaultMessage: "Please take a clear photo of the plants in the garden",
    });
  const neededItems = useMemo(() => config?.needed?.filter(Boolean) ?? [], [config?.needed]);
  const optionalItems = useMemo(() => config?.optional?.filter(Boolean) ?? [], [config?.optional]);
  const maxImageCount =
    config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : 0;
  const requirementBadgeTone =
    images.length >= minRequired ? pwaStatusStyles.success : pwaStatusStyles.warning;

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={title} info={description} Icon={RiImageFill} />

      {/* Progress badge (shortened) */}
      {minRequired > 0 && (
        <Badge
          className={`self-start ${requirementBadgeTone.surface} ${requirementBadgeTone.text}`}
          variant="pill"
          tint="none"
        >
          {intl.formatMessage(
            {
              id: "app.garden.upload.mediaBadge",
              defaultMessage: "{current}/{required} media",
            },
            { current: images.length, required: minRequired }
          )}
          {maxImageCount > 0 && ` (max ${maxImageCount})`}
          {images.length >= minRequired && " \u2713"}
        </Badge>
      )}

      {/* Required items */}
      {neededItems.length > 0 && (
        <div>
          <div className="text-xs tracking-tight mb-1 uppercase">
            {intl.formatMessage({ id: "app.garden.upload.needed", defaultMessage: "Needed" })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {neededItems.map((item) => (
              <Badge key={item} className="capitalize" variant="pill" tint="primary">
                {String(item).replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Optional items */}
      {optionalItems.length > 0 && (
        <div>
          <div className="text-xs tracking-tight mb-1 uppercase">
            {intl.formatMessage({ id: "app.garden.upload.optional", defaultMessage: "Optional" })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {optionalItems.map((item) => (
              <Badge key={item} className="capitalize" variant="pill" tint="primary">
                {String(item).replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file inputs (2: media + camera) */}
      <div className="hidden">
        <input
          ref={mediaInputRef}
          id="work-media-upload"
          type="file"
          accept="image/*,video/*"
          onChange={handleMediaUpload}
          multiple
          disabled={isCompressing}
        />
        <input
          ref={cameraInputRef}
          id="work-media-camera"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleMediaUpload}
          disabled={isCompressing}
        />
      </div>

      {/* Compression progress */}
      {isCompressing && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-lg)] border p-4",
            pwaStatusStyles.information.surface,
            pwaStatusStyles.information.border
          )}
        >
          <RiLoader4Line className={cn("w-5 h-5 animate-spin", pwaStatusStyles.information.icon)} />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.garden.upload.compressing",
                defaultMessage: "Compressing images...",
              })}
            </p>
            <div className="mt-2 bg-bg-soft-200 rounded-full h-2">
              <div
                className={cn(
                  "h-2 rounded-full transition-[width] duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]",
                  pwaStatusStyles.information.progress
                )}
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
          <span className={cn("text-sm font-medium", pwaStatusStyles.information.text)}>
            {Math.round(compressionProgress)}%
          </span>
        </div>
      )}

      {/* Video duration error */}
      {videoError && (
        <div
          className={cn(
            "rounded-[var(--radius-lg)] border p-3",
            pwaStatusStyles.error.surface,
            pwaStatusStyles.error.border
          )}
        >
          <p className={cn("text-sm", pwaStatusStyles.error.text)}>{videoError}</p>
        </div>
      )}

      {/* Recording indicator (from action bar audio toggle) */}
      {isRecording && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-lg)] border p-3",
            pwaStatusStyles.error.surface,
            pwaStatusStyles.error.border
          )}
        >
          <div className={cn("w-3 h-3 rounded-full animate-pulse", pwaStatusStyles.error.dot)} />
          <span className={cn("text-sm font-medium", pwaStatusStyles.error.text)}>
            {intl.formatMessage({
              id: "app.garden.upload.recordingPrefix",
              defaultMessage: "Recording",
            })}{" "}
            {formatTime(recordingElapsed)}
          </span>
        </div>
      )}

      {/* Unified media grid: list on mobile, 2-col grid on tablet+ */}
      {images.length > 0 || audioNotes.length > 0 ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-2">
          {/* Photo and video cards */}
          {images.map((file, index) => {
            const isVideo = isVideoFile(file);
            const url = mediaUrls[index];

            if (isVideo) {
              const isPlaying = playingVideoIndex === index;
              return (
                <div key={`media-${file.name}-${index}`} className="relative">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */}
                  <video
                    src={url}
                    controls={isPlaying}
                    className="w-full aspect-4/3 md:aspect-square object-cover rounded-lg"
                    aria-label={intl.formatMessage({
                      id: "app.garden.upload.videoPreview",
                      defaultMessage: "Video preview",
                    })}
                  >
                    <track kind="captions" />
                  </video>
                  {/* Play overlay (shown when not in playback mode) */}
                  {!isPlaying && (
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-overlay)]"
                      onClick={() => setPlayingVideoIndex(index)}
                    >
                      <RiPlayFill className="w-12 h-12 text-static-white" />
                    </button>
                  )}
                  {/* Remove button */}
                  <button
                    type="button"
                    aria-label={intl.formatMessage(
                      {
                        id: "app.garden.upload.removeMedia",
                        defaultMessage: "Remove media {index}",
                      },
                      { index: index + 1 }
                    )}
                    className="flex items-center justify-center min-h-11 min-w-11 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                    onClick={() => {
                      if (playingVideoIndex === index) setPlayingVideoIndex(null);
                      removeMedia(index);
                    }}
                  >
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            // Photo card
            const photoIndex = photoOnlyData.findIndex((p) => p.originalIndex === index);
            return (
              <div key={`media-${file.name}-${index}`} className="relative">
                <button
                  type="button"
                  className="relative group cursor-pointer w-full"
                  onClick={() => {
                    if (photoIndex >= 0) setPreviewIndex(photoIndex);
                  }}
                >
                  <img
                    src={url}
                    alt={`${intl.formatMessage({ id: "app.garden.upload.uploaded", defaultMessage: "Uploaded" })} ${index + 1}`}
                    className="w-full aspect-4/3 md:aspect-square object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-overlay)] opacity-0 transition-opacity duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] group-hover:opacity-100">
                    <RiZoomInLine className="w-12 h-12 text-static-white" />
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={intl.formatMessage(
                    { id: "app.garden.upload.removeMedia", defaultMessage: "Remove media {index}" },
                    { index: index + 1 }
                  )}
                  className="flex items-center justify-center min-h-11 min-w-11 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMedia(index);
                  }}
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Audio note cards (span full width in grid) */}
          {audioNotes.map((file, index) => (
            <div key={`audio-${file.name}-${index}`} className="md:col-span-2">
              <AudioPlayer
                file={file}
                onDelete={() => {
                  setAudioNotes(audioNotes.filter((_, i) => i !== index));
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-8 px-4 grid place-items-center">
          <Books />
        </div>
      )}

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={photoOnlyData.map((p) => p.url)}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
};
