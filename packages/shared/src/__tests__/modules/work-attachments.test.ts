import { describe, expect, it, vi } from "vitest";
import {
  captureWorkFile,
  isHeicFile,
  validateWorkAttachments,
  roundWorkLocation,
  validateWorkVideo,
} from "../../modules/work/work-attachments";

describe("work attachment boundaries", () => {
  it("copies bytes before the original picker file becomes unreadable", async () => {
    const original = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    const captured = await captureWorkFile(original);
    original.arrayBuffer = async () => {
      throw new DOMException("revoked", "NotReadableError");
    };
    expect(await captured.text()).toBe("photo");
  });
  it("accepts videos but does not count them as required photos", () => {
    const video = new File(["clip"], "clip.mp4", { type: "video/mp4" });
    expect(validateWorkAttachments([video], [], 0)).toEqual([]);
    expect(validateWorkAttachments([video], [], 1)).toContain("photos-required");
  });
  it("recognises a HEIC photo by type or by name, since Android often reports no type", () => {
    expect(isHeicFile(new File(["h"], "garden.heic", { type: "image/heic" }))).toBe(true);
    expect(isHeicFile(new File(["h"], "garden.HEIF", { type: "" }))).toBe(true);
    expect(isHeicFile(new File(["h"], "burst", { type: "image/heif-sequence" }))).toBe(true);
    expect(isHeicFile(new File(["j"], "garden.jpg", { type: "image/jpeg" }))).toBe(false);
  });
  it("trusts a known type over the name, so a JPEG named .heic stays a JPEG", () => {
    expect(isHeicFile(new File(["j"], "renamed.heic", { type: "image/jpeg" }))).toBe(false);
    expect(isHeicFile(new File(["h"], "download.heic", { type: "application/octet-stream" }))).toBe(
      true
    );
  });
  it("refuses a HEIC photo by default, so nothing uploads an unconverted original", () => {
    const heic = new File(["h"], "garden.heic", { type: "image/heic" });
    expect(validateWorkAttachments([heic], [], 1)).toEqual(["photos-required", "media-type"]);
  });
  it("lets a composer keep a HEIC photo that is waiting for the decoder", () => {
    const heic = new File(["h"], "garden.heic", { type: "" });
    const jpeg = new File(["j"], "garden.jpg", { type: "image/jpeg" });
    const policy = { pendingHeic: "accept" } as const;
    // A pending photo still counts toward the action's minimum: it will be a JPEG before it sends.
    expect(validateWorkAttachments([heic, jpeg], [], 2, policy)).toEqual([]);
    const oversized = new File(["h"], "big.heic", { type: "image/heic" });
    Object.defineProperty(oversized, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(validateWorkAttachments([oversized], [], 0, policy)).toEqual(["media-size"]);
  });
  it("rounds location and drops precise accuracy", () => {
    expect(roundWorkLocation({ lat: 10.123456, lng: -20.987654, accuracy: 2 })).toEqual({
      lat: 10.123,
      lng: -20.988,
    });
  });
  it("enforces binary byte, count, and format boundaries", () => {
    const sized = (type: string, size: number) => {
      const file = new File(["x"], "attachment", { type });
      Object.defineProperty(file, "size", { value: size });
      return file;
    };
    const mib = 1024 * 1024;
    expect(validateWorkAttachments([sized("image/jpeg", 10 * mib)])).toEqual([]);
    expect(validateWorkAttachments([sized("image/jpeg", 10 * mib + 1)])).toContain("media-size");
    expect(validateWorkAttachments([sized("video/mp4", 20 * mib)])).toEqual([]);
    expect(validateWorkAttachments([sized("video/mp4", 20 * mib + 1)])).toContain("media-size");
    expect(validateWorkAttachments([sized("video/quicktime", 1)])).toContain("media-type");
    expect(
      validateWorkAttachments(Array.from({ length: 11 }, () => sized("image/png", 1)))
    ).toContain("media-count");
    expect(
      validateWorkAttachments(
        [sized("video/mp4", 20 * mib), sized("video/webm", 20 * mib)],
        [sized("audio/webm", 10 * mib)]
      )
    ).toEqual([]);
    expect(
      validateWorkAttachments(
        [sized("video/mp4", 20 * mib), sized("video/webm", 20 * mib)],
        [sized("audio/webm", 10 * mib + 1)]
      )
    ).toContain("total-size");
  });
  it.each([
    0,
    30,
    30.001,
    Infinity,
  ])("checks video duration %s and releases its URL", async (duration) => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const video = {
      duration,
      onloadedmetadata: null as null | (() => void),
      onerror: null,
      preload: "",
      removeAttribute: vi.fn(),
      set src(_value: string) {
        queueMicrotask(() => this.onloadedmetadata?.());
      },
    };
    vi.stubGlobal("document", { createElement: () => video });
    try {
      expect(await validateWorkVideo(new File(["v"], "v.mp4", { type: "video/mp4" }))).toBe(
        duration > 0 && duration <= 30
      );
      expect(revoke).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      revoke.mockRestore();
    }
  });
});
