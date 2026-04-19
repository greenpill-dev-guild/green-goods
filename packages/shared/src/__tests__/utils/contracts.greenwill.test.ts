import { describe, expect, it } from "vitest";
import {
  getNetworkContracts,
  GreenWillRegistryABI,
  GreenWillSupportRouterABI,
  GreenWillUnlockModuleABI,
} from "../../utils/blockchain/contracts";

describe("utils/blockchain/contracts GreenWill surface", () => {
  it("includes GreenWill addresses in the network contracts map", () => {
    const contracts = getNetworkContracts(42161);

    expect(contracts).toHaveProperty("greenWillRegistry");
    expect(contracts).toHaveProperty("greenWillUnlockModule");
    expect(contracts).toHaveProperty("greenWillSupportRouter");
    expect(typeof contracts.greenWillRegistry).toBe("string");
    expect(typeof contracts.greenWillUnlockModule).toBe("string");
    expect(typeof contracts.greenWillSupportRouter).toBe("string");
  });

  it("exports the GreenWill contract ABIs needed by shared hooks", () => {
    expect(
      GreenWillRegistryABI.some((entry) => entry.type === "function" && entry.name === "claimBadge")
    ).toBe(true);
    expect(
      GreenWillUnlockModuleABI.some(
        (entry) => entry.type === "function" && entry.name === "mintBadge"
      )
    ).toBe(true);
    expect(
      GreenWillSupportRouterABI.some(
        (entry) => entry.type === "function" && entry.name === "fundVault"
      )
    ).toBe(true);
  });
});
