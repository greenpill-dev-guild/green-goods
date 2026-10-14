import { useCallback, useRef, useState } from "react";
import type { IntlShape } from "react-intl";
import { toastService } from "../../../components/toast";
import { logger } from "../../../modules/app/logger";
import { normalizeWorkMediaFiles } from "../../../modules/work/media-processing";
import { imageCompressor } from "../../../utils/work/image-compression";

export type SubmitWorkMediaFeedback = {
  variant: "warning" | "error";
  message: string;
};

const COMPRESSION_THRESHOLD_KB = 1024;
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 2048,
  initialQuality: 0.8,
  useWebWorker: true,
} as const;

async function compressMedia(files: File[], onProgress: (progress: number) => void) {
  const selected = files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => imageCompressor.shouldCompress(file, COMPRESSION_THRESHOLD_KB));
  if (selected.length === 0) return files;

  const compressed = await imageCompressor.compressImages(
    selected.map(({ file }) => file),
    COMPRESSION_OPTIONS,
    onProgress
  );
  const prepared = files.slice();
  compressed.forEach((result, index) => {
    const originalIndex = selected[index]?.index;
    if (originalIndex !== undefined) prepared[originalIndex] = result.file;
  });
  return prepared;
}

export function useSubmitWorkMediaController(
  selectedActionId: string,
  formatMessage: IntlShape["formatMessage"]
) {
  const [images, setImages] = useState<File[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [mediaFeedback, setMediaFeedback] = useState<SubmitWorkMediaFeedback | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const selectedActionIdRef = useRef(selectedActionId);
  selectedActionIdRef.current = selectedActionId;

  const handleFilesChange = useCallback(
    async (newFiles: File[]) => {
      setMediaFeedback(null);
      if (newFiles.length === 0) return;

      const actionIdAtStart = selectedActionIdRef.current;
      const isCurrentAction = () => selectedActionIdRef.current === actionIdAtStart;
      setIsPreparingMedia(true);
      setProgressMessage(formatMessage({ id: "admin.fileUpload.processing" }, { progress: 0 }));

      try {
        const normalized = await normalizeWorkMediaFiles(newFiles, {
          onHeicConversionStarted: () =>
            setProgressMessage(formatMessage({ id: "app.garden.upload.convertingHeic" })),
        });
        if (!isCurrentAction()) return;

        const acceptedFiles = normalized.accepted.map((item) => item.file);
        if (acceptedFiles.length > 0) {
          const preparedFiles = await compressMedia(acceptedFiles, (progress) => {
            setProgressMessage(
              formatMessage(
                { id: "admin.fileUpload.processing", defaultMessage: "Processing... {progress}%" },
                { progress: Math.round(progress) }
              )
            );
          });
          if (!isCurrentAction()) return;
          setImages((previous) => [...previous, ...preparedFiles]);
        }

        const unsupportedCount = normalized.rejected.filter(
          (item) => item.reason === "unsupported"
        ).length;
        const conversionFailureCount = normalized.rejected.filter(
          (item) => item.reason === "heic_conversion_failed"
        ).length;
        const messages: string[] = [];
        if (unsupportedCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.unsupportedMediaMessage",
              defaultMessage:
                "{count, plural, one {That file is not a supported photo or video.} other {# files are not supported photos or videos.}}",
            },
            { count: unsupportedCount }
          );
          messages.push(message);
          toastService.info({
            title: formatMessage({
              id: "app.garden.upload.unsupportedMediaTitle",
              defaultMessage: "Some files were not added",
            }),
            message,
            context: "admin media upload",
          });
        }
        if (conversionFailureCount > 0) {
          const message = formatMessage(
            {
              id: "app.garden.upload.conversionFailedMessage",
              defaultMessage:
                "{count, plural, one {Try that photo again or choose a different image.} other {Try those photos again or choose different images.}}",
            },
            { count: conversionFailureCount }
          );
          messages.push(message);
          toastService.error({
            title: formatMessage({
              id: "app.garden.upload.conversionFailedTitle",
              defaultMessage: "HEIC photo could not be converted",
            }),
            message,
            context: "admin media upload",
          });
        }
        if (messages.length > 0) {
          setMediaFeedback({
            variant: conversionFailureCount > 0 ? "error" : "warning",
            message: messages.join(" "),
          });
        }
      } catch (error) {
        logger.error("Admin media processing failed", { error });
        const message = formatMessage({
          id: "app.garden.upload.compressionFailedMessage",
          defaultMessage: "Try fewer or smaller images, or check your connection.",
        });
        setMediaFeedback({ variant: "error", message });
        toastService.error({
          title: formatMessage({
            id: "app.garden.upload.compressionFailedTitle",
            defaultMessage: "Couldn't process those images",
          }),
          message,
          context: "admin media upload",
          error,
        });
      } finally {
        setIsPreparingMedia(false);
        setProgressMessage("");
      }
    },
    [formatMessage]
  );

  return {
    handleFilesChange,
    images,
    isPreparingMedia,
    mediaFeedback,
    removeImage: (index: number) =>
      setImages((previous) => previous.filter((_, imageIndex) => imageIndex !== index)),
    resetMedia: () => {
      setImages([]);
      setMediaFeedback(null);
      setProgressMessage("");
    },
    setMediaFeedback,
    setProgressMessage,
    progressMessage,
  };
}
