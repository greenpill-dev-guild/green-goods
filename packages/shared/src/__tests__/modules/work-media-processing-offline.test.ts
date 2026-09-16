import { describe, expect, it, vi } from "vitest";

// The HEIC decoder is a lazy chunk from the offline-ready shell tier, so a
// steward can reach the picker before it exists on the device. Failing the
// import is how that looks from inside `media-processing`.
vi.mock("heic-to/csp", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

import {
  finalizeWorkMediaForUpload,
  normalizeWorkMediaFiles,
} from "../../modules/work/media-processing";

describe("work media without the HEIC decoder", () => {
  it("keeps a HEIC photo instead of refusing it", async () => {
    const heic = new File(["heic"], "garden.heic", { type: "image/heic" });

    const result = await normalizeWorkMediaFiles([heic]);

    expect(result.rejected).toEqual([]);
    expect(result.converted).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].converted).toBe(false);
    expect(result.accepted[0].pendingConversion).toBe(true);
    expect(await result.accepted[0].file.arrayBuffer()).toEqual(await heic.arrayBuffer());
  });

  it("tells the caller the conversion was deferred, not failed", async () => {
    const onHeicConversionDeferred = vi.fn();
    const onHeicConversionFailed = vi.fn();
    const heic = new File(["heic"], "garden.heif", { type: "image/heif" });

    await normalizeWorkMediaFiles([heic], {
      onHeicConversionDeferred,
      onHeicConversionFailed,
    });

    expect(onHeicConversionDeferred).toHaveBeenCalledTimes(1);
    expect(onHeicConversionFailed).not.toHaveBeenCalled();
  });

  it("still refuses a file that is not a photo at all", async () => {
    const text = new File(["notes"], "notes.txt", { type: "text/plain" });

    const result = await normalizeWorkMediaFiles([text]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe("unsupported");
  });

  it("uploads the original rather than dropping it when the decoder is still missing at send", async () => {
    const heic = new File(["heic"], "garden.heic", { type: "image/heic" });
    const jpeg = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });

    await expect(finalizeWorkMediaForUpload([heic, jpeg])).resolves.toEqual([heic, jpeg]);
  });
});
