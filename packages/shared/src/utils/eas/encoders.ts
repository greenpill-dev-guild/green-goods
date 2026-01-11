import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { getEASConfig } from "../../config/blockchain";
import { trackUploadBatchProgress, trackUploadError } from "../../modules/app/error-tracking";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";

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

  // Upload media files with individual tracking
  const media: string[] = [];
  for (let index = 0; index < data.media.length; index++) {
    const maybeFile = data.media[index];

    try {
      // Normalize to proper File object (IndexedDB may strip metadata)
      const file =
        maybeFile instanceof File
          ? maybeFile
          : new File([maybeFile as Blob], `work-media-${Date.now()}-${index}.jpg`, {
              type: (maybeFile as Blob).type || "image/jpeg",
              lastModified: Date.now(),
            });

      const result = await uploadFileToIPFS(file, {
        fileIndex: index,
        totalFiles: totalFiles,
        source: "encodeWorkData",
        gardenAddress: options.gardenAddress,
        authMode: options.authMode,
      });

      media.push(result.cid);
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
    } catch (error) {
      failedFiles++;

      // Track encoding-level error with full context
      trackUploadError(error, {
        uploadCategory: "encoding",
        fileIndex: index,
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

  // Upload metadata JSON
  try {
    const metadata = await uploadJSONToIPFS(
      {
        plantSelection: data.plantSelection,
        plantCount: data.plantCount,
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
