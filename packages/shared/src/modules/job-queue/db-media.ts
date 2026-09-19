import { identifyWorkFile } from "../work/work-attachments";
import type { Job, SerializedFileData, JobQueueDBImage } from "../../types/job-queue";
import { normalizeToFile } from "../../utils/app/normalizeToFile";
import { buildFileMetadata, serializeFile } from "../../utils/storage/file-serialization";
import { addBreadcrumb } from "../app/error-tracking";
import { trackPrivateQueueEvent } from "./job-analytics";

async function serializeJobMedia(
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

export async function createJobMediaRows(
  id: string,
  job: Pick<Job, "kind" | "payload">,
  timestamp: number
): Promise<JobQueueDBImage[]> {
  const files = await serializeJobMedia(id, job);
  const rows: JobQueueDBImage[] = [];
  for (const [order, { file, fileData }] of files.entries()) {
    const identity = await identifyWorkFile(file);
    rows.push({
      id: crypto.randomUUID(),
      jobId: id,
      attachmentId: identity.id,
      contentHash: identity.contentHash,
      fileData,
      order,
      createdAt: timestamp,
    });
  }
  return rows;
}

export function serializeJobPayload(job: Pick<Job, "kind" | "payload">): unknown {
  if (job.kind !== "work" || !job.payload || typeof job.payload !== "object") return job.payload;
  const { media: _media, audioNotes: _audio, ...payload } = job.payload as Record<string, unknown>;
  return payload;
}
export function findExistingWorkJob(jobs: Job[], incoming: Job): Job | undefined {
  if (incoming.kind !== "work") return undefined;
  const id = (incoming.payload as { clientWorkId?: string })?.clientWorkId;
  return id
    ? jobs.find(
        (job) =>
          job.kind === "work" &&
          job.chainId === incoming.chainId &&
          (job.payload as { clientWorkId?: string })?.clientWorkId === id
      )
    : undefined;
}
