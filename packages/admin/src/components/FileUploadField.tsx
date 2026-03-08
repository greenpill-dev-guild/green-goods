import {
  cn,
  extractErrorMessage,
  imageCompressor,
  logger,
  toastService,
} from "@green-goods/shared";
import { RiCloseLine, RiLoader4Line, RiUploadCloudLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

const PREVIEWABLE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface FileUploadFieldProps {
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  showPreview?: boolean;
  compress?: boolean;
  disabled?: boolean;
  label?: string;
  helpText?: string;
  currentFiles?: File[];
  onRemoveFile?: (index: number) => void;
}

export function FileUploadField({
  onFilesChange,
  accept = "*",
  multiple = false,
  showPreview = true,
  compress = false,
  disabled = false,
  label,
  helpText,
  currentFiles = [],
  onRemoveFile,
}: FileUploadFieldProps) {
  const { formatMessage } = useIntl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setIsProcessing(true);
    setProgress(0);

    try {
      if (compress && accept.includes("image")) {
        // Filter images that need compression
        const imagesToCompress = fileArray.filter((file) =>
          imageCompressor.shouldCompress(file, 1024)
        );
        const filesToKeep = fileArray.filter((file) => !imageCompressor.shouldCompress(file, 1024));

        let finalFiles = [...filesToKeep];

        if (imagesToCompress.length > 0) {
          // Compress images with progress tracking
          const results = await imageCompressor.compressImages(
            imagesToCompress,
            {
              maxSizeMB: 0.8,
              maxWidthOrHeight: 2048,
              initialQuality: 0.8,
              useWebWorker: true,
            },
            (progressValue) => {
              setProgress(progressValue);
            }
          );

          const compressedFiles = results.map((result) => result.file);
          finalFiles = [...finalFiles, ...compressedFiles];
        }

        onFilesChange(finalFiles);
      } else {
        // No compression, just pass through
        onFilesChange(fileArray);
      }
    } catch (error) {
      logger.error("File processing failed", { error });
      const errorText = extractErrorMessage(error);
      const shortError =
        errorText.length > 120 ? `${errorText.slice(0, 117).trimEnd()}...` : errorText;
      toastService.error({
        title: formatMessage({
          id: "admin.fileUpload.error.title",
          defaultMessage: "File processing failed",
        }),
        message: formatMessage(
          { id: "admin.fileUpload.error.message", defaultMessage: "Please try again. {error}" },
          { error: shortError }
        ),
        context: "file upload",
        error,
      });
      setIsProcessing(false);
      setProgress(0);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (index: number) => {
    onRemoveFile?.(index);
  };

  const sanitizeFileName = (name: string) =>
    Array.from(name)
      .filter((char) => {
        const code = char.charCodeAt(0);
        // Strip control characters and HTML meta-characters to keep text-only output.
        return (
          code >= 32 &&
          code !== 127 &&
          char !== "<" &&
          char !== ">" &&
          char !== "&" &&
          char !== '"' &&
          char !== "'" &&
          char !== "`"
        );
      })
      .join("");

  // Create blob URLs in an effect instead of during render
  // Store them in state and clean up when files change
  // Use string keys instead of File object identity to handle cases where
  // parent provides new File instances with same metadata
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());

  // Create stable key from file metadata
  const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
  const filesKey = currentFiles.map(fileKey).join("|");

  useEffect(() => {
    if (!showPreview) {
      for (const url of previewUrls.values()) {
        URL.revokeObjectURL(url);
      }
      setPreviewUrls(new Map());
      return;
    }

    const urls = new Map<string, string>();
    for (const file of currentFiles) {
      if (PREVIEWABLE_IMAGE_TYPES.has(file.type)) {
        urls.set(fileKey(file), URL.createObjectURL(file));
      }
    }
    setPreviewUrls(urls);

    // Cleanup function to revoke URLs when files change
    return () => {
      const urlsToRevoke = new Set([...previewUrls.values(), ...urls.values()]);
      for (const url of urlsToRevoke) {
        URL.revokeObjectURL(url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filesKey is stable serialization of currentFiles; previewUrls is state set within the effect
  }, [filesKey, showPreview]);

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-text-sub">{label}</label>}
      {helpText && <p className="text-xs text-text-soft">{helpText}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || isProcessing}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-stroke-sub bg-bg-white px-4 py-3 text-sm font-medium text-text-sub transition hover:border-primary-base hover:bg-bg-weak/80",
          (disabled || isProcessing) && "cursor-not-allowed opacity-60"
        )}
      >
        {isProcessing ? (
          <>
            <RiLoader4Line className="h-5 w-5 animate-spin" />
            <span>
              {formatMessage(
                { id: "admin.fileUpload.processing", defaultMessage: "Processing... {progress}%" },
                { progress: Math.round(progress) }
              )}
            </span>
          </>
        ) : (
          <>
            <RiUploadCloudLine className="h-5 w-5" />
            <span>
              {multiple
                ? formatMessage({
                    id: "admin.fileUpload.chooseFiles",
                    defaultMessage: "Choose files",
                  })
                : formatMessage({
                    id: "admin.fileUpload.chooseFile",
                    defaultMessage: "Choose file",
                  })}
            </span>
          </>
        )}
      </button>

      {showPreview && currentFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {currentFiles.map((file, index) => {
            const safeFileName = sanitizeFileName(file.name);
            const previewUrl = previewUrls.get(fileKey(file)) ?? null;
            const safePreviewUrl = previewUrl?.startsWith("blob:") ? previewUrl : null;
            return (
              <div
                key={`${safeFileName}-${index}`}
                className="flex items-center gap-3 rounded-md border border-stroke-soft bg-bg-weak p-3"
              >
                {safePreviewUrl && (
                  <img
                    src={safePreviewUrl}
                    alt={safeFileName}
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium text-text-sub" title={safeFileName}>
                    {safeFileName}
                  </p>
                  <p className="text-xs text-text-soft">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {onRemoveFile && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded-md p-1 text-error-base transition hover:bg-error-lighter"
                    aria-label={formatMessage(
                      { id: "admin.fileUpload.remove", defaultMessage: "Remove {filename}" },
                      { filename: safeFileName }
                    )}
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
