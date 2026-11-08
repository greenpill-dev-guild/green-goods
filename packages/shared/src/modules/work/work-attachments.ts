import type { ApproximateWorkLocation } from "../../types/domain";
import type { SerializedFileData } from "../../types/job-queue";
import { serializeFile } from "../../utils/storage/file-serialization";
import { withoutPhotoMetadata } from "../media/image-metadata";
import { withoutVideoMetadata } from "../media/video-metadata";

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
 * rewrite nor a canvas can read it, or a video whose container cannot be read
 * in full, so it is never published. Queued work holds it, named, as needing
 * attention, the way a HEIC photo that will not convert is held; a proof ends
 * on it.
 */
export class UnpublishablePhotoError extends InvalidWorkAttachmentError {
  /** The photo's file name, or the video's. */
  readonly photo: string;
  /** The file is a video, which the person is told about as one. */
  readonly video: boolean;

  constructor(photo: string, { video = false }: { video?: boolean } = {}) {
    super("photo-unreadable");
    this.name = "UnpublishablePhotoError";
    this.photo = photo;
    this.video = video;
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
/** The largest video a work takes. */
export const WORK_VIDEO_MAX_BYTES = 20 * MIB;
/**
 * The documents a work or a proof can carry, each by its type and the
 * extensions a picker may report instead of it. A document publishes as it was
 * picked, beside the photos rather than among them: the attestation's media
 * list stays photos and videos, and the documents are listed in the metadata.
 */
const DOCUMENT_TYPES: Readonly<Record<string, readonly string[]>> = {
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "text/markdown": ["md", "markdown"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
};
/** Types a picker reports when it does not know the file; the extension decides then. */
const UNNAMED_TYPES = new Set(["", "application/octet-stream", "text/x-markdown"]);
/** The largest document a work or a proof takes, the upload signer's own limit. */
export const WORK_DOCUMENT_MAX_BYTES = 10 * MIB;
/** The most documents one work or proof carries. */
export const WORK_DOCUMENT_MAX_COUNT = 5;
/** The documents, by type and by extension, for a file picker's `accept` list. */
export const WORK_DOCUMENT_ACCEPT = Object.entries(DOCUMENT_TYPES)
  .flatMap(([type, extensions]) => [type, ...extensions.map((extension) => `.${extension}`)])
  .join(",");
/** A document as published work metadata lists it. */
export interface PublishedWorkDocument {
  cid: string;
  type: string;
  name: string;
  /** Bytes; 0 when the metadata did not say. */
  size: number;
}
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
 * The type a supported document publishes as, or null. A document type the
 * picker reports wins. When it reports none, a generic one, or an old Markdown
 * name, the extension decides; any other type (a photo named `.pdf`) is not a
 * document.
 */
export function workDocumentType(file: Pick<File, "name" | "type">): string | null {
  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  if (Object.hasOwn(DOCUMENT_TYPES, type)) return type;
  if (!UNNAMED_TYPES.has(type)) return null;
  // A Blob has no name, so only its type can make it a document.
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = name
    .slice(dot + 1)
    .trim()
    .toLowerCase();
  const match = Object.entries(DOCUMENT_TYPES).find(([, extensions]) =>
    extensions.includes(extension)
  );
  return match ? match[0] : null;
}

/** A PDF, Markdown, plain-text or Word file, by its type or its extension. */
export function isWorkDocument(file: Pick<File, "name" | "type">): boolean {
  return workDocumentType(file) !== null;
}

/** Whether `bytes` holds `pattern` anywhere. */
function containsBytes(bytes: Uint8Array, pattern: Uint8Array): boolean {
  for (let at = bytes.indexOf(pattern[0]); at !== -1; at = bytes.indexOf(pattern[0], at + 1)) {
    if (at + pattern.length > bytes.length) return false;
    if (pattern.every((byte, offset) => bytes[at + offset] === byte)) return true;
  }
  return false;
}
const DOCX_PARTS = ["[Content_Types].xml", "word/document.xml"].map((part) =>
  new TextEncoder().encode(part)
);
/** The stream every Word 97-2003 file holds, named in UTF-16 as compound files name them. */
const DOC_STREAM = Uint8Array.from(Array.from("WordDocument").flatMap((c) => [c.charCodeAt(0), 0]));

/**
 * Whether a document's bytes are what its type says. A document publishes as it
 * was picked, so a file renamed to look like one (an app or a web page called
 * `.pdf`) is refused rather than pinned under a type it is not. Every zip and
 * every compound file starts the same way, so a Word file is told by the parts
 * it holds. Text must be UTF-8. `bytes` is the whole file.
 */
export function documentMatchesType(type: string, bytes: Uint8Array): boolean {
  const startsWith = (...head: number[]) => head.every((byte, index) => bytes[index] === byte);
  switch (type) {
    case "application/pdf":
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (
        startsWith(0x50, 0x4b, 0x03, 0x04) && DOCX_PARTS.every((part) => containsBytes(bytes, part))
      );
    case "application/msword":
      return (
        startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1) &&
        containsBytes(bytes, DOC_STREAM)
      );
    case "text/plain":
    case "text/markdown":
      if (bytes.includes(0)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** A document's name as it publishes: the file name alone, on one line, at most 120 characters. */
export function publishedDocumentName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const printable = Array.from(base)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");
  return Array.from(printable.replace(/\s+/g, " ").trim()).slice(0, 120).join("") || "document";
}

/**
 * The documents published work metadata lists. Anyone can publish metadata, so
 * only entries with a content identifier are kept, their names are cleaned, and
 * no more than a work may carry are read. An unfamiliar type is kept for a
 * reader to show as a file, so a type added later still lists.
 */
export function readPublishedWorkDocuments(value: unknown): PublishedWorkDocument[] {
  if (!Array.isArray(value)) return [];
  const documents: PublishedWorkDocument[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { cid, type, name, size } = entry as Record<string, unknown>;
    if (typeof cid !== "string" || !/^[A-Za-z0-9]{20,120}$/.test(cid)) continue;
    documents.push({
      cid,
      type: typeof type === "string" ? type.slice(0, 120) : "",
      name: typeof name === "string" ? publishedDocumentName(name) : "document",
      size: typeof size === "number" && Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    });
    if (documents.length === WORK_DOCUMENT_MAX_COUNT) break;
  }
  return documents;
}

/** A work's file once uploaded: the CID it pinned as and the type its draft held. */
export interface UploadedWorkFile {
  file: File;
  cid: string;
  type: string;
}

/**
 * How a work's uploaded files publish. Photos and videos are the attestation's
 * media, in the order they were added, with their types in the metadata's
 * attachments. Documents publish in the metadata beside them, so a reader that
 * draws every media CID as a picture never meets one. Each type is the one the
 * draft held, as before documents, so a resumed upload's metadata hashes the same.
 */
export function publishedWorkFiles(uploaded: UploadedWorkFile[]) {
  const media: string[] = [];
  const attachments: Array<{ cid: string; type: string }> = [];
  const documents: Array<{ cid: string; type: string; name: string; size: number }> = [];
  for (const { file, cid, type } of uploaded) {
    if (isWorkDocument(file)) {
      documents.push({ cid, type, name: publishedDocumentName(file.name), size: file.size });
    } else {
      media.push(cid);
      attachments.push({ cid, type });
    }
  }
  return { media, attachments, documents };
}

/**
 * An attachment as it may be pinned. A photo loses its location and camera
 * metadata and a video its location, device and capture time, and one that
 * cannot lose them is refused rather than published as it was picked: IPFS and
 * the attestation cannot be withdrawn. Audio is published as it was recorded,
 * and a document as it was picked, its own fields included.
 */
export async function publishableWorkFile(file: File): Promise<File> {
  const video = !PHOTO_TYPES.has(file.type) && file.type.startsWith("video/");
  const published = PHOTO_TYPES.has(file.type)
    ? await withoutPhotoMetadata(file)
    : video
      ? await withoutVideoMetadata(file)
      : file;
  if (!published) throw new UnpublishablePhotoError(file.name, { video });
  return published;
}

export function validateWorkAttachments(
  media: File[],
  audio: File[] = [],
  minPhotos = 0,
  policy: WorkAttachmentPolicy = {}
): string[] {
  const isPhoto = (file: File) => isWorkPhoto(file, policy);
  // Documents travel with the photos and videos but are counted on their own.
  const visual = media.filter((file) => !isWorkDocument(file));
  const errors: string[] = [];
  if (media.filter(isPhoto).length < minPhotos) errors.push("photos-required");
  if (visual.length > 10) errors.push("media-count");
  if (media.length - visual.length > WORK_DOCUMENT_MAX_COUNT) errors.push("document-count");
  if (visual.some((file) => !isPhoto(file) && !VIDEO_TYPES.has(file.type)))
    errors.push("media-type");
  if (
    media.some(
      (file) =>
        file.size >
        (VIDEO_TYPES.has(file.type)
          ? WORK_VIDEO_MAX_BYTES
          : isWorkDocument(file)
            ? WORK_DOCUMENT_MAX_BYTES
            : 10 * MIB)
    )
  )
    errors.push("media-size");
  if (audio.some((file) => !file.type.startsWith("audio/"))) errors.push("audio-type");
  if ([...media, ...audio].some((file) => file.size === 0)) errors.push("empty-media");
  if ([...media, ...audio].reduce((sum, file) => sum + file.size, 0) > 50 * MIB)
    errors.push("total-size");
  return errors;
}

export async function validateWorkVideo(file: File): Promise<boolean> {
  if (!VIDEO_TYPES.has(file.type) || file.size > WORK_VIDEO_MAX_BYTES) return false;
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
