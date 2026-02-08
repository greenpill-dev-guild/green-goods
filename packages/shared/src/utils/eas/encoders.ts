import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import type { AssessmentDraft, WorkApprovalDraft, WorkDraft } from "../../types/domain";

import { getEASConfig } from "../../config/blockchain";
import { trackUploadBatchProgress, trackUploadError } from "../../modules/app/error-tracking";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";

/**
 * Maps MIME types to file extensions.
 * Returns the appropriate extension for a given MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
    "application/octet-stream": "bin",
  };

  // Extract subtype (e.g., "jpeg" from "image/jpeg" or "image/jpeg;charset=UTF-8")
  const subtype = mimeType.split("/")[1]?.split(";")[0];

  // Return mapped extension, or the subtype itself, or fallback to 'bin'
  return mimeMap[mimeType] || subtype || "bin";
}

/**
 * Simulates work data encoding with dummy IPFS hashes.
 * Used to validate contract interactions before performing expensive uploads.
 */
export function simulateWorkData(data: WorkDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  // Use dummy CID for simulation to avoid IPFS uploads
  const DUMMY_CID = "QmSimulationDummyHashForValidation000000000000";

  // Map media files to dummy CIDs - strictly maintaining array length
  const media = data.media.map(() => DUMMY_CID);

  // Use dummy CID for metadata JSON
  const metadataCID = DUMMY_CID;

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "title", value: data.title, type: "string" },
    { name: "feedback", value: data.feedback, type: "string" },
    { name: "metadata", value: metadataCID, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}

/**
 * Options for work data encoding
 */
export interface EncodeWorkDataOptions {
  /** Garden address for tracking context */
  gardenAddress?: string;
  /** Auth mode for tracking context */
  authMode?: "passkey" | "wallet" | null;
}

/**
 * Uploads supporting files and encodes a work attestation payload for EAS.
 * Includes comprehensive tracking for debugging upload failures.
 */
export async function encodeWorkData(
  data: WorkDraft,
  chainId: number | string,
  options: EncodeWorkDataOptions = {}
) {
  const startTime = Date.now();
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  // Calculate total size for tracking
  const totalFiles = data.media.length;
  const totalSizeBytes = data.media.reduce((sum, file) => sum + (file?.size || 0), 0);

  // Track batch upload started
  trackUploadBatchProgress({
    stage: "started",
    totalFiles: totalFiles + 1, // +1 for metadata JSON
    completedFiles: 0,
    failedFiles: 0,
    totalSizeBytes,
    elapsedMs: 0,
    source: "encodeWorkData",
    gardenAddress: options.gardenAddress,
  });

  let completedFiles = 0;
  let failedFiles = 0;

  // Upload media files in PARALLEL for better performance
  // Normalize files first (synchronous operation) with proper type validation
  let normalizedFiles: File[];
  try {
    // Cast to unknown[] for defensive runtime validation (type may differ at runtime)
    normalizedFiles = (data.media as unknown[]).map((maybeFile, index) => {
      if (maybeFile instanceof File) {
        return maybeFile;
      }
      if (maybeFile instanceof Blob) {
        // Derive file extension from MIME type instead of hardcoding .jpg
        const ext = getExtensionFromMimeType(maybeFile.type || "application/octet-stream");
        return new File([maybeFile], `work-media-${Date.now()}-${index}.${ext}`, {
          type: maybeFile.type || "application/octet-stream",
          lastModified: Date.now(),
        });
      }
      throw new Error(`Invalid media item at index ${index}: expected File or Blob`);
    });
  } catch (error) {
    // Track normalization failures for debugging
    trackUploadError(error, {
      uploadCategory: "encoding",
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      authMode: options.authMode,
      userAction: "normalizing media files for submission",
      severity: "error",
      recoverable: false,
      metadata: {
        step: "normalize",
        mediaCount: data.media.length,
        contentTypes: data.media.slice(0, 5).map((f) => {
          // Runtime type check: f could be non-File at runtime despite typed as File[]
          const maybeFile = f as unknown;
          if (maybeFile && typeof maybeFile === "object" && "type" in maybeFile) {
            return (maybeFile as { type?: string }).type || "unknown";
          }
          return "unknown";
        }),
      },
    });
    throw error;
  }

  // Upload all files concurrently using Promise.allSettled for graceful error handling
  const uploadPromises = normalizedFiles.map((file, index) =>
    uploadFileToIPFS(file, {
      fileIndex: index,
      totalFiles: totalFiles,
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      authMode: options.authMode,
    }).then((result) => {
      completedFiles++;
      // Track individual file completion
      trackUploadBatchProgress({
        stage: "file_complete",
        totalFiles: totalFiles + 1,
        completedFiles,
        failedFiles,
        totalSizeBytes,
        elapsedMs: Date.now() - startTime,
        source: "encodeWorkData",
        gardenAddress: options.gardenAddress,
      });
      return { index, cid: result.cid };
    })
  );

  const uploadResults = await Promise.allSettled(uploadPromises);

  // Process results and handle any failures
  const media: string[] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  for (let i = 0; i < uploadResults.length; i++) {
    const result = uploadResults[i];
    if (result.status === "fulfilled") {
      media[result.value.index] = result.value.cid;
    } else {
      failedFiles++;
      const maybeFile = data.media[i];
      errors.push({ index: i, error: result.reason });

      // Track encoding-level error with full context
      trackUploadError(result.reason, {
        uploadCategory: "encoding",
        fileIndex: i,
        totalFiles: totalFiles,
        fileSize: maybeFile?.size,
        fileType: maybeFile?.type,
        fileName: maybeFile?.name,
        uploadDurationMs: Date.now() - startTime,
        source: "encodeWorkData",
        gardenAddress: options.gardenAddress,
        authMode: options.authMode,
        userAction: "encoding work data for submission",
        severity: "error",
        recoverable: true,
        metadata: {
          action_uid: data.actionUID,
          action_title: data.title,
          completed_files: completedFiles,
          total_files: totalFiles,
        },
      });
    }
  }

  // If any uploads failed, throw with details
  if (errors.length > 0) {
    trackUploadBatchProgress({
      stage: "failed",
      totalFiles: totalFiles + 1,
      completedFiles,
      failedFiles,
      totalSizeBytes,
      elapsedMs: Date.now() - startTime,
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      error: `${errors.length} file(s) failed to upload`,
    });
    const firstError = errors[0].error;
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }

  // Upload metadata JSON
  try {
    const metadata = await uploadJSONToIPFS(
      {
        plantSelection: data.plantSelection,
        plantCount: data.plantCount,
        timeSpentMinutes: data.timeSpentMinutes,
        clientWorkId: data.metadata?.clientWorkId,
        submittedAt: data.metadata?.submittedAt,
      },
      {
        source: "encodeWorkData",
        gardenAddress: options.gardenAddress,
        authMode: options.authMode,
        metadataType: "work_metadata",
      }
    );

    completedFiles++;

    // Track batch completion
    trackUploadBatchProgress({
      stage: "completed",
      totalFiles: totalFiles + 1,
      completedFiles,
      failedFiles,
      totalSizeBytes,
      elapsedMs: Date.now() - startTime,
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
    });

    const encodedData = schemaEncoder.encodeData([
      { name: "actionUID", value: data.actionUID, type: "uint256" },
      { name: "title", value: data.title, type: "string" },
      { name: "feedback", value: data.feedback, type: "string" },
      { name: "metadata", value: metadata.cid, type: "string" },
      { name: "media", value: media, type: "string[]" },
    ]) as `0x${string}`;

    return encodedData;
  } catch (error) {
    failedFiles++;

    // Track encoding-level error for metadata
    trackUploadError(error, {
      uploadCategory: "encoding",
      uploadDurationMs: Date.now() - startTime,
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      authMode: options.authMode,
      userAction: "encoding work metadata for submission",
      severity: "error",
      recoverable: true,
      metadata: {
        action_uid: data.actionUID,
        action_title: data.title,
        completed_files: completedFiles,
        total_files: totalFiles,
        failed_at: "metadata_upload",
      },
    });

    // Track batch failure
    trackUploadBatchProgress({
      stage: "failed",
      totalFiles: totalFiles + 1,
      completedFiles,
      failedFiles,
      totalSizeBytes,
      elapsedMs: Date.now() - startTime,
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/** Produces an EAS payload for work approval attestations without side effects. */
export function encodeWorkApprovalData(data: WorkApprovalDraft, chainId: number | string) {
  const easConfig = getEASConfig(chainId);
  const schema = easConfig.WORK_APPROVAL.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "workUID", value: data.workUID, type: "bytes32" },
    { name: "approved", value: data.approved, type: "bool" },
    { name: "feedback", value: data.feedback ?? "", type: "string" },
  ]) as `0x${string}`;

  return encodedData;
}

/**
 * Options for assessment data encoding
 */
export interface EncodeAssessmentDataOptions {
  /** Source for tracking context */
  source?: string;
  /** Auth mode for tracking context */
  authMode?: "passkey" | "wallet" | null;
}

/**
 * Prepares assessment attestation data, including IPFS uploads for metrics and media.
 * Includes comprehensive tracking for debugging upload failures.
 */
export async function encodeAssessmentData(
  data: AssessmentDraft,
  chainId: number | string,
  options: EncodeAssessmentDataOptions = {}
) {
  const startTime = Date.now();
  const easConfig = getEASConfig(chainId);
  if (!easConfig.ASSESSMENT || !easConfig.ASSESSMENT.schema) {
    throw new Error(`Assessment EAS config not found for chain ${chainId}`);
  }
  const schema = easConfig.ASSESSMENT.schema as `0x${string}`;
  const schemaEncoder = new SchemaEncoder(schema);

  const totalFiles = data.evidenceMedia.length;
  const totalSizeBytes = data.evidenceMedia.reduce((sum, file) => sum + (file?.size || 0), 0);

  trackUploadBatchProgress({
    stage: "started",
    totalFiles: totalFiles + 1, // +1 for metrics JSON
    completedFiles: 0,
    failedFiles: 0,
    totalSizeBytes,
    elapsedMs: 0,
    source: options.source ?? "encodeAssessmentData",
  });

  // Upload metrics to IPFS
  const metricsJSON = await uploadJSONToIPFS(data.metrics, {
    source: options.source ?? "encodeAssessmentData",
    authMode: options.authMode,
    metadataType: "assessment_metrics",
  });

  // Upload evidence media with tracking
  const evidenceMedia: string[] = [];
  for (let index = 0; index < data.evidenceMedia.length; index++) {
    const file = data.evidenceMedia[index];
    const result = await uploadFileToIPFS(file, {
      fileIndex: index,
      totalFiles: totalFiles,
      source: options.source ?? "encodeAssessmentData",
      authMode: options.authMode,
    });
    evidenceMedia.push(result.cid);

    trackUploadBatchProgress({
      stage: "file_complete",
      totalFiles: totalFiles + 1,
      completedFiles: index + 2, // +1 for metrics already uploaded
      failedFiles: 0,
      totalSizeBytes,
      elapsedMs: Date.now() - startTime,
      source: options.source ?? "encodeAssessmentData",
    });
  }

  trackUploadBatchProgress({
    stage: "completed",
    totalFiles: totalFiles + 1,
    completedFiles: totalFiles + 1,
    failedFiles: 0,
    totalSizeBytes,
    elapsedMs: Date.now() - startTime,
    source: options.source ?? "encodeAssessmentData",
  });

  const encodedData = schemaEncoder.encodeData([
    { name: "title", value: data.title, type: "string" },
    { name: "description", value: data.description, type: "string" },
    { name: "assessmentType", value: data.assessmentType, type: "string" },
    { name: "capitals", value: data.capitals, type: "string[]" },
    { name: "metricsJSON", value: metricsJSON.cid, type: "string" },
    { name: "evidenceMedia", value: evidenceMedia, type: "string[]" },
    { name: "reportDocuments", value: data.reportDocuments || [], type: "string[]" },
    { name: "impactAttestations", value: data.impactAttestations || [], type: "bytes32[]" },
    { name: "startDate", value: data.startDate, type: "uint256" },
    { name: "endDate", value: data.endDate, type: "uint256" },
    { name: "location", value: data.location, type: "string" },
    { name: "tags", value: data.tags, type: "string[]" },
  ]) as `0x${string}`;

  return encodedData;
}
