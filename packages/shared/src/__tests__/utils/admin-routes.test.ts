import { describe, expect, it } from "vitest";
import { adminRoutes } from "../../utils/navigation/admin-routes";

describe("adminRoutes", () => {
  it("builds route-backed Hub work detail links with garden and sort context", () => {
    expect(
      adminRoutes.hubWorkDetail("work-123", {
        gardenId: "0x0000000000000000000000000000000000000abc",
        sort: "newest",
      })
    ).toBe("/hub/work/work-123?gardenId=0x0000000000000000000000000000000000000abc&sort=newest");
  });

  it("does not preserve legacy Hub item query state", () => {
    const legacyContext = { sort: "newest", item: "old-item" } as unknown as Parameters<
      typeof adminRoutes.hubWork
    >[0];

    expect(adminRoutes.hubWork(legacyContext)).toBe("/hub/work?sort=newest");
  });

  it("encodes Hub confirm commitment ids as path segments", () => {
    expect(adminRoutes.hubConfirmDetail("allocation:0xabc/1")).toBe(
      "/hub/confirm/allocation%3A0xabc%2F1"
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

  it("builds team campaign cookie jar routes", () => {
    expect(adminRoutes.cookies()).toBe("/cookies");
    expect(adminRoutes.cookiesDeploy({ source: "campaign" })).toBe(
      "/cookies/deploy?source=campaign"
    );
  });

  it("uses health as the canonical Garden readout route while preserving overview aliases", () => {
    const context = { gardenId: "0x0000000000000000000000000000000000000abc", range: "30d" };

    expect(adminRoutes.garden()).toBe("/garden/health");
    expect(adminRoutes.gardenHealth(context)).toBe(
      "/garden/health?gardenId=0x0000000000000000000000000000000000000abc&range=30d"
    );
    expect(adminRoutes.gardenOverview(context)).toBe(adminRoutes.gardenHealth(context));
  });

  it("uses endowment and payouts as canonical Community money routes while preserving legacy aliases", () => {
    const context = { gardenId: "0x0000000000000000000000000000000000000abc", item: "deposit-1" };

    expect(adminRoutes.community()).toBe("/community/members");
    expect(adminRoutes.communityEndowment(context)).toBe(
      "/community/endowment?gardenId=0x0000000000000000000000000000000000000abc&item=deposit-1"
    );
    expect(adminRoutes.communityResources(context)).toBe(adminRoutes.communityEndowment(context));
    expect(adminRoutes.communityTreasury(context)).toBe(adminRoutes.communityEndowment(context));
    expect(adminRoutes.communityPayouts(context)).toBe(
      "/community/payouts?gardenId=0x0000000000000000000000000000000000000abc&item=deposit-1"
    );
    expect(adminRoutes.communityCoordination(context)).toBe(
      "/community/coordination?gardenId=0x0000000000000000000000000000000000000abc&item=deposit-1"
    );
    expect(adminRoutes.communityGovernance(context)).toBe(
      adminRoutes.communityCoordination(context)
    );
    expect(adminRoutes.communityEndowmentVault(context)).toBe(
      "/community/endowment/vault?gardenId=0x0000000000000000000000000000000000000abc&item=deposit-1"
    );
    expect(adminRoutes.communityTreasuryVault(context)).toBe(
      adminRoutes.communityEndowmentVault(context)
    );
  });
});
