import { describe, expect, it } from "vitest";
import { getNetworkContracts, GreenWillABI } from "../../utils/blockchain/contracts";

describe("utils/blockchain/contracts GreenWill surface", () => {
  it("includes the GreenWill address in the network contracts map", () => {
    const contracts = getNetworkContracts(42161);

    expect(contracts).toHaveProperty("greenWill");
    expect(typeof contracts.greenWill).toBe("string");
  });

  it("exports the GreenWill contract ABIs needed by shared hooks", () => {
    expect(
      GreenWillABI.some((entry) => entry.type === "function" && entry.name === "claimBadge")
    ).toBe(true);
  });
});
