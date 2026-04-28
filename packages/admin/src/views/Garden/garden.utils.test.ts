import { buildGardenFabConfig } from "@green-goods/shared";
import { describe, expect, it, vi } from "vitest";

describe("buildGardenFabConfig", () => {
  it("preserves garden context when opening settings", () => {
    const navigate = vi.fn();
    const config = buildGardenFabConfig("overview", true, true, navigate, {
      gardenAddress: "0xAAA",
    });

    config?.onAction?.("edit-garden");

    expect(navigate).toHaveBeenCalledWith("/garden/settings?gardenAddress=0xAAA");
  });
});
