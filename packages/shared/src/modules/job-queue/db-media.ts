import type { Job, SerializedFileData } from "../../types/job-queue";
import { normalizeToFile } from "../../utils/app/normalizeToFile";
import { buildFileMetadata, serializeFile } from "../../utils/storage/file-serialization";
import { addBreadcrumb } from "../app/error-tracking";
import { trackPrivateQueueEvent } from "./job-analytics";

export async function serializeJobMedia(
  id: string,
  job: Pick<Job, "kind" | "payload">
): Promise<Array<{ file: File; fileData: SerializedFileData }>> {
  const normalizedMediaFiles: File[] = [];

  if (job.payload && typeof job.payload === "object" && "media" in job.payload) {
    const media = (job.payload as { media?: File[] }).media;
    if (Array.isArray(media)) {
      for (let index = 0; index < media.length; index++) {
        const file = normalizeToFile(media[index] as unknown, {
          fallbackName: `work-${id}-${index}.jpg`,
        });
        if (!file) throw new Error(`Invalid work media at index ${index}`);
        normalizedMediaFiles.push(file);
      }
    }
  }

  if (job.payload && typeof job.payload === "object" && "audioNotes" in job.payload) {
    const audioNotes = (job.payload as { audioNotes?: File[] }).audioNotes;
    if (Array.isArray(audioNotes)) {
      for (let index = 0; index < audioNotes.length; index++) {
        const file = normalizeToFile(audioNotes[index] as unknown, {
          fallbackName: `audio-note-${id}-${index}.webm`,
        });
        if (file) normalizedMediaFiles.push(file);
      }
    }
  }

  const serializedFiles: Array<{ file: File; fileData: SerializedFileData }> = [];
  for (const file of normalizedMediaFiles) {
    try {
      serializedFiles.push({ file, fileData: await serializeFile(file) });
    } catch (error) {
      trackPrivateQueueEvent("job_queue_file_serialization_failed", {
        ...buildFileMetadata(file),
        job_kind: job.kind,
      });
      throw error;
    }
  }

  addBreadcrumb("job_files_serialized", {
    file_count: serializedFiles.length,
    total_size: serializedFiles.reduce((sum, entry) => sum + entry.file.size, 0),
  });
  return serializedFiles;
}
