import { track } from "@green-goods/shared/modules";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import { RiCloseLine, RiImageFill, RiLoader4Line, RiZoomInLine } from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { Badge } from "@/components/Communication";
import { ImagePreviewDialog } from "@/components/Dialogs";
import { Books } from "@/components/Features";

interface WorkMediaProps {
  config?: Action["mediaInfo"];
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
  /** Minimum required images computed from action config */
  minRequired?: number;
  /** Callback to get the gallery click handler for external buttons */
  onGalleryClickRef?: React.MutableRefObject<(() => void) | null>;
  /** Callback to get the camera click handler for external buttons */
  onCameraClickRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Helper to gather environment context for PostHog diagnostics
 */
function getMediaUploadContext() {
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari standalone mode
      window.navigator?.standalone === true);

  const platform = /android/i.test(navigator.userAgent)
    ? "android"
    : /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? "ios"
      : "web";

  return {
    platform,
    isStandalone,
    userAgent: navigator.userAgent,
    isOnline: navigator.onLine,
  };
}

export const WorkMedia: React.FC<WorkMediaProps> = ({
  config,
  images,
  setImages,
  minRequired = 0,
  onGalleryClickRef,
  onCameraClickRef,
}) => {
  const intl = useIntl();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  // Refs for tracking programmatic clicks
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastClickSourceRef = useRef<"gallery" | "camera" | null>(null);

  // Memoize object URLs to prevent memory leaks
  // Track previous URLs for cleanup
  const prevUrlsRef = useRef<string[]>([]);
  const imageUrls = useMemo(() => {
    // Revoke previous URLs before creating new ones
    prevUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    // Create new URLs
    const urls = images.map((file) => URL.createObjectURL(file));
    prevUrlsRef.current = urls;
    return urls;
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      prevUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Track upload button clicks for diagnostics
  const handleUploadButtonClick = useCallback((source: "gallery" | "camera") => {
    lastClickSourceRef.current = source;
    const context = getMediaUploadContext();

    track("media_upload_button_clicked", {
      source,
      ...context,
      programmatic_click: true,
    });

    // Trigger the appropriate input
    if (source === "gallery") {
      galleryInputRef.current?.click();
    } else {
      cameraInputRef.current?.click();
    }
  }, []);

  // Expose click handlers to parent via refs
  useEffect(() => {
    if (onGalleryClickRef) {
      onGalleryClickRef.current = () => handleUploadButtonClick("gallery");
    }
    if (onCameraClickRef) {
      onCameraClickRef.current = () => handleUploadButtonClick("camera");
    }
  }, [handleUploadButtonClick, onGalleryClickRef, onCameraClickRef]);

  const mediaTitle = config?.title
    ? config.title
    : intl.formatMessage({
        id: "app.garden.upload.title",
        description: "Upload Media",
      });
  const mediaDescription =
    config?.description ??
    intl.formatMessage({
      id: "app.garden.submit.tab.media.instruction",
      defaultMessage: "Please take a clear photo of the plants in the garden",
    });
  const neededItems = useMemo(
    () => (Array.isArray(config?.needed) ? config?.needed.filter(Boolean) : []),
    [config?.needed]
  );
  const optionalItems = useMemo(
    () => (Array.isArray(config?.optional) ? config?.optional.filter(Boolean) : []),
    [config?.optional]
  );
  const maxImageCount =
    config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : 0;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const context = getMediaUploadContext();
    const source = lastClickSourceRef.current;

    // Track onChange event fired - critical for Android diagnostics
    track("media_upload_onchange_fired", {
      source,
      files_length: files?.length ?? 0,
      files_is_null: files === null,
      files_is_undefined: files === undefined,
      ...context,
    });

    // Edge case: files is null or empty after picker closes (BUG-009 diagnostic)
    if (!files || files.length === 0) {
      track("media_upload_empty_files", {
        source,
        files_is_null: files === null,
        files_length: files?.length ?? 0,
        ...context,
      });
      // Clear the source ref for next attempt
      lastClickSourceRef.current = null;
      return;
    }

    const fileArray = Array.from(files);

    // Track file details (no filenames or content for privacy)
    track("media_upload_files_received", {
      source,
      file_count: fileArray.length,
      mime_types: fileArray.map((f) => f.type),
      sizes_bytes: fileArray.map((f) => f.size),
      total_size_bytes: fileArray.reduce((sum, f) => sum + f.size, 0),
      ...context,
    });

    setIsCompressing(true);
    setCompressionProgress(0);

    try {
      // Filter images that need compression
      const imagesToCompress = fileArray.filter(
        (file) => imageCompressor.shouldCompress(file, 1024) // Compress if > 1MB
      );

      const filesToKeep = fileArray.filter((file) => !imageCompressor.shouldCompress(file, 1024));

      let finalFiles: File[] = [...filesToKeep];

      if (imagesToCompress.length > 0) {
        track("bulk_image_compression_started", {
          source,
          total_files: imagesToCompress.length,
          total_size: imagesToCompress.reduce((sum, f) => sum + f.size, 0),
          ...context,
        });

        // Compress images with progress tracking
        const compressionResults = await imageCompressor.compressImages(
          imagesToCompress,
          {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 2048,
            initialQuality: 0.8,
            useWebWorker: true,
          },
          (progress, _fileName) => {
            setCompressionProgress(progress);
          }
        );

        const compressedFiles = compressionResults.map((result) => result.file);
        finalFiles = [...finalFiles, ...compressedFiles];

        // Track compression results
        const stats = imageCompressor.getCompressionStats(compressionResults);
        track("bulk_image_compression_completed", {
          source,
          ...stats,
          files_compressed: imagesToCompress.length,
          ...context,
        });

        // Compression summary tracked via analytics
      }

      // Track successful state update
      track("media_upload_state_update", {
        source,
        files_added: finalFiles.length,
        current_count: images.length,
        new_count: images.length + finalFiles.length,
        ...context,
      });

      setImages((prevImages) => {
        const next = [...prevImages, ...finalFiles];
        if (maxImageCount > 0) {
          return next.slice(0, maxImageCount);
        }
        return next;
      });
    } catch (error) {
      track("bulk_image_compression_failed", {
        source,
        error: error instanceof Error ? error.message : "Unknown error",
        file_count: fileArray.length,
        ...context,
      });

      // Fallback to original files if compression fails
      setImages((prevImages) => [...prevImages, ...fileArray]);
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      // Clear the input
      event.target.value = "";
      // Clear the source ref
      lastClickSourceRef.current = null;
    }
  };

  const removeImage = (index: number) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
  };

  const openPreview = (index: number) => {
    setSelectedImageIndex(index);
    setPreviewModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={mediaTitle} info={mediaDescription} Icon={RiImageFill} />
      {/* Dynamic progress badge - shows current/required with color feedback */}
      {minRequired > 0 && (
        <Badge
          className={`self-start ${
            images.length >= minRequired
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
          variant="pill"
          tint="none"
        >
          {intl.formatMessage(
            {
              id: "app.garden.upload.progress",
              defaultMessage: "{current} of {required} photos uploaded",
            },
            {
              current: images.length,
              required: minRequired,
            }
          )}
          {maxImageCount > 0 &&
            ` (${intl.formatMessage(
              {
                id: "app.garden.upload.maxAllowed",
                defaultMessage: "max {max}",
              },
              { max: maxImageCount }
            )})`}
          {images.length >= minRequired && " ✓"}
        </Badge>
      )}
      {neededItems.length > 0 ? (
        <div className="">
          <div className="text-xs tracking-tight mb-1 uppercase">
            {intl.formatMessage({
              id: "app.garden.upload.needed",
              description: "Needed",
            })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {neededItems.map((item) => (
              <Badge key={item} className="capitalize" variant="pill" tint="primary">
                {String(item).replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {optionalItems.length > 0 ? (
        <div className="">
          <div className="text-xs tracking-tight mb-1 uppercase">
            {intl.formatMessage({
              id: "app.garden.upload.optional",
              description: "Optional",
            })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {optionalItems.map((item) => (
              <Badge key={item} className="capitalize" variant="pill" tint="primary">
                {String(item).replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
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
      </div>

      {/* Compression Progress Indicator */}
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

      <div className="flex flex-col gap-4">
        {images.length ? (
          images.map((file, index) => (
            <div key={`${file.name}-${index}`} className="carousel-item relative w-full">
              <button
                type="button"
                className="relative group cursor-pointer w-full"
                onClick={() => openPreview(index)}
              >
                <img
                  src={imageUrls[index]}
                  alt={`${intl.formatMessage({
                    id: "app.garden.upload.uploaded",
                    description: "Uploaded",
                  })} ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-lg"
                />

                {/* Zoom indicator overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                  <RiZoomInLine className="w-12 h-12 text-white" />
                </div>
              </button>

              {/* Delete control */}
              <button
                type="button"
                className="flex items-center justify-center w-8 h-8 p-1 bg-white border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
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

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        images={imageUrls}
        initialIndex={selectedImageIndex}
      />
    </div>
  );
};
