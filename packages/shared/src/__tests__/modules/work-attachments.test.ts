import { describe, expect, it, vi } from "vitest";
import {
  captureWorkFile,
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
