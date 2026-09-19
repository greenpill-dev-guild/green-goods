/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadMedia } from "../../modules/offline-content/media";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("offline content media durability", () => {
  it("finishes only after the worker's exact cache entry is visible", async () => {
    vi.useFakeTimers();
    const match = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue({ cached: true });
    vi.stubGlobal("caches", { match });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(["saved"]),
      })
    );

    const url = "https://ipfs.io/ipfs/photo";
    const download = downloadMedia(url, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(50);

    await expect(download).resolves.toBe(5);
    expect(match).toHaveBeenCalledWith(url, {
      cacheName: "ipfs-cache",
      ignoreVary: true,
    });
  });

  it("rejects a network response that never becomes durable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("caches", { match: vi.fn().mockResolvedValue(undefined) });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(["unsaved"]),
      })
    );

    const download = downloadMedia(
      "https://ipfs.io/ipfs/unsaved-photo",
      new AbortController().signal
    );
    const rejection = expect(download).rejects.toMatchObject({
      name: "OfflineMediaStoreError",
    });
    await vi.advanceTimersByTimeAsync(2_000);

    await rejection;
  });
});
