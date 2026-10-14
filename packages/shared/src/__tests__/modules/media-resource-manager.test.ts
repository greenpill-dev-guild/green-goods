import { expect, it, vi } from "vitest";
import { mediaResourceManager } from "../../modules/job-queue/media-resource-manager";
it("never reuses a revoked file URL", () => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:cleanup-${++n}`);
  URL.revokeObjectURL = vi.fn();
  const file = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });
  const first = mediaResourceManager.getOrCreateUrl(file, "cleanup-test");
  mediaResourceManager.cleanupFile(file);
  const next = mediaResourceManager.getOrCreateUrl(file, "cleanup-test");
  mediaResourceManager.cleanupUrls("cleanup-test");
  expect(next).not.toBe(first);
});

it("drops cached file references even when the browser rejects revocation", () => {
  URL.createObjectURL = vi.fn().mockReturnValueOnce("blob:old").mockReturnValueOnce("blob:new");
  URL.revokeObjectURL = vi.fn(() => {
    throw new Error("already invalid");
  });
  const file = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });
  const first = mediaResourceManager.getOrCreateUrl(file, "failed-revoke", "id:hash");
  mediaResourceManager.cleanupUrl(first);
  expect(mediaResourceManager.getStats().totalUrls).toBe(0);
  expect(mediaResourceManager.getOrCreateUrl(file, "failed-revoke", "id:hash")).toBe("blob:new");
  mediaResourceManager.cleanupAll();
  expect(mediaResourceManager.getStats()).toEqual({ totalUrls: 0, trackedIds: 0 });
});
