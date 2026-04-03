import {
  getNetworkContext,
  trackUploadError,
  trackUploadSuccess,
  type UploadErrorCategory,
} from "../../app/error-tracking";
import { logger } from "../../app/logger";
import {
  getGatewayUrl,
  getIpfsInitializationStatus,
  getIpfsInitializationError,
  getPinataJwt,
  getStorachaClient,
} from "./client";
import {
  ensureStorachaGatewayAvailability,
  uploadFileWithPinata,
  verifyPinataGatewayAvailability,
} from "./pinata";

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
 * Common upload handler that wraps Storacha upload with error tracking
 */
async function executeUpload<TContext extends { source?: string; gardenAddress?: string }>(
  uploadFn: () => Promise<string>,
  category: UploadErrorCategory,
  context: TContext,
  fileInfo: { size: number; type: string; name?: string; index?: number; total?: number },
  options: {
    provider: "pinata" | "storacha";
    verifyCid?: (cid: string) => Promise<void>;
  }
): Promise<{ cid: string }> {
  const startTime = Date.now();

  if (options.provider === "storacha" && !getStorachaClient()) {
    const error = new Error("Storacha not initialized. Call initializeIpfs() first.");
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
      metadata: { storacha_error: getIpfsInitializationError(), provider: options.provider },
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
 * Uploads a file to IPFS using Storacha with comprehensive error tracking.
 *
 * @param file - The file to upload
 * @param context - Optional context for batch tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Storacha not initialized or upload fails
 */
export async function uploadFileToIPFS(
  file: File,
  context: FileUploadContext = {}
): Promise<{ cid: string }> {
  try {
    const pinataReady = Boolean(getPinataJwt());
    const result = await executeUpload(
      async () => {
        if (pinataReady) {
          return uploadFileWithPinata(file, {
            name: file.name,
            category: "file_upload",
            source: context.source ?? "uploadFileToIPFS",
            gardenAddress: context.gardenAddress,
          });
        }

        return (await getStorachaClient()!.uploadFile(file)).toString();
      },
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
        provider: pinataReady ? "pinata" : "storacha",
        verifyCid: pinataReady
          ? (cid) => verifyPinataGatewayAvailability(cid)
          : (cid) => ensureStorachaGatewayAvailability(cid, getGatewayUrl()),
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
 * Uploads JSON metadata to IPFS using Storacha with comprehensive error tracking.
 *
 * @param json - The JSON object to upload
 * @param context - Optional context for tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Storacha not initialized or upload fails
 */
export async function uploadJSONToIPFS(
  json: Record<string, unknown>,
  context: JsonUploadContext = {}
): Promise<{ cid: string }> {
  const jsonString = JSON.stringify(json);
  const blob = new Blob([jsonString], { type: "application/json" });
  const file = new File([blob], "metadata.json", { type: "application/json" });
  const pinataReady = Boolean(getPinataJwt());

  return executeUpload(
    async () => {
      if (pinataReady) {
        return uploadFileWithPinata(file, {
          name: "metadata.json",
          category: "json_upload",
          source: context.source ?? "uploadJSONToIPFS",
          gardenAddress: context.gardenAddress,
        });
      }

      return (await getStorachaClient()!.uploadFile(file)).toString();
    },
    "json_upload",
    { source: context.source ?? "uploadJSONToIPFS", gardenAddress: context.gardenAddress },
    { size: file.size, type: "application/json", name: "metadata.json" },
    {
      provider: pinataReady ? "pinata" : "storacha",
      verifyCid: pinataReady
        ? (cid) => verifyPinataGatewayAvailability(cid)
        : (cid) => ensureStorachaGatewayAvailability(cid, getGatewayUrl()),
    }
  );
}
