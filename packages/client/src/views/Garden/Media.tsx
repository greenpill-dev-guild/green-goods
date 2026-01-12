import { mediaResourceManager, track } from "@green-goods/shared/modules";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import { RiCloseLine, RiImageFill, RiLoader4Line, RiZoomInLine } from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { Badge } from "@/components/Communication";
import { ImagePreviewDialog } from "@/components/Dialogs";
import { Books } from "@/components/Features";

const WORK_DRAFT_TRACKING_ID = "work-draft";

interface WorkMediaProps {
  config?: Action["mediaInfo"];
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
  minRequired?: number;
  onGalleryClickRef?: React.MutableRefObject<(() => void) | null>;
  onCameraClickRef?: React.MutableRefObject<(() => void) | null>;
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

export const WorkMedia: React.FC<WorkMediaProps> = ({
  config,
  images,
  setImages,
  minRequired = 0,
  onGalleryClickRef,
  onCameraClickRef,
}) => {
  const intl = useIntl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadSourceRef = useRef<"gallery" | "camera" | null>(null);

  // Stable blob URLs for images
  const imageUrls = useMemo(
    () => images.map((file) => mediaResourceManager.getOrCreateUrl(file, WORK_DRAFT_TRACKING_ID)),
    [images]
  );

  useEffect(() => {
    return () => mediaResourceManager.cleanupUrls(WORK_DRAFT_TRACKING_ID);
  }, []);

  const handleUploadClick = useCallback((source: "gallery" | "camera") => {
    uploadSourceRef.current = source;
    track("media_upload_clicked", { source, ...getPlatformContext() });
    (source === "gallery" ? galleryInputRef : cameraInputRef).current?.click();
  }, []);

  // Expose handlers to parent
  useEffect(() => {
    if (onGalleryClickRef) onGalleryClickRef.current = () => handleUploadClick("gallery");
    if (onCameraClickRef) onCameraClickRef.current = () => handleUploadClick("camera");
  }, [handleUploadClick, onGalleryClickRef, onCameraClickRef]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const source = uploadSourceRef.current;
    const context = getPlatformContext();

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

      let finalFiles = [...noCompress];

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

      const maxCount = config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : Infinity;
      setImages((prev) => [...prev, ...finalFiles].slice(0, maxCount));

      track("media_upload_complete", { count: finalFiles.length, ...context });
    } catch (error) {
      track("media_upload_failed", { error: error instanceof Error ? error.message : "Unknown", ...context });
      setImages((prev) => [...prev, ...fileArray]); // Fallback to uncompressed
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      event.target.value = "";
      uploadSourceRef.current = null;
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  // Config values with defaults
  const title = config?.title || intl.formatMessage({ id: "app.garden.upload.title", defaultMessage: "Upload Media" });
  const description =
    config?.description ||
    intl.formatMessage({
      id: "app.garden.submit.tab.media.instruction",
      defaultMessage: "Please take a clear photo of the plants in the garden",
    });
  const neededItems = useMemo(() => config?.needed?.filter(Boolean) ?? [], [config?.needed]);
  const optionalItems = useMemo(() => config?.optional?.filter(Boolean) ?? [], [config?.optional]);
  const maxImageCount = config?.maxImageCount && config.maxImageCount > 0 ? config.maxImageCount : 0;

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
            { id: "app.garden.upload.progress", defaultMessage: "{current} of {required} photos uploaded" },
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
      </div>

      {/* Compression progress */}
      {isCompressing && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <RiLoader4Line className="w-5 h-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              {intl.formatMessage({ id: "app.garden.upload.compressing", defaultMessage: "Compressing images..." })}
            </p>
            <div className="mt-2 bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-blue-700 font-medium">{Math.round(compressionProgress)}%</span>
        </div>
      )}

      {/* Image gallery */}
      <div className="flex flex-col gap-4">
        {images.length > 0 ? (
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

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={imageUrls}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
};
