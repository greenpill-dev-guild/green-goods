import { logger } from "../app/logger";
import { captureWorkFile } from "./work-attachments";
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
   * A HEIC photo accepted as its original bytes because the decoder had not
   * landed yet. `finalizeWorkMediaForUpload` converts it at send time.
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
  /** The decoder was unreachable, so the photo was kept for conversion at send time. */
  onHeicConversionDeferred?: (file: File) => void;
}

export const HEIC_JPEG_QUALITY = 0.85;

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const supportedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const heicExtensions = new Set(["heic", "heif"]);
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

  const extension = getFileExtension(file);
  if (supportedImageExtensions.has(extension) || heicExtensions.has(extension)) return "image";
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

function isLikelyHeic(file: File): boolean {
  const extension = getFileExtension(file);
  return (
    heicExtensions.has(extension) ||
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.type === "image/heic-sequence" ||
    file.type === "image/heif-sequence"
  );
}

function toJpegFileName(file: File): string {
  const extension = getFileExtension(file);
  if (extension === "unknown") return "converted-work-media.jpg";
  return file.name.replace(/\.[^.]*$/, ".jpg");
}

type HeicDecoder = typeof import("heic-to/csp");

/**
 * The decoder is a lazy chunk from the offline-ready shell tier, so a photo can
 * be picked before it exists locally. A missing decoder is reported as `null`
 * rather than thrown: it means "not yet", which is nothing like a file this
 * decoder has looked at and cannot read.
 */
async function loadHeicDecoder(): Promise<HeicDecoder | null> {
  try {
    return await import("heic-to/csp");
  } catch {
    return null;
  }
}

async function convertHeicToJpeg(decoder: HeicDecoder, file: File, quality: number): Promise<File> {
  const convertedBlob = await decoder.heicTo({
    blob: file,
    type: "image/jpeg",
    quality,
  });

  return new File([convertedBlob], toJpegFileName(file), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
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

    if (!isLikelyHeic(file)) {
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
      // and the send path converts once the decoder is reachable.
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

    const isHeicFile = await decoder.isHeic(file).catch(() => true);
    if (!isHeicFile) {
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

/**
 * Convert photos that were queued before the decoder could reach them.
 *
 * Composing happens offline, sending does not, so this runs where the decoder
 * is reliably available. A photo that still cannot be converted is passed
 * through as it was picked: a steward's evidence is worth more as an
 * awkward file than as a hole in the record.
 */
export async function finalizeWorkMediaForUpload(files: File[]): Promise<File[]> {
  if (!files.some(isLikelyHeic)) return files;
  const decoder = await loadHeicDecoder();
  if (!decoder) {
    logger.warn("[WorkMedia] HEIC decoder unavailable at send; uploading originals", {
      pending: files.filter(isLikelyHeic).length,
    });
    return files;
  }

  const finalized: File[] = [];
  for (const file of files) {
    if (!isLikelyHeic(file)) {
      finalized.push(file);
      continue;
    }
    try {
      finalized.push(await convertHeicToJpeg(decoder, file, HEIC_JPEG_QUALITY));
    } catch (error) {
      logger.warn("[WorkMedia] Deferred HEIC conversion failed; uploading the original", {
        error: error instanceof Error ? error.message : String(error),
      });
      finalized.push(file);
    }
  }
  return finalized;
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
  const deferred = accepted.filter((file) => !isVideoFile(file) && isLikelyHeic(file));
  const images = accepted.filter((file) => !isVideoFile(file) && !isLikelyHeic(file));
  const toCompress = images.filter((file) => compressor.shouldCompress(file, 1024));
  const asIs = images.filter((file) => !compressor.shouldCompress(file, 1024));
  const compressed =
    toCompress.length > 0
      ? (
          await compressor.compressImages(toCompress, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 2048,
            initialQuality: 0.8,
            useWebWorker: true,
          })
        ).map((result) => result.file)
      : [];
  return {
    files: [...asIs, ...compressed, ...deferred, ...videos],
    rejectedCount: normalized.rejected.length,
  };
}

export { roundWorkLocation, validateWorkAttachments, validateWorkVideo } from "./work-attachments";
