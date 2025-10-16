import { describe, it, expect } from "vitest";

import { StorageManager, defaultStorageManager } from "../../modules/work/storage-manager";

describe("modules/storage-manager", () => {
  it("returns quota and breakdown without throwing", async () => {
    const mgr = new StorageManager();
    const quota = await mgr.getStorageQuota();
    expect(quota).toHaveProperty("total");

    const breakdown = await mgr.getStorageBreakdown();
    expect(breakdown).toHaveProperty("total");
  });

  it("analytics provides recommendations shape", async () => {
    const analytics = await defaultStorageManager.getAnalytics();
    expect(analytics).toHaveProperty("quota");
    expect(Array.isArray(analytics.recommendedActions)).toBe(true);
  });
});
