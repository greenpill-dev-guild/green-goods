import { beforeEach, describe, expect, it, vi } from "vitest";

const heicToMocks = vi.hoisted(() => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}));

vi.mock("heic-to/csp", () => heicToMocks);

import {
  HEIC_JPEG_QUALITY,
  getSafeMediaBatchMetadata,
  getWorkMediaId,
  normalizeWorkMediaFiles,
} from "../../modules/work/media-processing";

describe("normalizeWorkMediaFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heicToMocks.isHeic.mockResolvedValue(false);
    heicToMocks.heicTo.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  });

  it("passes supported JPEG, PNG, and WebP files through unchanged", async () => {
    const jpeg = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    const png = new File(["png"], "photo.png", { type: "image/png" });
    const webp = new File(["webp"], "photo.webp", { type: "image/webp" });

    const result = await normalizeWorkMediaFiles([jpeg, png, webp]);

    expect(result.accepted.map((item) => item.file)).toEqual([jpeg, png, webp]);
    expect(result.accepted.every((item) => item.converted === false)).toBe(true);
    expect(result.rejected).toEqual([]);
    expect(heicToMocks.heicTo).not.toHaveBeenCalled();
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
    expect(result.rejected[0].file).toBe(heic);
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
