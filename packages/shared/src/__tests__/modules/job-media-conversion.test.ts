/** @vitest-environment node */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const conversion = vi.hoisted(() => ({ convertHeicPhoto: vi.fn() }));
vi.mock("../../modules/work/heic-conversion", () => conversion);

import { jobQueueDB } from "../../modules/job-queue/db";
import {
  MAX_HEIC_CONVERSION_ATTEMPTS,
  convertQueuedHeicMedia,
} from "../../modules/job-queue/job-media-conversion";
import { identifyWorkFile } from "../../modules/work/work-attachments";
import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

const heic = () => new File(["heic-bytes"], "b.heic", { type: "image/heic" });

async function queueWork(files: File[]): Promise<Job> {
  const id = await jobQueueDB.addJob({
    kind: "work",
    payload: {
      clientWorkId: crypto.randomUUID(),
      actionUID: 1,
      gardenAddress: GARDEN,
      feedback: "Mulched the beds",
      media: files,
    },
    meta: { chainId: 11155111 },
    chainId: 11155111,
    userAddress: USER,
  });
  return (await jobQueueDB.getJob(id))!;
}

beforeEach(() => {
  conversion.convertHeicPhoto.mockReset();
});

describe("converting a queued job's HEIC photos", () => {
  it("replaces a converted photo in place, keeping its position and new identity", async () => {
    const jpeg = new File(["jpeg-bytes"], "a.jpg", { type: "image/jpeg" });
    const video = new File(["clip"], "c.mp4", { type: "video/mp4" });
    const converted = new File(["converted-bytes"], "b.jpg", { type: "image/jpeg" });
    conversion.convertHeicPhoto.mockResolvedValue({ status: "converted", file: converted });
    const job = await queueWork([jpeg, heic(), video]);

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "ready" });

    const images = await jobQueueDB.getImagesForJob(job.id);
    expect(images.map((image) => image.file.name)).toEqual(["a.jpg", "b.jpg", "c.mp4"]);
    expect(await images[1].file.text()).toBe("converted-bytes");
    expect((await identifyWorkFile(images[1].file)).contentHash).toBe(
      (await identifyWorkFile(converted)).contentHash
    );
    expect(job.meta?.mediaConversion).toBeUndefined();
    expect((await jobQueueDB.getJob(job.id))?.meta?.mediaConversion).toBeUndefined();
  });

  it("leaves a job with no waiting photo untouched", async () => {
    const job = await queueWork([new File(["jpeg-bytes"], "a.jpg", { type: "image/jpeg" })]);

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "ready" });
    expect(conversion.convertHeicPhoto).not.toHaveBeenCalled();
  });

  it("waits without counting a failure while the decoder cannot load", async () => {
    conversion.convertHeicPhoto.mockResolvedValue({ status: "unavailable" });
    const job = await queueWork([heic()]);

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "pending" });

    expect(job.meta?.mediaConversion).toEqual({ failures: 0, inFlight: false });
    expect((await jobQueueDB.getJob(job.id))?.meta?.mediaConversion).toEqual({
      failures: 0,
      inFlight: false,
    });
    const [image] = await jobQueueDB.getImagesForJob(job.id);
    expect(image.file.type).toBe("image/heic");
  });

  it("keeps a work discarded while its photo was decoding discarded", async () => {
    const job = await queueWork([heic()]);
    // The steward discards it from the work detail page while the decoder runs.
    conversion.convertHeicPhoto.mockImplementation(async () => {
      await jobQueueDB.deleteJob(job.id);
      return { status: "unavailable" };
    });

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "pending" });
    // The queue writes its own copy of the job on the waiting path that follows.
    await jobQueueDB.updateJob(job);

    expect(await jobQueueDB.getJob(job.id)).toBeUndefined();
    // Discarding takes the photos with it, so a record put back has none.
    expect(await jobQueueDB.getImagesForJob(job.id)).toEqual([]);
  });

  it("marks the attempt in flight before decoding", async () => {
    const job = await queueWork([heic()]);
    let duringDecode: unknown;
    conversion.convertHeicPhoto.mockImplementation(async () => {
      duringDecode = (await jobQueueDB.getJob(job.id))?.meta?.mediaConversion;
      return { status: "unavailable" };
    });

    await convertQueuedHeicMedia(job);

    expect(duringDecode).toEqual({ failures: 0, inFlight: true });
  });

  it("stops trying a photo that will not decode, and never decodes it again", async () => {
    conversion.convertHeicPhoto.mockResolvedValue({ status: "failed", error: new Error("bad") });
    const job = await queueWork([heic()]);

    for (let attempt = 1; attempt < MAX_HEIC_CONVERSION_ATTEMPTS; attempt++) {
      await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "pending" });
    }
    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "needs-attention" });
    conversion.convertHeicPhoto.mockClear();

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "needs-attention" });
    expect(conversion.convertHeicPhoto).not.toHaveBeenCalled();
  });

  it("counts a conversion that never finished, so a photo that crashes the tab cannot loop", async () => {
    const stored = await queueWork([heic()]);
    stored.meta = {
      ...stored.meta,
      mediaConversion: { failures: MAX_HEIC_CONVERSION_ATTEMPTS - 1, inFlight: true },
    };
    await jobQueueDB.updateJob(stored);
    const reopened = (await jobQueueDB.getJob(stored.id))!;

    await expect(convertQueuedHeicMedia(reopened)).resolves.toEqual({ status: "needs-attention" });
    expect(conversion.convertHeicPhoto).not.toHaveBeenCalled();
    expect(reopened.meta?.mediaConversion).toEqual({
      failures: MAX_HEIC_CONVERSION_ATTEMPTS,
      inFlight: false,
    });
  });

  it("keeps each converted photo when a later one cannot convert yet", async () => {
    const first = new File(["first-jpeg"], "first.jpg", { type: "image/jpeg" });
    conversion.convertHeicPhoto
      .mockResolvedValueOnce({ status: "converted", file: first })
      .mockResolvedValueOnce({ status: "unavailable" });
    const job = await queueWork([heic(), new File(["h2"], "second.heic", { type: "image/heic" })]);

    await expect(convertQueuedHeicMedia(job)).resolves.toEqual({ status: "pending" });

    const images = await jobQueueDB.getImagesForJob(job.id);
    expect(images.map((image) => image.file.name)).toEqual(["first.jpg", "second.heic"]);
  });
});
