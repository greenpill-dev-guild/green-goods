import { describe, expect, it, vi } from "vitest";
import { buildCommunityFabConfig } from "./community.utils";

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
});
