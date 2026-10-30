import type { ApproximateWorkLocation } from "../../types/domain";
import type { SerializedFileData } from "../../types/job-queue";
import { serializeFile } from "../../utils/storage/file-serialization";
import { logger } from "../app/logger";
import { withoutImageMetadata } from "./image-metadata";

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

/**
 * A photo that cannot lose its metadata, because neither the byte-level
 * rewrite nor a canvas can read it, so it is never published. Queued work holds
 * it, named, as needing attention, the way a HEIC photo that will not convert
 * is held; a proof ends on it.
 */
export class UnpublishablePhotoError extends InvalidWorkAttachmentError {
  /** The photo's file name. */
  readonly photo: string;

  constructor(photo: string) {
    super("photo-unreadable");
    this.name = "UnpublishablePhotoError";
    this.photo = photo;
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

/**
 * A file that counts toward an action's required photos: a JPEG, PNG or WebP,
 * and a HEIC still waiting to convert where the policy keeps one. A video never
 * does. A step that holds a flow until the minimum is met counts with this, so
 * it agrees with the check made when the work is sent.
 */
export function isWorkPhoto(file: File, policy: WorkAttachmentPolicy = {}): boolean {
  return PHOTO_TYPES.has(file.type) || (policy.pendingHeic === "accept" && isHeicFile(file));
}

/**
 * A photo without its location, camera or other metadata, or null when it
 * cannot be published. The byte-level rewrite reads the JPEG, PNG and WebP
 * structures cameras and editors write. A file it cannot read, which a browser
 * may still draw leniently, is drawn again through a canvas, which writes no
 * metadata. Null only when neither can read it; the Agent has no canvas.
 */
export async function withoutPhotoMetadata(file: File): Promise<File | null> {
  const stripped = await withoutImageMetadata(file);
  if (stripped) return stripped;
  const redrawn = await redrawPhoto(file);
  // The canvas's output is read back like any photo, so nothing it carried over is published.
  return redrawn ? withoutImageMetadata(redrawn) : null;
}

async function redrawPhoto(file: File): Promise<File | null> {
  try {
    const { imageCompressor } = await import("../../utils/work/image-compression");
    return await imageCompressor.redraw(file);
  } catch (error) {
    logger.warn("[WorkMedia] The canvas to redraw a photo could not load", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * An attachment as it may be pinned. A photo loses its location and camera
 * metadata, and one that cannot lose it is refused rather than published as it
 * was picked: IPFS and the attestation cannot be withdrawn. A video is
 * published as it was picked, since removing a video container's metadata needs
 * a parser this does not have.
 */
export async function publishableWorkFile(file: File): Promise<File> {
  if (!PHOTO_TYPES.has(file.type)) return file;
  const published = await withoutPhotoMetadata(file);
  if (!published) throw new UnpublishablePhotoError(file.name);
  return published;
}

export function validateWorkAttachments(
  media: File[],
  audio: File[] = [],
  minPhotos = 0,
  policy: WorkAttachmentPolicy = {}
): string[] {
  const isPhoto = (file: File) => isWorkPhoto(file, policy);
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
