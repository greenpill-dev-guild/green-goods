/**
 * Converting HEIC photos, including ones picked before the decoder could load.
 *
 * The decoder is a lazy chunk in the offline-ready shell tier, so a steward can
 * reach the picker before it is on the device. A rejected dynamic import stays
 * rejected for the life of the document, so the import is attempted only when
 * it can succeed: the offline-ready files have arrived, or the origin has
 * answered recently. Until then a photo waits as it was picked.
 *
 * @module modules/work/heic-conversion
 */

import { CONFIRMED_ONLINE_MAX_AGE_MS, connectivityStore } from "../../stores/connectivity";
import { logger } from "../app/logger";
import { currentPwaShellTierStatus } from "../app/service-worker-registration";

export const HEIC_JPEG_QUALITY = 0.85;

/** The limits both composers apply to a photo before it is queued. */
export const WORK_PHOTO_COMPRESSION = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 2048,
  initialQuality: 0.8,
  useWebWorker: true,
};

export type HeicDecoder = typeof import("heic-to/csp");

export type HeicConversion =
  | { status: "converted"; file: File }
  /** The decoder cannot load yet. Nothing is wrong with the photo. */
  | { status: "unavailable" }
  /** The decoder loaded and could not read this photo. */
  | { status: "failed"; error: unknown };

/**
 * A failed import is not retried within this window, so a pick of several
 * photos tries once. After it, the next wake-up (the offline-ready tier
 * answering, or the connection returning) tries again: whether a browser keeps
 * a rejected dynamic import is not guaranteed, and retrying costs nothing when
 * it does.
 */
const DECODER_RETRY_AFTER_MS = 30_000;
let decoderLoad: Promise<HeicDecoder | null> | undefined;
let decoderFailedAt = Number.NEGATIVE_INFINITY;

/**
 * Whether importing the decoder can succeed now. An unstable connection is not
 * probed here: its own recheck publishes the recovery that callers listen for.
 */
async function canAttemptHeicDecoder(): Promise<boolean> {
  if (currentPwaShellTierStatus("priority") === "ready" || connectivityStore.isConfirmedOnline())
    return true;
  if (connectivityStore.getStatusSnapshot().state !== "online") return false;
  return connectivityStore.confirmOnline({ maxAgeMs: CONFIRMED_ONLINE_MAX_AGE_MS });
}

/** Import the decoder when it can load, sharing one import between callers. */
export async function loadHeicDecoder(): Promise<HeicDecoder | null> {
  if (decoderLoad) return decoderLoad;
  if (Date.now() - decoderFailedAt < DECODER_RETRY_AFTER_MS) return null;
  if (!(await canAttemptHeicDecoder())) return null;
  decoderLoad ??= import("heic-to/csp").catch((error: unknown) => {
    logger.warn("[WorkMedia] HEIC decoder could not load; waiting photos try again later", {
      error: error instanceof Error ? error.message : String(error),
    });
    decoderFailedAt = Date.now();
    decoderLoad = undefined;
    return null;
  });
  return decoderLoad;
}

function toJpegFileName(file: File): string {
  const dot = file.name.lastIndexOf(".");
  if (dot < 0 || dot === file.name.length - 1) return "converted-work-media.jpg";
  return `${file.name.slice(0, dot)}.jpg`;
}

export async function convertHeicToJpeg(
  decoder: HeicDecoder,
  file: File,
  quality: number = HEIC_JPEG_QUALITY
): Promise<File> {
  const convertedBlob = await decoder.heicTo({ blob: file, type: "image/jpeg", quality });
  return new File([convertedBlob], toJpegFileName(file), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

/** The picker compresses every photo it keeps; a late conversion gets the same treatment. */
async function compressLikePicker(file: File): Promise<File> {
  try {
    const { imageCompressor } = await import("../../utils/work/image-compression");
    if (!imageCompressor.shouldCompress(file, 1024)) return file;
    const [result] = await imageCompressor.compressImages([file], WORK_PHOTO_COMPRESSION);
    return result?.file ?? file;
  } catch (error) {
    // The picker keeps an uncompressed photo too; the attachment size limits still apply.
    logger.warn("[WorkMedia] Converted photo kept uncompressed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return file;
  }
}

/** Convert one waiting HEIC photo, or say why it cannot be converted yet. */
export async function convertHeicPhoto(file: File): Promise<HeicConversion> {
  const decoder = await loadHeicDecoder();
  if (!decoder) return { status: "unavailable" };
  try {
    const jpeg = await convertHeicToJpeg(decoder, file);
    return { status: "converted", file: await compressLikePicker(jpeg) };
  } catch (error) {
    return { status: "failed", error };
  }
}
