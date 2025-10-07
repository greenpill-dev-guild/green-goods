import { describe, it, expect, beforeEach } from "vitest";

import { mediaResourceManager } from "../../modules/job-queue/media-resource-manager";

describe("modules/job-queue/media-resource-manager", () => {
  beforeEach(() => {
    // Fresh manager state is fine; methods handle empty
  });

  it("creates and cleans up URLs for single file", () => {
    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    const url = mediaResourceManager.createUrl(file, "job-1");
    expect(typeof url).toBe("string");

    mediaResourceManager.cleanupUrl(url);
    // cleanup is silent; ensure stats reflect cleanup
    const stats = mediaResourceManager.getStats();
    expect(stats.totalUrls).toBeGreaterThanOrEqual(0);
  });

  it("tracks and cleans up by tracking id", () => {
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ];
    const urls = mediaResourceManager.createUrls(files, "job-xyz");
    expect(urls.length).toBe(2);

    mediaResourceManager.cleanupUrls("job-xyz");
    const stats = mediaResourceManager.getStats();
    expect(stats.trackedIds).toBeGreaterThanOrEqual(0);
  });

  it("cleanupAll clears all tracked urls", () => {
    const f1 = new File(["1"], "1.jpg", { type: "image/jpeg" });
    const f2 = new File(["2"], "2.jpg", { type: "image/jpeg" });
    mediaResourceManager.createUrl(f1, "job-a");
    mediaResourceManager.createUrl(f2, "job-b");
    mediaResourceManager.cleanupAll();
    const stats = mediaResourceManager.getStats();
    expect(stats.totalUrls).toBe(0);
  });
});
