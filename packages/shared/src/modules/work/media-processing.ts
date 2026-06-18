import { heicTo, isHeic } from "heic-to/csp";

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

interface NormalizeWorkMediaOptions {
  jpegQuality?: number;
  onHeicConversionStarted?: (file: File) => void;
  onHeicConversionSucceeded?: (originalFile: File, convertedFile: File) => void;
  onHeicConversionFailed?: (file: File, error: unknown) => void;
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

async function canConvertHeic(file: File): Promise<boolean> {
  if (!isLikelyHeic(file)) return false;
  try {
    return await isHeic(file);
  } catch {
    return isLikelyHeic(file);
  }
}

async function convertHeicToJpeg(file: File, quality: number): Promise<File> {
  const convertedBlob = await heicTo({
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

  for (const file of files) {
    if (isVideoFile(file) || isSupportedImage(file)) {
      accepted.push({
        file,
        originalFile: file,
        converted: false,
        metadata: getSafeMediaMetadata(file),
      });
      continue;
    }

    if (!(await canConvertHeic(file))) {
      rejected.push({
        file,
        reason: "unsupported",
        metadata: getSafeMediaMetadata(file),
      });
      continue;
    }

    options.onHeicConversionStarted?.(file);
    try {
      const convertedFile = await convertHeicToJpeg(file, jpegQuality);
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
