import {
  type Action,
  AudioPlayer,
  imageCompressor,
  mediaResourceManager,
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

const WORK_DRAFT_TRACKING_ID = "work-draft";
const AUDIO_TRACKING_ID = "work-draft-audio";
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
  const videoInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    return () => {
      mediaResourceManager.cleanupUrls(WORK_DRAFT_TRACKING_ID);
      mediaResourceManager.cleanupUrls(AUDIO_TRACKING_ID);
      mediaResourceManager.cleanupUrls(VIDEO_TRACKING_ID);
    };
  }, []);

  const handleUploadClick = useCallback((source: "gallery" | "camera") => {
    uploadSourceRef.current = source;
    track("media_upload_clicked", { source, ...getPlatformContext() });
    (source === "gallery" ? mediaInputRef : cameraInputRef).current?.click();
  }, []);

  const handleVideoClick = useCallback(() => {
    setVideoError(null);
    track("media_upload_clicked", { source: "video", ...getPlatformContext() });
    videoInputRef.current?.click();
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

      setImages((prev) => [...prev, ...newFiles].slice(0, maxCount));

      track("media_upload_complete", {
        count: newFiles.length,
        imageCount: processedImages.length,
        videoCount: validVideos.length,
        ...context,
      });
    } catch (error) {
      track("media_upload_failed", {
        error: error instanceof Error ? error.message : "Unknown",
        ...context,
      });
      // Fallback: add uncompressed
      setImages((prev) => [...prev, ...fileArray]);
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

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={title} info={description} Icon={RiImageFill} />

      {/* Progress badge (shortened) */}
      {minRequired > 0 && (
        <Badge
          className={`self-start ${images.length >= minRequired ? "bg-success-base/15 text-success-base" : "bg-warning-base/15 text-warning-base"}`}
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
        <input
          ref={videoInputRef}
          id="work-media-video"
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          disabled={isCompressing}
        />
      </div>

      {/* Compression progress */}
      {isCompressing && (
        <div className="flex items-center gap-3 p-4 bg-primary-base/10 border border-primary-base/30 rounded-lg">
          <RiLoader4Line className="w-5 h-5 text-primary-base animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.garden.upload.compressing",
                defaultMessage: "Compressing images...",
              })}
            </p>
            <div className="mt-2 bg-bg-soft-200 rounded-full h-2">
              <div
                className="bg-primary-base h-2 rounded-full transition-all duration-300"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-primary-base font-medium">
            {Math.round(compressionProgress)}%
          </span>
        </div>
      )}

      {/* Video duration error */}
      {videoError && (
        <div className="p-3 bg-error-base/10 border border-error-base/30 rounded-lg">
          <p className="text-sm text-error-base">{videoError}</p>
        </div>
      )}

      {/* Recording indicator (from action bar audio toggle) */}
      {isRecording && (
        <div className="flex items-center gap-2 p-3 bg-error-base/10 border border-error-base/30 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-error-base animate-pulse" />
          <span className="text-sm font-medium text-error-base">
            Recording {formatTime(recordingElapsed)}
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
                      className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg"
                      onClick={() => setPlayingVideoIndex(index)}
                    >
                      <RiPlayFill className="w-12 h-12 text-white" />
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
                    className="flex items-center justify-center w-8 h-8 p-1 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                    onClick={() => {
                      if (playingVideoIndex === index) setPlayingVideoIndex(null);
                      removeMedia(index);
                    }}
                  >
                    <RiCloseLine className="w-8 h-8" />
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                    <RiZoomInLine className="w-12 h-12 text-white" />
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={intl.formatMessage(
                    { id: "app.garden.upload.removeMedia", defaultMessage: "Remove media {index}" },
                    { index: index + 1 }
                  )}
                  className="flex items-center justify-center w-8 h-8 p-1 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMedia(index);
                  }}
                >
                  <RiCloseLine className="w-8 h-8" />
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

      {/* Audio notes section */}
      <div className="flex flex-col gap-3">
        <FormInfo
          title={intl.formatMessage({
            id: "app.garden.upload.audioTitle",
            defaultMessage: "Audio Notes",
          })}
          info={intl.formatMessage({
            id: "app.garden.upload.audioDescription",
            defaultMessage: "Record an optional audio note (max 4:20)",
          })}
          Icon={RiMicLine}
        />

        {/* List existing audio notes with player + delete */}
        {audioNotes.map((file, index) => (
          <AudioPlayer
            key={`audio-${file.name}-${index}`}
            file={file}
            onDelete={() => {
              setAudioNotes((prev) => prev.filter((_, i) => i !== index));
            }}
          />
        ))}

        {/* Audio recorder (captures 1 live note at a time) */}
        <AudioRecorder
          onRecordingComplete={(file) => {
            setAudioNotes((prev) => [...prev, file]);
            track("audio_note_recorded", {
              duration: "unknown",
              noteIndex: audioNotes.length,
              ...getPlatformContext(),
            });
          }}
        />
      </div>

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={photoOnlyData.map((p) => p.url)}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
};
