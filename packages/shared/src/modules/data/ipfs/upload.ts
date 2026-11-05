import {
  getNetworkContext,
  trackUploadError,
  trackUploadSuccess,
  type UploadErrorCategory,
} from "../../app/error-tracking";
import { logger } from "../../app/logger";
import { withoutPhotoMetadata } from "../../media/image-metadata";
import { withoutVideoMetadata } from "../../media/video-metadata";
import {
  getIpfsInitializationError,
  getIpfsInitializationStatus,
  getPinataJwt,
  getPinataUploadSignUrl,
} from "./client";
import { uploadFileWithPinata, verifyPinataGatewayAvailability } from "./pinata";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context for tracking individual file uploads within a batch.
 * Pass this to get detailed tracking for each file in a multi-file upload.
 */
export interface FileUploadContext {
  /** Index of this file in the batch (0-based) */
  fileIndex?: number;
  /** Total number of files in the batch */
  totalFiles?: number;
  /** Source function/component initiating the upload */
  source?: string;
  /** Garden address if relevant */
  gardenAddress?: string;
  /** Auth mode if relevant */
  authMode?: "passkey" | "wallet" | "embedded" | null;
  /** Optional callback fired when this file upload completes or fails */
  onFileProgress?: (event: {
    fileIndex?: number;
    totalFiles?: number;
    status: "uploaded" | "failed";
  }) => void;
}

/**
 * Context for tracking JSON metadata uploads.
 */
export interface JsonUploadContext {
  /** Source function/component initiating the upload */
  source?: string;
  /** Garden address if relevant */
  gardenAddress?: string;
  /** Auth mode if relevant */
  authMode?: "passkey" | "wallet" | "embedded" | null;
  /** Type of metadata being uploaded */
  metadataType?: string;
}

export interface IpfsPinner {
  pinFile(file: File, context?: FileUploadContext): Promise<{ cid: string }>;
  pinJson(json: Record<string, unknown>, context?: JsonUploadContext): Promise<{ cid: string }>;
}

// ============================================================================
// SHARED UPLOAD HANDLER
// ============================================================================

/**
 * Common upload handler that wraps Pinata-backed IPFS uploads with error tracking.
 */
async function executeUpload<TContext extends { source?: string; gardenAddress?: string }>(
  uploadFn: () => Promise<string>,
  category: UploadErrorCategory,
  context: TContext,
  fileInfo: { size: number; type: string; name?: string; index?: number; total?: number },
  options: {
    provider: "pinata";
    verifyCid?: (cid: string) => Promise<void>;
  }
): Promise<{ cid: string }> {
  const startTime = Date.now();

  if (!getPinataUploadSignUrl() && !getPinataJwt()) {
    const error = new Error(
      "IPFS upload service is not configured. Set VITE_API_BASE_URL before uploading."
    );
    trackUploadError(error, {
      uploadCategory: category,
      ipfsStatus: getIpfsInitializationStatus(),
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      fileName: fileInfo.name,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
      severity: "error",
      recoverable: false,
      metadata: { upload_init_error: getIpfsInitializationError(), provider: options.provider },
    });
    throw error;
  }

  try {
    const cid = await uploadFn();
    const uploadDuration = Date.now() - startTime;

    if (options.verifyCid) {
      options.verifyCid(cid).catch((verifyError) => {
        logger.warn("Gateway verification failed (non-blocking)", {
          cid,
          error: verifyError,
          provider: options.provider,
          ...getNetworkContext(),
        });
      });
    }

    trackUploadSuccess({
      uploadCategory: category,
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      uploadDurationMs: uploadDuration,
      cid,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
    });

    return { cid };
  } catch (error) {
    const uploadDuration = Date.now() - startTime;
    logger.error(`Failed to upload to ${options.provider} (${category})`, { error });

    trackUploadError(error, {
      uploadCategory: category,
      ipfsStatus: getIpfsInitializationStatus(),
      uploadDurationMs: uploadDuration,
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      fileName: fileInfo.name,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
      severity: "error",
      recoverable: true,
      metadata: { ...getNetworkContext(), provider: options.provider },
    });

    throw error;
  }
}

// ============================================================================
// WHAT MAY BE PINNED
// ============================================================================

/**
 * An image neither the byte-level rewrite nor a canvas could read, so it was
 * not pinned. A screen shows `app.common.imageUnreadable` for it; the message
 * is for logs.
 */
export class UnpublishableImageError extends Error {
  /** The image's file name. */
  readonly image: string;

  constructor(image: string) {
    super("The image could not be read to remove its metadata, so it was not uploaded");
    this.name = "UnpublishableImageError";
    this.image = image;
  }
}

/** A video whose container could not be read in full, so it was not pinned. */
class UnpublishableVideoError extends Error {
  constructor() {
    super("The video could not be read to remove its metadata, so it was not uploaded");
    this.name = "UnpublishableVideoError";
  }
}

/**
 * A file as it may be pinned. Nothing pinned to public IPFS can be withdrawn,
 * and cameras write where a photo or video was taken and the device that took
 * it into the file itself. So every image and video, by its type, loses that
 * metadata first, the way work media does: a JPEG, PNG or WebP is rewritten
 * without it, an image the rewrite cannot read, in another format or damaged,
 * is drawn again through a canvas, and a video's container is blanked where it
 * holds metadata. One that cannot be read is refused rather than pinned as it
 * was picked. Any other file is pinned as it is.
 */
async function publishableFile(file: File, context: FileUploadContext): Promise<File> {
  const image = file.type.startsWith("image/");
  if (!image && !file.type.startsWith("video/")) return file;
  const published = image ? await withoutPhotoMetadata(file) : await withoutVideoMetadata(file);
  if (published) return published;
  const refusal = image ? new UnpublishableImageError(file.name) : new UnpublishableVideoError();
  // Counted so refusals can be seen. This event carries no file name, though the compressor's
  // own events for an image's redraw attempt do.
  trackUploadError(refusal, {
    uploadCategory: "file_upload",
    fileSize: file.size,
    fileType: file.type,
    source: context.source ?? "uploadFileToIPFS",
    gardenAddress: context.gardenAddress,
    severity: "warning",
    recoverable: false,
  });
  throw refusal;
}

// ============================================================================
// PUBLIC UPLOAD FUNCTIONS
// ============================================================================

/**
 * Uploads a file to IPFS using Pinata with comprehensive error tracking. An
 * image or video is pinned without its location, camera or other metadata.
 *
 * @param file - The file to upload
 * @param context - Optional context for batch tracking
 * @returns Object containing the IPFS CID
 * @throws Error if an image or video cannot be read to remove its metadata, if
 * Pinata is not configured, or if the upload fails
 */
export async function uploadFileToIPFS(
  file: File,
  context: FileUploadContext = {}
): Promise<{ cid: string }> {
  try {
    const published = await publishableFile(file, context);
    const result = await executeUpload(
      () =>
        uploadFileWithPinata(published, {
          name: published.name,
          category: "file_upload",
          source: context.source ?? "uploadFileToIPFS",
          gardenAddress: context.gardenAddress,
        }),
      "file_upload",
      { source: context.source ?? "uploadFileToIPFS", gardenAddress: context.gardenAddress },
      {
        size: published.size,
        type: published.type,
        name: published.name,
        index: context.fileIndex,
        total: context.totalFiles,
      },
      {
        provider: "pinata",
        verifyCid: (cid) => verifyPinataGatewayAvailability(cid),
      }
    );

    context.onFileProgress?.({
      fileIndex: context.fileIndex,
      totalFiles: context.totalFiles,
      status: "uploaded",
    });

    return result;
  } catch (error) {
    context.onFileProgress?.({
      fileIndex: context.fileIndex,
      totalFiles: context.totalFiles,
      status: "failed",
    });
    throw error;
  }
}

/**
 * Uploads JSON metadata to IPFS using Pinata with comprehensive error tracking.
 *
 * @param json - The JSON object to upload
 * @param context - Optional context for tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Pinata is not configured or upload fails
 */
export async function uploadJSONToIPFS(
  json: Record<string, unknown>,
  context: JsonUploadContext = {}
): Promise<{ cid: string }> {
  const jsonString = JSON.stringify(json);
  const blob = new Blob([jsonString], { type: "application/json" });
  const file = new File([blob], "metadata.json", { type: "application/json" });

  return executeUpload(
    () =>
      uploadFileWithPinata(file, {
        name: "metadata.json",
        category: "json_upload",
        source: context.source ?? "uploadJSONToIPFS",
        gardenAddress: context.gardenAddress,
      }),
    "json_upload",
    { source: context.source ?? "uploadJSONToIPFS", gardenAddress: context.gardenAddress },
    { size: file.size, type: "application/json", name: "metadata.json" },
    {
      provider: "pinata",
      verifyCid: (cid) => verifyPinataGatewayAvailability(cid),
    }
  );
}

export const ipfsPinner: IpfsPinner = {
  pinFile: uploadFileToIPFS,
  pinJson: uploadJSONToIPFS,
};
