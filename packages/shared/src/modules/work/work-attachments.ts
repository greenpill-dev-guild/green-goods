import type { ApproximateWorkLocation } from "../../types/domain";
import type { SerializedFileData } from "../../types/job-queue";
import { serializeFile } from "../../utils/storage/file-serialization";

export class InvalidWorkAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkAttachmentError";
  }
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
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

export function validateWorkAttachments(
  media: File[],
  audio: File[] = [],
  minPhotos = 0
): string[] {
  const errors: string[] = [];
  if (media.filter((file) => PHOTO_TYPES.has(file.type)).length < minPhotos)
    errors.push("photos-required");
  if (media.length > 10) errors.push("media-count");
  if (media.some((file) => !PHOTO_TYPES.has(file.type) && !VIDEO_TYPES.has(file.type)))
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
