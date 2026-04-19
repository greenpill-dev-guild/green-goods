import {
  getNetworkContext,
  trackUploadError,
  trackUploadSuccess,
  type UploadErrorCategory,
} from "../../app/error-tracking";
import { logger } from "../../app/logger";
import { getIpfsInitializationError, getIpfsInitializationStatus, getPinataJwt } from "./client";
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

  if (!getPinataJwt()) {
    const error = new Error(
      "IPFS upload service is not configured. Set PINATA_JWT before uploading."
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
// PUBLIC UPLOAD FUNCTIONS
// ============================================================================

/**
 * Uploads a file to IPFS using Pinata with comprehensive error tracking.
 *
 * @param file - The file to upload
 * @param context - Optional context for batch tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Pinata is not configured or upload fails
 */
export async function uploadFileToIPFS(
  file: File,
  context: FileUploadContext = {}
): Promise<{ cid: string }> {
  try {
    const result = await executeUpload(
      () =>
        uploadFileWithPinata(file, {
          name: file.name,
          category: "file_upload",
          source: context.source ?? "uploadFileToIPFS",
          gardenAddress: context.gardenAddress,
        }),
      "file_upload",
      { source: context.source ?? "uploadFileToIPFS", gardenAddress: context.gardenAddress },
      {
        size: file.size,
        type: file.type,
        name: file.name,
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
