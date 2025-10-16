import { RiCloseLine, RiImageFill, RiLoader4Line, RiZoomInLine } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { Books } from "@/components/Garden/BooksIcon";
import { Badge } from "@/components/UI/Badge/Badge";
import { FormInfo } from "@/components/UI/Form/Info";
import { ImagePreviewDialog } from "@/components/UI/ImagePreviewDialog";
import { track } from "@/modules/app/posthog";
import { imageCompressor } from "@/utils/work/image-compression";

interface WorkMediaProps {
  instruction: string;
  needed: string[];
  optional: string[];
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
}

export const WorkMedia: React.FC<WorkMediaProps> = ({
  instruction,
  needed,
  optional,
  images,
  setImages,
}) => {
  const intl = useIntl();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
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
          total_files: imagesToCompress.length,
          total_size: imagesToCompress.reduce((sum, f) => sum + f.size, 0),
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
          ...stats,
          files_compressed: imagesToCompress.length,
        });

        // Compression summary tracked via analytics
      }

      setImages((prevImages) => [...prevImages, ...finalFiles]);
    } catch (error) {
      track("bulk_image_compression_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        file_count: fileArray.length,
      });

      // Fallback to original files if compression fails
      setImages((prevImages) => [...prevImages, ...fileArray]);
    } finally {
      setIsCompressing(false);
      setCompressionProgress(0);
      // Clear the input
      event.target.value = "";
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
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.upload.title",
          description: "Upload Media",
        })}
        info={instruction}
        Icon={RiImageFill}
      />
      <div className="">
        <div className="text-xs tracking-tight mb-1 uppercase">
          {intl.formatMessage({
            id: "app.garden.upload.needed",
            description: "Needed",
          })}
        </div>
        <div className="flex gap-1 flex-wrap">
          {needed.map((item) => (
            <Badge key={item} className="capitalize" variant="pill" tint="primary">
              {item.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>
      <div className="">
        <div className="text-xs tracking-tight mb-1 uppercase">
          {intl.formatMessage({
            id: "app.garden.upload.optional",
            description: "Optional",
          })}
        </div>
        <div className="flex gap-1 flex-wrap">
          {optional.map((item) => (
            <Badge key={item} className="capitalize" variant="pill" tint="primary">
              {item.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>
      <input
        id="work-media-upload"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        multiple
        className="input input-bordered hidden"
        disabled={isCompressing}
      />

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
            <button
              key={file.name}
              type="button"
              className="carousel-item relative group cursor-pointer w-full"
              onClick={() => openPreview(index)}
            >
              <img
                src={URL.createObjectURL(file)}
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

              {/* Delete button */}
              <button
                className="flex items-center w-8 h-8 p-1 bg-white border border-stroke-sub-300 rounded-lg absolute top-2 right-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                type="button"
              >
                <RiCloseLine className="w-8 h-8" />
              </button>
            </button>
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
        images={images.map((file) => URL.createObjectURL(file))}
        initialIndex={selectedImageIndex}
      />
    </div>
  );
};
