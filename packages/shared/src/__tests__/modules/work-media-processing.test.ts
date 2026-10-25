import { beforeEach, describe, expect, it, vi } from "vitest";

const heicToMocks = vi.hoisted(() => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}));

// The connection is confirmed, so importing the decoder is worth attempting.
vi.mock("../../stores/connectivity", () => ({
  CONFIRMED_ONLINE_MAX_AGE_MS: 60_000,
  connectivityStore: {
    isConfirmedOnline: () => true,
    getStatusSnapshot: () => ({ state: "online" }),
    confirmOnline: async () => true,
  },
}));

vi.mock("heic-to/csp", () => heicToMocks);

import {
  HEIC_JPEG_QUALITY,
  getSafeMediaBatchMetadata,
  getWorkMediaId,
  normalizeWorkMediaFiles,
  prepareMediaForUpload,
} from "../../modules/work/media-processing";
import {
  CAMERA_DETAILS,
  type PhotoType,
  bytesOf,
  cameraPhoto,
  cleanPhoto,
  leakedCameraDetails,
  photoFile,
} from "../test-utils/photo-fixtures";

const PHOTO_NAMES: Record<PhotoType, string> = {
  "image/jpeg": "beds.jpg",
  "image/png": "beds.png",
  "image/webp": "beds.webp",
};

describe("normalizeWorkMediaFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heicToMocks.isHeic.mockResolvedValue(false);
    heicToMocks.heicTo.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  });

  it("keeps photos with no metadata, and videos, exactly as they were picked", async () => {
    const photos = (Object.keys(PHOTO_NAMES) as PhotoType[]).map((type) =>
      photoFile(cleanPhoto(type), PHOTO_NAMES[type], type)
    );
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });

    const result = await normalizeWorkMediaFiles([...photos, video]);

    expect(result.rejected).toEqual([]);
    for (const [index, picked] of [...photos, video].entries()) {
      const { file, originalFile, converted } = result.accepted[index];
      // Nothing had to go, so the file queued is the one picked.
      expect(file).toBe(originalFile);
      expect(converted).toBe(false);
      expect(await bytesOf(file)).toEqual(await bytesOf(picked));
    }
    expect(heicToMocks.heicTo).not.toHaveBeenCalled();
  });

  it.each([
    ["image/jpeg", 6],
    ["image/png", 6],
    ["image/webp", 6],
    ["image/jpeg", 1],
  ] as const)("strips the location and camera details from %s, keeping its picture and orientation %i", async (type, orientation) => {
    const picked = photoFile(cameraPhoto(type, { orientation }), PHOTO_NAMES[type], type);
    expect(leakedCameraDetails(await bytesOf(picked))).toEqual(
      expect.arrayContaining([
        CAMERA_DETAILS.make,
        CAMERA_DETAILS.model,
        CAMERA_DETAILS.serial,
        CAMERA_DETAILS.software,
        CAMERA_DETAILS.gpsDatum,
        CAMERA_DETAILS.xmpLocation,
      ])
    );

    const result = await normalizeWorkMediaFiles([picked]);

    expect(result.rejected).toEqual([]);
    const { file, originalFile } = result.accepted[0];
    expect(leakedCameraDetails(await bytesOf(file))).toEqual([]);
    // The picture's own bytes, its color profile and its orientation are all that remain.
    expect(await bytesOf(file)).toEqual(cleanPhoto(type, { orientation }));
    expect([file.name, file.type, file.lastModified]).toEqual([
      picked.name,
      type,
      picked.lastModified,
    ]);
    expect(await bytesOf(originalFile)).toEqual(await bytesOf(picked));
  });

  it("queues a photo below the compression threshold without its metadata", async () => {
    const picked = photoFile(cameraPhoto("image/jpeg"), "beds.jpg", "image/jpeg");
    const compressor = { shouldCompress: vi.fn(() => false), compressImages: vi.fn() };

    const prepared = await prepareMediaForUpload([picked], compressor);

    expect(compressor.compressImages).not.toHaveBeenCalled();
    expect(prepared.rejectedCount).toBe(0);
    expect(await bytesOf(prepared.files[0])).toEqual(cleanPhoto("image/jpeg", { orientation: 6 }));
  });

  it("refuses a photo whose bytes it cannot read, since it cannot tell what they carry", async () => {
    const unreadable = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });

    const result = await normalizeWorkMediaFiles([unreadable]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({ reason: "unsupported", file: expect.any(File) }),
    ]);
  });

  it("converts HEIC files to JPEG before accepting them", async () => {
    heicToMocks.isHeic.mockResolvedValue(true);
    const heic = new File(["heic"], "garden.heic", { type: "image/heic" });

    const result = await normalizeWorkMediaFiles([heic]);

    expect(heicToMocks.heicTo).toHaveBeenCalledWith({
      blob: heic,
      type: "image/jpeg",
      quality: HEIC_JPEG_QUALITY,
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].converted).toBe(true);
    expect(result.accepted[0].file.type).toBe("image/jpeg");
    expect(result.accepted[0].file.name).toBe("garden.jpg");
    expect(result.converted).toHaveLength(1);
    expect(result.rejected).toEqual([]);
  });

  it("rejects HEIC files when conversion fails", async () => {
    heicToMocks.isHeic.mockResolvedValue(true);
    heicToMocks.heicTo.mockRejectedValue(new Error("decoder failed"));
    const heic = new File(["heic"], "garden.heif", { type: "image/heif" });

    const result = await normalizeWorkMediaFiles([heic]);

    expect(result.accepted).toEqual([]);
    expect(result.converted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].file).not.toBe(heic);
    expect(await result.rejected[0].file.arrayBuffer()).toEqual(await heic.arrayBuffer());
    expect(result.rejected[0].reason).toBe("heic_conversion_failed");
  });

  it("rejects unsupported files before they enter the draft", async () => {
    const text = new File(["notes"], "notes.txt", { type: "text/plain" });

    const result = await normalizeWorkMediaFiles([text]);

    expect(result.accepted).toEqual([]);
    expect(result.converted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe("unsupported");
    expect(heicToMocks.heicTo).not.toHaveBeenCalled();
  });

  it("returns stable media IDs and safe batch metadata", () => {
    const jpeg = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });

    expect(getWorkMediaId(jpeg)).toBe(getWorkMediaId(jpeg));
    expect(getSafeMediaBatchMetadata([jpeg, video])).toEqual({
      file_count: 2,
      mime_types: ["image/jpeg", "video/mp4"],
      extensions: ["jpg", "mp4"],
      size_buckets: ["0-1mb"],
      image_count: 1,
      video_count: 1,
    });
  });
});
