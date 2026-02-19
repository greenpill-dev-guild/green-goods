import {
  AudioPlayer,
  AudioRecorder,
  imageCompressor,
  mediaResourceManager,
  track,
  type Action,
} from "@green-goods/shared";
import { RiCloseLine, RiImageFill, RiLoader4Line, RiMicLine, RiZoomInLine } from "@remixicon/react";
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
  setAudioNotes: React.Dispatch<React.SetStateAction<File[]>>;
  minRequired?: number;
  onGalleryClickRef?: React.MutableRefObject<(() => void) | null>;
  onCameraClickRef?: React.MutableRefObject<(() => void) | null>;
  onVideoClickRef?: React.MutableRefObject<(() => void) | null>;
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

export const WorkMedia: React.FC<WorkMediaProps> = ({
  config,
  images,
  setImages,
  audioNotes,
  setAudioNotes,
  minRequired = 0,
  onGalleryClickRef,
  onCameraClickRef,
  onVideoClickRef,
}) => {
  const intl = useIntl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadSourceRef = useRef<"gallery" | "camera" | null>(null);

  // Stable blob URLs for images
  const imageUrls = useMemo(
    () => images.map((file) => mediaResourceManager.getOrCreateUrl(file, WORK_DRAFT_TRACKING_ID)),
    [images]
  );

  // Derive whether current media contains a video
  const hasVideo = useMemo(() => images.some(isVideoFile), [images]);

  // Stable blob URL for video preview
  const videoUrl = useMemo(() => {
    const videoFile = images.find(isVideoFile);
    return videoFile ? mediaResourceManager.getOrCreateUrl(videoFile, VIDEO_TRACKING_ID) : null;
  }, [images]);

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
    (source === "gallery" ? galleryInputRef : cameraInputRef).current?.click();
  }, []);

  const handleVideoClick = useCallback(() => {
    setVideoError(null);
    track("media_upload_clicked", { source: "video", ...getPlatformContext() });
    videoInputRef.current?.click();
  }, []);

  // Expose handlers to parent
  useEffect(() => {
    if (onGalleryClickRef) onGalleryClickRef.current = () => handleUploadClick("gallery");
    if (onCameraClickRef) onCameraClickRef.current = () => handleUploadClick("camera");
    if (onVideoClickRef) onVideoClickRef.current = handleVideoClick;
  }, [handleUploadClick, handleVideoClick, onGalleryClickRef, onCameraClickRef, onVideoClickRef]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsCompressing(true);
    setCompressionProgress(0);

    try {
      const toCompress = fileArray.filter((f) => imageCompressor.shouldCompress(f, 1024));
      const noCompress = fileArray.filter((f) => !imageCompressor.shouldCompress(f, 1024));

      const finalFiles = [...noCompress];

      if (toCompress.length > 0) {
        const results = await imageCompressor.compressImages(
          toCompress,
          { maxSizeMB: 0.8, maxWidthOrHeight: 2048, initialQuality: 0.8, useWebWorker: true },
          (progress) => setCompressionProgress(progress)
        );
        finalFiles.push(...results.map((r) => r.file));

        const stats = imageCompressor.getCompressionStats(results);
        track("media_compression_complete", { ...stats, ...context });
      }

      const maxCount =
        config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : Infinity;
      // Mutual exclusivity: adding photos clears any existing video
      setImages((prev) =>
        [...prev.filter((f) => !isVideoFile(f)), ...finalFiles].slice(0, maxCount)
      );
      mediaResourceManager.cleanupUrls(VIDEO_TRACKING_ID);

      track("media_upload_complete", { count: finalFiles.length, ...context });
    } catch (error) {
      track("media_upload_failed", {
        error: error instanceof Error ? error.message : "Unknown",
        ...context,
      });
      setImages((prev) => [...prev.filter((f) => !isVideoFile(f)), ...fileArray]); // Fallback to uncompressed
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      event.target.value = "";
      uploadSourceRef.current = null;
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const context = getPlatformContext();
    setVideoError(null);

    if (!files?.length) {
      track("media_upload_cancelled", { source: "video", ...context });
      return;
    }

    const file = files[0];
    track("media_upload_started", {
      source: "video",
      count: 1,
      totalSizeKB: Math.round(file.size / 1024),
      ...context,
    });

    // Validate duration
    const { valid, duration } = await validateVideoDuration(file);
    if (!valid) {
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
      event.target.value = "";
      return;
    }

    // Mutual exclusivity: video replaces all photos
    mediaResourceManager.cleanupUrls(WORK_DRAFT_TRACKING_ID);
    setImages([file]);
    track("media_upload_complete", {
      source: "video",
      count: 1,
      durationSeconds: duration,
      ...context,
    });
    event.target.value = "";
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

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

      {/* Progress badge */}
      {minRequired > 0 && (
        <Badge
          className={`self-start ${images.length >= minRequired ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
          variant="pill"
          tint="none"
        >
          {intl.formatMessage(
            {
              id: "app.garden.upload.progress",
              defaultMessage: "{current} of {required} photos uploaded",
            },
            { current: images.length, required: minRequired }
          )}
          {maxImageCount > 0 &&
            ` (${intl.formatMessage({ id: "app.garden.upload.maxAllowed", defaultMessage: "max {max}" }, { max: maxImageCount })})`}
          {images.length >= minRequired && " ✓"}
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

      {/* Hidden file inputs */}
      <div className="hidden">
        <input
          ref={galleryInputRef}
          id="work-media-upload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          multiple
          disabled={isCompressing}
        />
        <input
          ref={cameraInputRef}
          id="work-media-camera"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
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
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <RiLoader4Line className="w-5 h-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              {intl.formatMessage({
                id: "app.garden.upload.compressing",
                defaultMessage: "Compressing images...",
              })}
            </p>
            <div className="mt-2 bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-blue-700 font-medium">
            {Math.round(compressionProgress)}%
          </span>
        </div>
      )}

      {/* Video duration error */}
      {videoError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{videoError}</p>
        </div>
      )}

      {/* Media gallery (photos or video — mutually exclusive) */}
      <div className="flex flex-col gap-4">
        {hasVideo && videoUrl ? (
          /* Video preview */
          <div className="relative w-full">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content, no captions available */}
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              aria-label={intl.formatMessage({
                id: "app.garden.upload.videoPreview",
                defaultMessage: "Video preview",
              })}
            >
              <track kind="captions" />
            </video>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 p-1 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
              onClick={() => {
                mediaResourceManager.cleanupUrls(VIDEO_TRACKING_ID);
                setImages([]);
              }}
            >
              <RiCloseLine className="w-8 h-8" />
            </button>
          </div>
        ) : images.length > 0 ? (
          /* Photo gallery */
          images.map((file, index) => (
            <div key={`${file.name}-${index}`} className="carousel-item relative w-full">
              <button
                type="button"
                className="relative group cursor-pointer w-full"
                onClick={() => setPreviewIndex(index)}
              >
                <img
                  src={imageUrls[index]}
                  alt={`${intl.formatMessage({ id: "app.garden.upload.uploaded", defaultMessage: "Uploaded" })} ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                  <RiZoomInLine className="w-12 h-12 text-white" />
                </div>
              </button>
              <button
                type="button"
                aria-label={intl.formatMessage(
                  { id: "app.garden.upload.removeImage", defaultMessage: "Remove image {index}" },
                  { index: index + 1 }
                )}
                className="flex items-center justify-center w-8 h-8 p-1 bg-bg-white-0 border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                <RiCloseLine className="w-8 h-8" />
              </button>
            </div>
          ))
        ) : (
          <div className="pt-8 px-4 grid place-items-center">
            <Books />
          </div>
        )}
      </div>

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
        images={imageUrls}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
};
