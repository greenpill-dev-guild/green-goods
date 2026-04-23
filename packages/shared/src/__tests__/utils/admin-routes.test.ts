import { describe, expect, it } from "vitest";
import { adminRoutes } from "../../utils/navigation/admin-routes";

describe("adminRoutes", () => {
  it("builds route-backed Hub history detail links with sort context", () => {
    expect(adminRoutes.hubHistoryDetail("event-id", { sort: "oldest" })).toBe(
      "/hub/history/event-id?sort=oldest"
    );
  });

  it("does not preserve legacy Hub item query state", () => {
    const legacyContext = { sort: "newest", item: "old-item" } as unknown as Parameters<
      typeof adminRoutes.hubWork
    >[0];

    expect(adminRoutes.hubWork(legacyContext)).toBe("/hub/work?sort=newest");
  });

  it("encodes Hub history event ids as path segments", () => {
    expect(adminRoutes.hubHistoryDetail("allocation:0xabc/1")).toBe(
      "/hub/history/allocation%3A0xabc%2F1"
    );
  });
});
