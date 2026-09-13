/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const media = vi.hoisted(() => ({
  createUrl: vi.fn((_file: File, _owner: string) => "blob:verified-original"),
  cleanupUrls: vi.fn(),
}));
vi.mock("../../../stores/connectivity", () => ({
  connectivityStore: { getSnapshot: () => false },
}));
vi.mock("../../../modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: media,
}));
vi.mock("../../../modules/data/ipfs/resolve", () => ({ resolveIPFSUrl: (url: string) => url }));
import { downloadWorkMedia, type WorkData } from "../../../utils/work/workActions";
const work: WorkData = {
  id: "work",
  title: "Work",
  status: "pending",
  createdAt: 1,
  gardenId: "garden",
  media: ["https://gateway.test/original"],
};
let clicked: string[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clicked.push(this.href);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("downloads a verified original through a local blob and releases its bytes", async () => {
  vi.stubGlobal("caches", {
    open: vi.fn(async () => ({
      match: vi.fn(
        async () => new Response("original-bytes", { headers: { "content-type": "image/jpeg" } })
      ),
    })),
  });
  await downloadWorkMedia(work);
  expect(clicked).toEqual(["blob:verified-original"]);
  expect(media.createUrl).toHaveBeenCalledWith(
    expect.any(File),
    expect.stringContaining("work-download-")
  );
  expect(media.createUrl.mock.calls[0][0].size).toBe(13);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(media.cleanupUrls).toHaveBeenCalledTimes(1);
});
it("does not use a managed display preview as proof that the original is downloaded", async () => {
  const open = vi.fn(async (name: string) => ({
    match: vi.fn(async () => (name === "gg-offline-media" ? new Response("preview") : undefined)),
  }));
  vi.stubGlobal("caches", { open });
  await expect(downloadWorkMedia(work)).rejects.toThrow("Original media is not available offline");
  expect(clicked).toEqual([]);
  expect(open).not.toHaveBeenCalledWith("gg-offline-media");
});
