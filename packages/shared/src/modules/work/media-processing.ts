import {
  HEIC_JPEG_QUALITY,
  WORK_PHOTO_COMPRESSION,
  convertHeicToJpeg,
  loadHeicDecoder,
} from "./heic-conversion";
import { captureWorkFile, isHeicFile } from "./work-attachments";
export type WorkMediaSource = "camera" | "gallery";
export type WorkMediaKind = "image" | "video" | "unknown";
export type MediaRejectedReason = "unsupported" | "heic_conversion_failed";

export interface SafeMediaMetadata {
  extension: string;
  mime_type: string;
  size_bucket: string;
  media_kind: WorkMediaKind;
}

export interface AcceptedWorkMediaFile {
  file: File;
  originalFile: File;
  converted: boolean;
  /**
   * A HEIC photo accepted as its original bytes because the decoder could not
   * load yet. It converts once it can; nothing uploads it unconverted.
   */
  pendingConversion?: boolean;
  metadata: SafeMediaMetadata;
}

export interface RejectedWorkMediaFile {
  file: File;
  reason: MediaRejectedReason;
  metadata: SafeMediaMetadata;
}

export interface ConvertedWorkMediaFile {
  originalFile: File;
  file: File;
  metadata: SafeMediaMetadata;
}

export interface WorkMediaProcessingResult {
  accepted: AcceptedWorkMediaFile[];
  rejected: RejectedWorkMediaFile[];
  converted: ConvertedWorkMediaFile[];
}

export interface NormalizeWorkMediaOptions {
  jpegQuality?: number;
  onHeicConversionStarted?: (file: File) => void;
  onHeicConversionSucceeded?: (originalFile: File, convertedFile: File) => void;
  onHeicConversionFailed?: (file: File, error: unknown) => void;
  /** The decoder could not load yet, so the photo was kept to convert once it can. */
  onHeicConversionDeferred?: (file: File) => void;
}

export { HEIC_JPEG_QUALITY, WORK_PHOTO_COMPRESSION };

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const supportedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const generatedMediaIds = new WeakMap<File, string>();

function generateMediaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `media_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getWorkMediaId(file: File): string {
  const existing = generatedMediaIds.get(file);
  if (existing) return existing;

  const id = generateMediaId();
  generatedMediaIds.set(file, id);
  return id;
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function getFileExtension(file: File): string {
  const extension = file.name.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== file.name.toLowerCase() ? extension : "unknown";
}

export function getSizeBucket(bytes: number): string {
  if (bytes < 1_000_000) return "0-1mb";
  if (bytes < 5_000_000) return "1-5mb";
  if (bytes < 10_000_000) return "5-10mb";
  return "10mb-plus";
}

export function getMediaKind(file: File): WorkMediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";

  if (supportedImageExtensions.has(getFileExtension(file)) || isHeicFile(file)) return "image";
  return "unknown";
}

export function getSafeMediaMetadata(file: File): SafeMediaMetadata {
  return {
    extension: getFileExtension(file),
    mime_type: file.type || "unknown",
    size_bucket: getSizeBucket(file.size),
    media_kind: getMediaKind(file),
  };
}

export function getSafeMediaBatchMetadata(files: File[]) {
  const metadata = files.map(getSafeMediaMetadata);
  return {
    file_count: files.length,
    mime_types: Array.from(new Set(metadata.map((item) => item.mime_type))).sort(),
    extensions: Array.from(new Set(metadata.map((item) => item.extension))).sort(),
    size_buckets: Array.from(new Set(metadata.map((item) => item.size_bucket))).sort(),
    image_count: metadata.filter((item) => item.media_kind === "image").length,
    video_count: metadata.filter((item) => item.media_kind === "video").length,
  };
}

function isSupportedImage(file: File): boolean {
  return supportedImageTypes.has(file.type) || supportedImageExtensions.has(getFileExtension(file));
}

export async function normalizeWorkMediaFiles(
  files: File[],
  options: NormalizeWorkMediaOptions = {}
): Promise<WorkMediaProcessingResult> {
  const jpegQuality = options.jpegQuality ?? HEIC_JPEG_QUALITY;
  const accepted: AcceptedWorkMediaFile[] = [];
  const rejected: RejectedWorkMediaFile[] = [];
  const converted: ConvertedWorkMediaFile[] = [];

  for (const pickedFile of files) {
    const file = await captureWorkFile(pickedFile);
    if (isVideoFile(file) || isSupportedImage(file)) {
      accepted.push({
        file,
        originalFile: file,
        converted: false,
        metadata: getSafeMediaMetadata(file),
      });
      continue;
    }

    if (!isHeicFile(file)) {
      rejected.push({
        file,
        reason: "unsupported",
        metadata: getSafeMediaMetadata(file),
      });
      continue;
    }

    const decoder = await loadHeicDecoder();
    if (!decoder) {
      // Keep the steward's photo rather than refusing it: the draft survives,
      // and the photo converts once the decoder can load.
      accepted.push({
        file,
        originalFile: file,
        converted: false,
        pendingConversion: true,
        metadata: getSafeMediaMetadata(file),
      });
      options.onHeicConversionDeferred?.(file);
      continue;
    }

    const decodesAsHeic = await decoder.isHeic(file).catch(() => true);
    if (!decodesAsHeic) {
      rejected.push({
        file,
        reason: "unsupported",
        metadata: getSafeMediaMetadata(file),
      });
      continue;
    }

    options.onHeicConversionStarted?.(file);
    try {
      const convertedFile = await convertHeicToJpeg(decoder, file, jpegQuality);
      const convertedMetadata = getSafeMediaMetadata(convertedFile);
      accepted.push({
        file: convertedFile,
        originalFile: file,
        converted: true,
        metadata: convertedMetadata,
      });
      converted.push({ originalFile: file, file: convertedFile, metadata: convertedMetadata });
      options.onHeicConversionSucceeded?.(file, convertedFile);
    } catch (error) {
      rejected.push({
        file,
        reason: "heic_conversion_failed",
        metadata: getSafeMediaMetadata(file),
      });
      options.onHeicConversionFailed?.(file, error);
    }
  }

  return { accepted, rejected, converted };
}

/** What `prepareMediaForUpload` hands back: files ready to queue, and how many were refused. */
export interface PreparedMedia {
  files: File[];
  rejectedCount: number;
}

/**
 * Normalize a picker's files and compress the photos, the way both composers
 * do before queueing: HEIC converted, unsupported types refused, large images
 * brought under the upload ceiling, videos passed through as they are. Kept
 * here so the proof composer and the work composer cannot drift on what a
 * queued photo looks like.
 */
export async function prepareMediaForUpload(
  files: File[],
  compressor: {
    shouldCompress: (file: File, maxKB: number) => boolean;
    compressImages: (
      files: File[],
      options: {
        maxSizeMB: number;
        maxWidthOrHeight: number;
        initialQuality: number;
        useWebWorker: boolean;
      }
    ) => Promise<Array<{ file: File }>>;
  }
): Promise<PreparedMedia> {
  const normalized = await normalizeWorkMediaFiles(files);
  const accepted = normalized.accepted.map((item) => item.file);
  const videos = accepted.filter(isVideoFile);
  // An unconverted HEIC skips compression: the compressor decodes through the
  // browser, which is the very step that is not available for this format.
  const deferred = accepted.filter((file) => !isVideoFile(file) && isHeicFile(file));
  const images = accepted.filter((file) => !isVideoFile(file) && !isHeicFile(file));
  const toCompress = images.filter((file) => compressor.shouldCompress(file, 1024));
  const asIs = images.filter((file) => !compressor.shouldCompress(file, 1024));
  const compressed =
    toCompress.length > 0
      ? (await compressor.compressImages(toCompress, WORK_PHOTO_COMPRESSION)).map(
          (result) => result.file
        )
      : [];
  return {
    files: [...asIs, ...compressed, ...deferred, ...videos],
    rejectedCount: normalized.rejected.length,
  };
}

export {
  isHeicFile,
  roundWorkLocation,
  validateWorkAttachments,
  validateWorkVideo,
} from "./work-attachments";
