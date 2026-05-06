/**
 * File Serialization Utilities
 *
 * Provides cross-browser compatible file serialization for IndexedDB storage.
 * iOS Safari cannot store File objects directly due to structured cloning issues,
 * so we convert to ArrayBuffer + metadata which works reliably across all browsers.
 *
 * @module utils/storage/file-serialization
 */

import type { SerializedFileData } from "../../types/job-queue";

/**
 * Extension-to-MIME map for files that arrive with an empty `file.type`
 * (common on iOS camera captures, especially HEIC/HEIF). Defaulting to
 * "image/jpeg" for every empty type corrupts HEIC round-trips because the
 * reconstructed File advertises jpeg but the bytes are HEIF, so the browser
 * fails to decode it and shows a broken placeholder.
 */
const EXT_TO_MIME: Record<string, string> = {
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXT_TO_MIME[ext]) || "image/jpeg";
}

/**
 * Serialize a File to IndexedDB-safe format.
 * Converts File to ArrayBuffer + metadata to work around iOS Safari limitations.
 */
export async function serializeFile(file: File): Promise<SerializedFileData> {
  const arrayBuffer = await file.arrayBuffer();
  return {
    data: arrayBuffer,
    name: file.name,
    type: file.type || inferMimeType(file.name),
    lastModified: file.lastModified || Date.now(),
  };
}

/**
 * Deserialize stored file data back to a File object.
 * Handles multiple formats for backwards compatibility:
 * - New format: SerializedFileData with ArrayBuffer
 * - Legacy format: Direct File object (may fail on iOS)
 * - Fallback: Blob-like objects
 */
export function deserializeFile(
  stored: {
    fileData?: SerializedFileData;
    file?: File | Blob | unknown;
  },
  fallbackPrefix: string,
  fallbackId: string
): File {
  // New format: SerializedFileData
  if (stored.fileData?.data) {
    return new File([stored.fileData.data], stored.fileData.name, {
      type: stored.fileData.type,
      lastModified: stored.fileData.lastModified,
    });
  }

  // Legacy format: direct File object (may fail on iOS when reading)
  if (stored.file instanceof File) {
    return stored.file;
  }

  // Fallback: try to reconstruct from blob-like object
  if (stored.file) {
    const blob = stored.file as Blob;
    const name = (stored.file as { name?: string }).name;
    return new File([blob], name || `${fallbackPrefix}-${fallbackId}.jpg`, {
      type: blob?.type || "image/jpeg",
      lastModified: Date.now(),
    });
  }

  // Last resort: empty file (should not happen in practice)
  return new File([], `${fallbackPrefix}-${fallbackId}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Check if running on iOS Safari (for diagnostic purposes)
 */
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Build common metadata for storage error tracking
 */
export function buildFileMetadata(file: File, contextId: string) {
  return {
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    context_id: contextId,
    is_ios: isIOSSafari(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}
