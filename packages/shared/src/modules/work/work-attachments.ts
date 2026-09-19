import type { ApproximateWorkLocation } from "../../types/domain";
import type { SerializedFileData } from "../../types/job-queue";
import { serializeFile } from "../../utils/storage/file-serialization";

export class InvalidWorkAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkAttachmentError";
  }
}

export type HeicConversionWait = "photo-conversion-pending" | "photo-needs-attention";

/**
 * The work is valid except for HEIC photos that are not JPEGs yet. Not an
 * invalid attachment: a queue waits on this instead of failing the work, and
 * `photo-needs-attention` waits for the steward rather than retrying.
 */
export class PendingHeicConversionError extends Error {
  readonly reason: HeicConversionWait;

  constructor(reason: HeicConversionWait = "photo-conversion-pending") {
    super(reason);
    this.name = "PendingHeicConversionError";
    this.reason = reason;
  }
}

export interface WorkAttachmentPolicy {
  /**
   * A composer keeps a HEIC photo while it waits for the decoder, and counts it
   * toward the action's minimum. Anything that uploads keeps the default and
   * refuses it, so an unconverted original never leaves the device.
   */
  pendingHeic?: "accept" | "reject";
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const MIB = 1024 * 1024;
const identities = new WeakMap<
  File,
  Promise<{ id: string; contentHash: string; fileData: SerializedFileData }>
>();

export function roundWorkLocation(value: unknown): ApproximateWorkLocation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return undefined;
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}

export async function hashWorkBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function captureWorkFile(file: File): Promise<File> {
  const data = await serializeFile(file);
  if (!data.data.byteLength) throw new Error("empty-media");
  return new File([data.data], data.name, { type: data.type, lastModified: data.lastModified });
}

export function identifyWorkFile(file: File) {
  let result = identities.get(file);
  if (!result) {
    result = serializeFile(file).then(async (fileData) => ({
      id: crypto.randomUUID(),
      contentHash: await hashWorkBytes(fileData.data),
      fileData,
    }));
    identities.set(file, result);
    result.catch(() => identities.delete(file));
  }
  return result;
}

export function restoreWorkFile(
  fileData: SerializedFileData,
  id: string,
  contentHash: string
): File {
  const file = new File([fileData.data], fileData.name, {
    type: fileData.type,
    lastModified: fileData.lastModified,
  });
  identities.set(file, Promise.resolve({ id, contentHash, fileData }));
  return file;
}

/**
 * A HEIC or HEIF photo, by type, or by name when the picker gave no usable type
 * (Android often reports none). A known type wins: a JPEG named `.heic` is a JPEG.
 */
export function isHeicFile(file: Pick<File, "name" | "type">): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  if (file.type && file.type !== "application/octet-stream") return false;
  const dot = file.name.lastIndexOf(".");
  return (
    dot >= 0 &&
    HEIC_EXTENSIONS.has(
      file.name
        .slice(dot + 1)
        .trim()
        .toLowerCase()
    )
  );
}

export function validateWorkAttachments(
  media: File[],
  audio: File[] = [],
  minPhotos = 0,
  policy: WorkAttachmentPolicy = {}
): string[] {
  const isPhoto = (file: File) =>
    PHOTO_TYPES.has(file.type) || (policy.pendingHeic === "accept" && isHeicFile(file));
  const errors: string[] = [];
  if (media.filter(isPhoto).length < minPhotos) errors.push("photos-required");
  if (media.length > 10) errors.push("media-count");
  if (media.some((file) => !isPhoto(file) && !VIDEO_TYPES.has(file.type)))
    errors.push("media-type");
  if (media.some((file) => file.size > (VIDEO_TYPES.has(file.type) ? 20 : 10) * MIB))
    errors.push("media-size");
  if (audio.some((file) => !file.type.startsWith("audio/"))) errors.push("audio-type");
  if ([...media, ...audio].some((file) => file.size === 0)) errors.push("empty-media");
  if ([...media, ...audio].reduce((sum, file) => sum + file.size, 0) > 50 * MIB)
    errors.push("total-size");
  return errors;
}

export async function validateWorkVideo(file: File): Promise<boolean> {
  if (!VIDEO_TYPES.has(file.type) || file.size > 20 * MIB) return false;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (valid: boolean) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(valid);
    };
    const timer = setTimeout(() => finish(false), 10000);
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 30);
    video.onerror = () => finish(false);
    video.src = url;
  });
}
