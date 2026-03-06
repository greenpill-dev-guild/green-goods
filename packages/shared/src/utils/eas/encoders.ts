import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { getEASConfig } from "../../config/blockchain";
import { trackUploadBatchProgress, trackUploadError } from "../../modules/app/error-tracking";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";
import type {
  AssessmentDraft,
  Domain,
  WorkApprovalDraft,
  WorkDraft,
  WorkMetadata,
} from "../../types/domain";

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
  /** Per-file upload progress callback */
  onFileProgress?: (progress: { completed: number; total: number; fileIndex: number }) => void;
  /** Domain for v2 metadata */
  domain?: Domain;
  /** Action slug for v2 metadata */
  actionSlug?: string;
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
      options.onFileProgress?.({
        completed: completedFiles,
        total: totalFiles,
        fileIndex: index,
      });
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

  // Upload audio notes to IPFS (if any)
  let audioNoteCids: string[] = [];
  if (data.audioNotes && data.audioNotes.length > 0) {
    const audioUploadPromises = data.audioNotes.map((file, index) =>
      uploadFileToIPFS(file, {
        fileIndex: index,
        totalFiles: data.audioNotes!.length,
        source: "encodeWorkData:audio",
        gardenAddress: options.gardenAddress,
        authMode: options.authMode,
      }).then((result) => result.cid)
    );

    const audioResults = await Promise.allSettled(audioUploadPromises);
    audioNoteCids = audioResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);

    // Audio notes are explicit evidence; fail fast if any upload fails so users
    // can retry instead of silently submitting incomplete evidence.
    const audioFailures = audioResults.filter((r) => r.status === "rejected");
    if (audioFailures.length > 0) {
      trackUploadError(new Error(`${audioFailures.length} audio file(s) failed to upload`), {
        uploadCategory: "encoding",
        source: "encodeWorkData:audio",
        gardenAddress: options.gardenAddress,
        authMode: options.authMode,
        userAction: "uploading audio notes",
        severity: "warning",
        recoverable: true,
      });
      throw new Error(
        `Failed to upload ${audioFailures.length} audio note${audioFailures.length === 1 ? "" : "s"}. Please retry.`
      );
    }
  }

  // Upload metadata JSON (v2 if domain/slug provided, legacy otherwise)
  try {
    const isV2 = options.domain !== undefined && options.actionSlug !== undefined;

    const metadataPayload: WorkMetadata | Record<string, unknown> = isV2
      ? {
          schemaVersion: "work_metadata_v2" as const,
          domain: options.domain!,
          actionSlug: options.actionSlug!,
          timeSpentMinutes: data.timeSpentMinutes ?? 0,
          details: data.details ?? {},
          ...(data.tags && data.tags.length > 0 ? { tags: data.tags } : {}),
          ...(audioNoteCids.length > 0 ? { audioNoteCids } : {}),
          clientWorkId:
            ((data as unknown as Record<string, unknown>).clientWorkId as string) ||
            crypto.randomUUID(),
          submittedAt: new Date().toISOString(),
        }
      : {
          // Legacy v1 format for backward compatibility during transition
          details: data.details ?? {},
          timeSpentMinutes: data.timeSpentMinutes,
          ...(data.tags && data.tags.length > 0 ? { tags: data.tags } : {}),
          ...(audioNoteCids.length > 0 ? { audioNoteCids } : {}),
        };

    const metadata = await uploadJSONToIPFS(metadataPayload as Record<string, unknown>, {
      source: "encodeWorkData",
      gardenAddress: options.gardenAddress,
      authMode: options.authMode,
      metadataType: isV2 ? "work_metadata_v2" : "work_metadata",
    });

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
    { name: "confidence", value: data.confidence, type: "uint8" },
    { name: "verificationMethod", value: data.verificationMethod, type: "uint8" },
    { name: "reviewNotesCID", value: data.reviewNotesCID ?? "", type: "string" },
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
 * Assessment v2 IPFS JSON payload.
 * Contains the full strategy kernel, domain selection, harvest intent,
 * SDG alignment, and attachment CIDs. Referenced by CID in the EAS attestation.
 */
export interface AssessmentConfigPayload {
  schemaVersion: "assessment_v2";
  diagnosis: string;
  smartOutcomes: Array<{ description: string; metric: string; target: number }>;
  cynefinPhase: number;
  domain: number;
  selectedActionUIDs: string[];
  reportingPeriod: { start: number; end: number };
  sdgTargets: number[];
  attachments: Array<{ name: string; cid: string; mimeType: string }>;
}

/**
 * Prepares assessment v2 attestation data.
 * Uploads attachments to IPFS, builds the full assessment config JSON,
 * uploads it to IPFS, and encodes the EAS attestation with the config CID.
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

  const totalFiles = data.attachments.length;
  const totalSizeBytes = data.attachments.reduce((sum, file) => sum + (file?.size || 0), 0);

  trackUploadBatchProgress({
    stage: "started",
    totalFiles: totalFiles + 1, // +1 for config JSON
    completedFiles: 0,
    failedFiles: 0,
    totalSizeBytes,
    elapsedMs: 0,
    source: options.source ?? "encodeAssessmentData",
  });

  // Upload attachment files to IPFS
  const attachmentCids: Array<{ name: string; cid: string; mimeType: string }> = [];
  for (let index = 0; index < data.attachments.length; index++) {
    const file = data.attachments[index];
    const result = await uploadFileToIPFS(file, {
      fileIndex: index,
      totalFiles,
      source: options.source ?? "encodeAssessmentData",
      authMode: options.authMode,
    });
    attachmentCids.push({
      name: file.name,
      cid: result.cid,
      mimeType: file.type || "application/octet-stream",
    });

    trackUploadBatchProgress({
      stage: "file_complete",
      totalFiles: totalFiles + 1,
      completedFiles: index + 1,
      failedFiles: 0,
      totalSizeBytes,
      elapsedMs: Date.now() - startTime,
      source: options.source ?? "encodeAssessmentData",
    });
  }

  // Build the full assessment config JSON
  const configPayload: AssessmentConfigPayload = {
    schemaVersion: "assessment_v2",
    diagnosis: data.diagnosis,
    smartOutcomes: data.smartOutcomes,
    cynefinPhase: data.cynefinPhase,
    domain: data.domain,
    selectedActionUIDs: data.selectedActionUIDs,
    reportingPeriod: data.reportingPeriod,
    sdgTargets: data.sdgTargets,
    attachments: attachmentCids,
  };

  // Upload config JSON to IPFS
  const configResult = await uploadJSONToIPFS(configPayload as unknown as Record<string, unknown>, {
    source: options.source ?? "encodeAssessmentData",
    authMode: options.authMode,
    metadataType: "assessment_config_v2",
  });

  trackUploadBatchProgress({
    stage: "completed",
    totalFiles: totalFiles + 1,
    completedFiles: totalFiles + 1,
    failedFiles: 0,
    totalSizeBytes,
    elapsedMs: Date.now() - startTime,
    source: options.source ?? "encodeAssessmentData",
  });

  // Encode EAS attestation data
  // The on-chain schema will include assessmentConfigCID for the full JSON
  const encodedData = schemaEncoder.encodeData([
    { name: "title", value: data.title, type: "string" },
    { name: "description", value: data.description, type: "string" },
    { name: "assessmentConfigCID", value: configResult.cid, type: "string" },
    { name: "domain", value: data.domain, type: "uint8" },
    { name: "startDate", value: data.reportingPeriod.start, type: "uint256" },
    { name: "endDate", value: data.reportingPeriod.end, type: "uint256" },
    { name: "location", value: data.location, type: "string" },
  ]) as `0x${string}`;

  return encodedData;
}
