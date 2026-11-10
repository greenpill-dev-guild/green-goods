import {
  HEIC_JPEG_QUALITY,
  WORK_PHOTO_COMPRESSION,
  convertHeicToJpeg,
  loadHeicDecoder,
} from "./heic-conversion";
import { withoutPhotoMetadata } from "../media/image-metadata";
import { withoutVideoMetadata } from "../media/video-metadata";
import {
  WORK_DOCUMENT_MAX_BYTES,
  captureWorkFile,
  documentMatchesType,
  isHeicFile,
  isWorkDocument,
  workDocumentType,
} from "./work-attachments";
export type WorkMediaSource = "camera" | "gallery" | "documents";
export type WorkMediaKind = "image" | "video" | "document" | "unknown";
export type MediaRejectedReason = "unsupported" | "heic_conversion_failed" | "too_large";

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
  /** The largest video the flow takes. A larger one is refused before it is read. */
  maxVideoBytes?: number;
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
  if (isWorkDocument(file)) return "document";

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
    document_count: metadata.filter((item) => item.media_kind === "document").length,
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
    // Read from the file as picked: capturing it gives a file with no type one from its name,
    // and calls a name it does not know a JPEG, which would turn a Markdown file into a photo.
    const documentType = workDocumentType(pickedFile);
    // Reading a long recording or a large scan whole only to refuse it can run a phone out
    // of memory, so a video over the flow's limit, or a document over its own, is refused unread.
    if (
      (options.maxVideoBytes !== undefined &&
        isVideoFile(pickedFile) &&
        pickedFile.size > options.maxVideoBytes) ||
      (documentType !== null && pickedFile.size > WORK_DOCUMENT_MAX_BYTES)
    ) {
      rejected.push({
        file: pickedFile,
        reason: "too_large",
        metadata: getSafeMediaMetadata(pickedFile),
      });
      continue;
    }
    const file = await captureWorkFile(pickedFile);
    if (documentType) {
      // A document publishes as it was picked, so it is kept only when its bytes
      // are what its type says, and under that type: the upload is signed for it.
      // The whole file is read (10 MB at most): a Word file is told by the parts it holds.
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!documentMatchesType(documentType, bytes)) {
        rejected.push({ file, reason: "unsupported", metadata: getSafeMediaMetadata(file) });
        continue;
      }
      const typed =
        file.type === documentType
          ? file
          : new File([file], file.name, { type: documentType, lastModified: file.lastModified });
      accepted.push({
        file: typed,
        originalFile: file,
        converted: false,
        metadata: getSafeMediaMetadata(typed),
      });
      continue;
    }
    if (isVideoFile(file)) {
      // A video loses its location, device and capture time as it is picked
      // too. One whose container cannot be read in full is refused: it could
      // not be checked.
      const published = await withoutVideoMetadata(file);
      if (published) {
        accepted.push({
          file: published,
          originalFile: file,
          converted: false,
          metadata: getSafeMediaMetadata(published),
        });
      } else {
        rejected.push({ file, reason: "unsupported", metadata: getSafeMediaMetadata(file) });
      }
      continue;
    }

    if (isSupportedImage(file)) {
      // Location and camera metadata come off as the photo is picked, so the
      // draft, the queue and the upload all hold the bytes that publish. A photo
      // that neither the rewrite nor a canvas can read is refused: it could not
      // be checked.
      const published = await withoutPhotoMetadata(file);
      if (published) {
        accepted.push({
          file: published,
          originalFile: file,
          converted: false,
          metadata: getSafeMediaMetadata(published),
        });
      } else {
        rejected.push({ file, reason: "unsupported", metadata: getSafeMediaMetadata(file) });
      }
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
      // The conversion draws the photo on a canvas, which writes no metadata.
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
 * do before queueing: HEIC converted, photo and video metadata removed,
 * unsupported types refused, large images brought under the upload ceiling.
 * Kept here so the proof composer and the work composer cannot drift on what a
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
  // A document is queued as it was picked: nothing compresses or converts it.
  const documents = accepted.filter(isWorkDocument);
  const photos = accepted.filter((file) => !isVideoFile(file) && !isWorkDocument(file));
  // An unconverted HEIC skips compression: the compressor decodes through the
  // browser, which is the very step that is not available for this format.
  const deferred = photos.filter((file) => isHeicFile(file));
  const images = photos.filter((file) => !isHeicFile(file));
  const toCompress = images.filter((file) => compressor.shouldCompress(file, 1024));
  const asIs = images.filter((file) => !compressor.shouldCompress(file, 1024));
  const compressed =
    toCompress.length > 0
      ? (await compressor.compressImages(toCompress, WORK_PHOTO_COMPRESSION)).map(
          (result) => result.file
        )
      : [];
  return {
    files: [...asIs, ...compressed, ...deferred, ...videos, ...documents],
    rejectedCount: normalized.rejected.length,
  };
}

export {
  WORK_DOCUMENT_ACCEPT,
  WORK_DOCUMENT_MAX_COUNT,
  isHeicFile,
  isWorkDocument,
  isWorkPhoto,
  readPublishedWorkDocuments,
  roundWorkLocation,
  validateWorkAttachments,
  validateWorkVideo,
  workDocumentType,
} from "./work-attachments";
export type { PublishedWorkDocument } from "./work-attachments";
