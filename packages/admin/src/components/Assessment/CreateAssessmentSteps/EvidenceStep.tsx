import { imageCompressor, toastService } from "@green-goods/shared";
import { resolveIPFSUrl, uploadFileToIPFS } from "@green-goods/shared/modules";
import { RiLoader4Line, RiUploadCloudLine } from "@remixicon/react";
import { useMemo, useRef, useState } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";
import { FileUploadField } from "../../FileUploadField";
import {
  ArrayInput,
  type CreateAssessmentForm,
  extractErrorMessage,
  LabeledField,
  textareaClassName,
} from "./shared";

interface EvidenceStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
  evidenceFiles: File[];
  setEvidenceFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setValue: UseFormSetValue<CreateAssessmentForm>;
  getValues: () => CreateAssessmentForm;
}

export function EvidenceStep({
  register,
  errors,
  control,
  isSubmitting,
  evidenceFiles,
  setEvidenceFiles,
  setValue,
  getValues,
}: EvidenceStepProps) {
  const [isCompressingEvidence, setIsCompressingEvidence] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metricsValue = useWatch({ control, name: "metrics" });

  const metricsPreview = useMemo(() => {
    if (!metricsValue) return null;
    try {
      return JSON.parse(metricsValue);
    } catch {
      return null;
    }
  }, [metricsValue]);

  const handleEvidenceChange = async (files: File[]) => {
    if (!files.length) return;

    setIsCompressingEvidence(true);
    setCompressionProgress(0);

    const imagesToCompress = files.filter((file) => imageCompressor.shouldCompress(file, 1024));
    const filesToKeep = files.filter((file) => !imageCompressor.shouldCompress(file, 1024));

    const finalFiles: File[] = [...filesToKeep];
    const failedFiles: string[] = [];

    // Process images individually to prevent one failure from affecting others
    if (imagesToCompress.length > 0) {
      for (let i = 0; i < imagesToCompress.length; i++) {
        const file = imagesToCompress[i];
        try {
          const results = await imageCompressor.compressImages(
            [file],
            { maxSizeMB: 0.8, maxWidthOrHeight: 2048 },
            (progress) => {
              // Calculate overall progress across all images
              const overallProgress = ((i + progress / 100) / imagesToCompress.length) * 100;
              setCompressionProgress(overallProgress);
            }
          );

          const compressedFile = results[0]?.file;
          if (compressedFile) {
            finalFiles.push(compressedFile);
          } else {
            // If compression returned nothing, keep original
            finalFiles.push(file);
          }
        } catch (error) {
          console.error(`Failed to compress ${file.name}:`, error);
          failedFiles.push(file.name);
          // Keep the original file if compression fails
          finalFiles.push(file);
        }
      }
    }

    // Always add files that were successfully processed or didn't need compression
    setEvidenceFiles((prev) => [...prev, ...finalFiles]);

    // Show appropriate feedback
    if (failedFiles.length > 0) {
      toastService.info({
        title: "Some images could not be compressed",
        message: `${failedFiles.length} ${failedFiles.length === 1 ? "file" : "files"} kept at original size: ${failedFiles.join(", ")}`,
        context: "evidence compression",
      });
    } else if (imagesToCompress.length > 0) {
      toastService.success({
        title: "Images compressed",
        message: `${imagesToCompress.length} ${imagesToCompress.length === 1 ? "image" : "images"} successfully compressed`,
        context: "evidence compression",
        suppressLogging: true,
      });
    }

    setIsCompressingEvidence(false);
    setCompressionProgress(0);
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleReportDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDocument(true);

    const fileArray = Array.from(files);
    const results: { file: File; url?: string; error?: Error }[] = [];

    // Upload all files, tracking individual successes and failures
    for (const file of fileArray) {
      try {
        const result = await uploadFileToIPFS(file);
        const url = resolveIPFSUrl(result.cid);
        results.push({ file, url });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        results.push({ file, error: error as Error });
      }
    }

    const successfulUploads = results.filter((r) => r.url);
    const failedUploads = results.filter((r) => r.error);

    // Add all successful URLs to form state in one batch
    if (successfulUploads.length > 0) {
      const currentDocs = getValues().reportDocuments || [];
      const newUrls = successfulUploads.map((r) => r.url!);
      setValue("reportDocuments", [...currentDocs, ...newUrls] as any);
    }

    // Track failed files for retry (excluding duplicates from previous attempts)
    if (failedUploads.length > 0) {
      const newFailedFiles = failedUploads.map((r) => r.file);
      setFailedFiles((prev) => {
        // Remove duplicates by name
        const existingNames = new Set(prev.map((f) => f.name));
        const uniqueNewFiles = newFailedFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...uniqueNewFiles];
      });
    }

    // Show appropriate feedback based on results
    if (failedUploads.length === 0) {
      // All succeeded
      toastService.success({
        title: "Documents uploaded",
        message: `${successfulUploads.length} ${successfulUploads.length === 1 ? "document" : "documents"} uploaded to IPFS`,
        context: "document upload",
        suppressLogging: true,
      });
      // Clear failed files on full success
      setFailedFiles([]);
    } else if (successfulUploads.length === 0) {
      // All failed
      toastService.error({
        title: "Upload failed",
        message: `Failed to upload ${failedUploads.length} ${failedUploads.length === 1 ? "document" : "documents"}. Click "Retry failed uploads" to try again.`,
        context: "document upload",
        error: failedUploads[0].error,
      });
    } else {
      // Partial success
      toastService.info({
        title: "Partial upload",
        message: `${successfulUploads.length} uploaded, ${failedUploads.length} failed. Failed files: ${failedUploads.map((r) => r.file.name).join(", ")}. Click "Retry failed uploads" to try again.`,
        context: "document upload",
      });
    }

    setIsUploadingDocument(false);
    // Clear input to allow re-selecting same files if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRetryFailedUploads = async () => {
    if (failedFiles.length === 0) return;

    setIsUploadingDocument(true);

    const results: { file: File; url?: string; error?: Error }[] = [];

    // Retry all failed files
    for (const file of failedFiles) {
      try {
        const result = await uploadFileToIPFS(file);
        const url = resolveIPFSUrl(result.cid);
        results.push({ file, url });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        results.push({ file, error: error as Error });
      }
    }

    const successfulUploads = results.filter((r) => r.url);
    const stillFailedUploads = results.filter((r) => r.error);

    // Add successful URLs to form state
    if (successfulUploads.length > 0) {
      const currentDocs = getValues().reportDocuments || [];
      const newUrls = successfulUploads.map((r) => r.url!);
      setValue("reportDocuments", [...currentDocs, ...newUrls] as any);
    }

    // Update failed files list to only include files that still failed
    setFailedFiles(stillFailedUploads.map((r) => r.file));

    // Show feedback
    if (stillFailedUploads.length === 0) {
      toastService.success({
        title: "Retry successful",
        message: `All ${successfulUploads.length} ${successfulUploads.length === 1 ? "document" : "documents"} uploaded successfully`,
        context: "document upload retry",
        suppressLogging: true,
      });
    } else if (successfulUploads.length === 0) {
      toastService.error({
        title: "Retry failed",
        message: `All ${stillFailedUploads.length} ${stillFailedUploads.length === 1 ? "document" : "documents"} still failed. Please check your connection and try again.`,
        context: "document upload retry",
        error: stillFailedUploads[0].error,
      });
    } else {
      toastService.info({
        title: "Partial retry success",
        message: `${successfulUploads.length} uploaded, ${stillFailedUploads.length} still failed: ${stillFailedUploads.map((r) => r.file.name).join(", ")}`,
        context: "document upload retry",
      });
    }

    setIsUploadingDocument(false);
  };

  return (
    <div className="space-y-3">
      <LabeledField label="Metrics JSON" required error={errors.metrics?.message}>
        <textarea
          rows={5}
          disabled={isSubmitting}
          className={textareaClassName(errors.metrics)}
          placeholder='{\n  "indicators": []\n}'
          {...register("metrics")}
        />
      </LabeledField>
      {metricsPreview ? (
        <div className="rounded-lg border border-gray-100 bg-bg-weak p-4 text-xs text-text-sub/60">
          <p className="mb-2 font-medium text-text-sub">Metrics preview</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-text-sub">
            {JSON.stringify(metricsPreview, null, 2)}
          </pre>
        </div>
      ) : null}
      <div className="space-y-2">
        <FileUploadField
          label="Evidence media"
          helpText="Upload photos, videos, or supporting files. Images will be compressed and pinned to IPFS."
          accept="image/*,video/*,application/pdf"
          multiple={true}
          compress={true}
          showPreview={true}
          disabled={isSubmitting || isCompressingEvidence}
          onFilesChange={handleEvidenceChange}
          currentFiles={evidenceFiles}
          onRemoveFile={removeEvidenceFile}
        />
        {isCompressingEvidence && (
          <div className="flex items-center gap-2 text-xs text-text-sub">
            <RiLoader4Line className="h-4 w-4 animate-spin" />
            <span>Compressing images... {Math.round(compressionProgress)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1">
            <ArrayInput
              control={control as any}
              name="reportDocuments"
              label="Report documents"
              placeholder="https://... or IPFS CID"
              helper="Paste URLs or IPFS CIDs for supporting documents, or upload files."
              emptyHint="No report documents added."
              disabled={isSubmitting}
              error={extractErrorMessage(errors.reportDocuments as any)}
              addLabel="Add URL"
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleReportDocumentUpload}
          disabled={isSubmitting || isUploadingDocument}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isUploadingDocument}
            className="inline-flex items-center gap-2 rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60/80"
          >
            {isUploadingDocument ? (
              <>
                <RiLoader4Line className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <RiUploadCloudLine className="h-4 w-4" />
                <span>Upload files to IPFS</span>
              </>
            )}
          </button>
          {failedFiles.length > 0 && (
            <button
              type="button"
              onClick={handleRetryFailedUploads}
              disabled={isSubmitting || isUploadingDocument}
              className="inline-flex items-center gap-2 rounded-md border border-warning-base bg-warning-lighter px-3 py-2 text-sm font-medium text-warning-dark transition hover:bg-warning-base hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RiLoader4Line className="h-4 w-4" />
              <span>Retry failed uploads ({failedFiles.length})</span>
            </button>
          )}
        </div>
        {failedFiles.length > 0 && (
          <div className="rounded-md bg-warning-lighter border border-warning-base p-3 text-xs">
            <p className="font-medium text-warning-dark mb-1">Failed uploads:</p>
            <ul className="list-disc list-inside text-warning-dark/80 space-y-0.5">
              {failedFiles.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ArrayInput
        control={control as any}
        name="impactAttestations"
        label="Related impact attestations"
        placeholder="0x..."
        helper="Reference related EAS attestations using their 32-byte UID."
        emptyHint="No attestation references added."
        disabled={isSubmitting}
        error={extractErrorMessage(errors.impactAttestations as any)}
        addLabel="Add attestation"
        transformValue={(value) => value.toLowerCase()}
      />
    </div>
  );
}
