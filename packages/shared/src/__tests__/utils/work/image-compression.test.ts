/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  track: vi.fn(),
}));

vi.mock("browser-image-compression", () => ({ default: mocks.compress }));
vi.mock("../../../modules/app/posthog", () => ({ track: mocks.track }));

import { imageCompressor } from "../../../utils/work/image-compression";

const photo = (name: string, bytes: string) => new File([bytes], name, { type: "image/jpeg" });

beforeEach(() => {
  mocks.compress.mockReset();
  mocks.track.mockReset();
});

describe("work image compression", () => {
  it("returns the compressed file and reports progress with its source name", async () => {
    const original = photo("garden.jpg", "0123456789");
    const smaller = photo("garden.jpg", "small");
    const onProgress = vi.fn();
    mocks.compress.mockResolvedValue(smaller);

    await expect(
      imageCompressor.compressImage(original, { maxSizeMB: 0.5 }, onProgress)
    ).resolves.toMatchObject({
      file: smaller,
      originalSize: 10,
      compressedSize: 5,
      compressionRatio: 50,
    });
    const [, options] = mocks.compress.mock.calls[0] as [File, { onProgress: (n: number) => void }];
    expect(options).toMatchObject({ maxSizeMB: 0.5, useWebWorker: true });
    options.onProgress(25);
    expect(onProgress).toHaveBeenCalledWith(25, "garden.jpg");
  });

  it("keeps the original file when sequential compression fails and continues", async () => {
    const first = photo("first.jpg", "first image");
    const second = photo("second.jpg", "second image");
    const smaller = photo("second.jpg", "small");
    const onProgress = vi.fn();
    mocks.compress
      .mockRejectedValueOnce(new Error("decoder unavailable"))
      .mockResolvedValueOnce(smaller);

    const results = await imageCompressor.compressImages([first, second], undefined, onProgress);

    expect(results[0]).toMatchObject({
      file: first,
      originalSize: first.size,
      compressedSize: first.size,
      compressionRatio: 0,
    });
    expect(results[1].file).toBe(smaller);
    expect(onProgress).toHaveBeenLastCalledWith(100, "Compression complete");
  });

  it("keeps input order and a failed original when parallel completions arrive out of order", async () => {
    const first = photo("first.jpg", "first image");
    const second = photo("second.jpg", "second image");
    const smaller = photo("first.jpg", "small");
    const onProgress = vi.fn();
    let finishFirst: (file: File) => void = () => {};
    mocks.compress.mockImplementation((file: File) =>
      file === first
        ? new Promise<File>((resolve) => {
            finishFirst = resolve;
          })
        : Promise.reject(new Error("decoder unavailable"))
    );

    const pending = imageCompressor.compressImagesParallel([first, second], undefined, onProgress);
    await vi.waitFor(() => expect(onProgress).toHaveBeenCalledWith(50, "second.jpg"));
    finishFirst(smaller);
    const results = await pending;

    expect(results.map(({ file }) => file)).toEqual([smaller, second]);
    expect(results[1].compressionRatio).toBe(0);
    expect(onProgress).toHaveBeenLastCalledWith(100, "Compression complete");
  });
});
