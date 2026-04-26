import { describe, expect, it } from "vitest";
import { adminRoutes } from "../../utils/navigation/admin-routes";

describe("adminRoutes", () => {
  it("builds route-backed Hub history detail links with sort context", () => {
    expect(adminRoutes.hubHistoryDetail("event-id", { sort: "oldest" })).toBe(
      "/hub/history/event-id?sort=oldest"
    );
  });

  it("builds route-backed Hub work detail links with garden and sort context", () => {
    expect(
      adminRoutes.hubWorkDetail("work-123", {
        gardenAddress: "0x0000000000000000000000000000000000000abc",
        sort: "newest",
      })
    ).toBe(
      "/hub/work/work-123?gardenAddress=0x0000000000000000000000000000000000000abc&sort=newest"
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

  it("builds Actions list and child routes with preserved list context", () => {
    const listContext = {
      domain: "1",
      lifecycle: "active",
      search: "solar",
      sort: "recent",
    };

    expect(adminRoutes.actions(listContext)).toBe(
      "/actions?domain=1&lifecycle=active&search=solar&sort=recent"
    );
    expect(adminRoutes.actionCreate(listContext)).toBe(
      "/actions/create?domain=1&lifecycle=active&search=solar&sort=recent"
    );
    expect(adminRoutes.actionDetail("action:0xabc/1", listContext)).toBe(
      "/actions/action%3A0xabc%2F1?domain=1&lifecycle=active&search=solar&sort=recent"
    );
    expect(adminRoutes.actionEdit("action:0xabc/1", listContext)).toBe(
      "/actions/action%3A0xabc%2F1/edit?domain=1&lifecycle=active&search=solar&sort=recent"
    );
  });
});
