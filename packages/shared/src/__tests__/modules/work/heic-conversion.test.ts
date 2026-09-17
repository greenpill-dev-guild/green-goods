/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  imports: 0,
  tierListener: undefined as ((status: string) => void) | undefined,
  heicTo: vi.fn(),
  connectivity: {
    isConfirmedOnline: vi.fn(() => false),
    getStatusSnapshot: vi.fn(() => ({ state: "offline" as string })),
    confirmOnline: vi.fn(async () => false),
  },
  compressor: {
    shouldCompress: vi.fn(() => false),
    compressImages: vi.fn(),
  },
}));

vi.mock("heic-to/csp", () => {
  state.imports += 1;
  return { heicTo: state.heicTo, isHeic: vi.fn(async () => true) };
});
vi.mock("../../../stores/connectivity", () => ({
  CONFIRMED_ONLINE_MAX_AGE_MS: 60_000,
  connectivityStore: state.connectivity,
}));
vi.mock("../../../modules/app/service-worker-registration", () => ({
  observePwaShellTier: (_tier: string, listener: (status: string) => void) => {
    state.tierListener = listener;
    return () => undefined;
  },
}));
vi.mock("../../../utils/work/image-compression", () => ({ imageCompressor: state.compressor }));

async function loadModule() {
  vi.resetModules();
  return import("../../../modules/work/heic-conversion");
}

const heic = () => new File(["heic-bytes"], "garden.HEIC", { type: "image/heic", lastModified: 7 });

beforeEach(() => {
  state.imports = 0;
  state.tierListener = undefined;
  state.heicTo.mockReset().mockResolvedValue(new Blob(["jpeg-bytes"], { type: "image/jpeg" }));
  state.connectivity.isConfirmedOnline.mockReset().mockReturnValue(false);
  state.connectivity.getStatusSnapshot.mockReset().mockReturnValue({ state: "offline" });
  state.connectivity.confirmOnline.mockReset().mockResolvedValue(false);
  state.compressor.shouldCompress.mockReset().mockReturnValue(false);
  state.compressor.compressImages.mockReset();
});

describe("deferred HEIC conversion", () => {
  it("does not try the decoder offline before the offline-ready files arrive", async () => {
    // A failed dynamic import stays failed for the whole page, so trying now
    // would strand the photo until the app is reopened.
    const { convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toEqual({ status: "unavailable" });
    expect(state.imports).toBe(0);
    expect(state.connectivity.confirmOnline).not.toHaveBeenCalled();
  });

  it("converts once the offline-ready tier reports the decoder is on the device", async () => {
    const { convertHeicPhoto } = await loadModule();
    await convertHeicPhoto(heic());
    state.tierListener?.("ready");

    const result = await convertHeicPhoto(heic());

    expect(result.status).toBe("converted");
    const file = (result as { file: File }).file;
    expect(file.name).toBe("garden.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.lastModified).toBe(7);
    expect(await file.text()).toBe("jpeg-bytes");
  });

  it("converts when the connection is confirmed, without probing again", async () => {
    state.connectivity.isConfirmedOnline.mockReturnValue(true);
    const { convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toMatchObject({ status: "converted" });
    expect(state.connectivity.confirmOnline).not.toHaveBeenCalled();
  });

  it("probes an unconfirmed online connection once before importing", async () => {
    state.connectivity.getStatusSnapshot.mockReturnValue({ state: "online" });
    state.connectivity.confirmOnline.mockResolvedValue(true);
    const { convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toMatchObject({ status: "converted" });
    expect(state.connectivity.confirmOnline).toHaveBeenCalledOnce();
  });

  it("never probes or imports on an unstable connection", async () => {
    state.connectivity.getStatusSnapshot.mockReturnValue({ state: "degraded" });
    const { convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toEqual({ status: "unavailable" });
    expect(state.connectivity.confirmOnline).not.toHaveBeenCalled();
    expect(state.imports).toBe(0);
  });

  it("reports a photo the decoder cannot read as failed, not unavailable", async () => {
    state.connectivity.isConfirmedOnline.mockReturnValue(true);
    state.heicTo.mockRejectedValue(new Error("not a HEIC image"));
    const { convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toMatchObject({ status: "failed" });
  });

  it("compresses a large converted photo the way the picker does", async () => {
    state.connectivity.isConfirmedOnline.mockReturnValue(true);
    state.compressor.shouldCompress.mockReturnValue(true);
    const compressed = new File(["small"], "garden.jpg", { type: "image/jpeg" });
    state.compressor.compressImages.mockResolvedValue([{ file: compressed }]);
    const { WORK_PHOTO_COMPRESSION, convertHeicPhoto } = await loadModule();

    await expect(convertHeicPhoto(heic())).resolves.toEqual({
      status: "converted",
      file: compressed,
    });
    expect(state.compressor.compressImages).toHaveBeenCalledWith(
      [expect.any(File)],
      WORK_PHOTO_COMPRESSION
    );
  });

  it("keeps the converted photo when compression fails", async () => {
    state.connectivity.isConfirmedOnline.mockReturnValue(true);
    state.compressor.shouldCompress.mockReturnValue(true);
    state.compressor.compressImages.mockRejectedValue(new Error("canvas unavailable"));
    const { convertHeicPhoto } = await loadModule();

    const result = await convertHeicPhoto(heic());
    expect(result.status).toBe("converted");
    expect(await (result as { file: File }).file.text()).toBe("jpeg-bytes");
  });
});
