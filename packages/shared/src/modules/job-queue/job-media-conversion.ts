/**
 * Converting the HEIC photos a queued job still holds.
 *
 * A photo picked before the decoder could load is queued as it was picked. It
 * becomes a JPEG here, before anything uploads: each converted photo replaces
 * its stored row in place, keeping its position, so a retry reads the JPEG
 * and the upload checkpoint keys it by the bytes that are actually sent.
 *
 * Decoding a large photo can exhaust a phone's memory and kill the tab, and the
 * queue would try again on the next launch. The attempt is marked in flight
 * before decoding, so an attempt that never finished counts as a failure and a
 * photo that keeps crashing stops being retried automatically.
 *
 * @module modules/job-queue/job-media-conversion
 */

import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import { convertHeicPhoto } from "../work/heic-conversion";
import { identifyWorkFile, isHeicFile } from "../work/work-attachments";
import { jobQueueDB } from "./db";

/** Decode attempts before a photo waits for the steward instead of retrying. */
export const MAX_HEIC_CONVERSION_ATTEMPTS = 3;

export interface MediaConversionMeta {
  failures: number;
  inFlight: boolean;
}

export type QueuedMediaConversion =
  | { status: "ready" }
  /** The decoder cannot load yet, or a failed decode will be tried again. */
  | { status: "pending" }
  /** A photo failed to decode too many times; retrying is the steward's call. */
  | { status: "needs-attention" };

async function recordConversion(job: Job, conversion: MediaConversionMeta | undefined) {
  // Mutated on the caller's job: the queue rewrites this object on its waiting path.
  const { mediaConversion: _previous, ...meta } = job.meta ?? {};
  job.meta = conversion ? { ...meta, mediaConversion: conversion } : meta;
  await jobQueueDB.updateJob(job);
}

async function replaceStoredPhoto(jobId: string, rowId: string, file: File): Promise<void> {
  const identity = await identifyWorkFile(file);
  const db = await jobQueueDB.init();
  await db.transaction("rw", db.job_images, async () => {
    const row = await db.job_images.get(rowId);
    // The job may have been discarded while the photo was decoding.
    if (!row || row.jobId !== jobId) return;
    const { file: _legacyFile, url: _url, ...kept } = row;
    await db.job_images.put({
      ...kept,
      attachmentId: identity.id,
      contentHash: identity.contentHash,
      fileData: identity.fileData,
    });
  });
}

export async function convertQueuedHeicMedia(job: Job): Promise<QueuedMediaConversion> {
  const waiting = (await jobQueueDB.getImagesForJob(job.id)).filter((image) =>
    isHeicFile(image.file)
  );
  const previous = job.meta?.mediaConversion as Partial<MediaConversionMeta> | undefined;
  if (waiting.length === 0) {
    if (previous) await recordConversion(job, undefined);
    return { status: "ready" };
  }

  let failures = (previous?.failures ?? 0) + (previous?.inFlight ? 1 : 0);
  if (failures >= MAX_HEIC_CONVERSION_ATTEMPTS) {
    if (previous?.inFlight || previous?.failures !== failures)
      await recordConversion(job, { failures, inFlight: false });
    return { status: "needs-attention" };
  }

  await recordConversion(job, { failures, inFlight: true });
  for (const image of waiting) {
    const result = await convertHeicPhoto(image.file);
    if (result.status === "converted") {
      await replaceStoredPhoto(job.id, image.id, result.file);
      continue;
    }
    if (result.status === "failed") {
      failures += 1;
      logger.warn("[JobQueue] Queued HEIC photo did not decode", {
        jobId: job.id,
        failures,
        error: result.error instanceof Error ? result.error.message : String(result.error),
      });
    }
    await recordConversion(job, { failures, inFlight: false });
    return failures >= MAX_HEIC_CONVERSION_ATTEMPTS
      ? { status: "needs-attention" }
      : { status: "pending" };
  }

  await recordConversion(job, undefined);
  return { status: "ready" };
}
