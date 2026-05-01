import {
  buildCommunityFabConfig,
  communitySectionForMode,
  resolveCommunityMode,
} from "@green-goods/shared";
import { describe, expect, it, vi } from "vitest";

describe("buildCommunityFabConfig", () => {
  it("preserves garden context when opening community actions", () => {
    const navigate = vi.fn();
    const config = buildCommunityFabConfig(true, true, navigate, {
      gardenAddress: "0xAAA",
    });

    config?.onAction?.("add-member");
    config?.onAction?.("manage-vault");

    expect(navigate).toHaveBeenNthCalledWith(1, "/community/members?gardenAddress=0xAAA");
    expect(navigate).toHaveBeenNthCalledWith(2, "/community/treasury/vault?gardenAddress=0xAAA");
  });

  it("keeps garden cookie jars scoped to the payouts Community mode", () => {
    expect(resolveCommunityMode("/community/payouts")).toBe("payouts");
    expect(communitySectionForMode("payouts")).toBe("cookie-jars");
  });
});
