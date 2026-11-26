import rewardSafes from "@green-goods/contracts/deployments/42161-reward-safes.json";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { GreenWillABI } from "../../utils/blockchain/contract-abis/green-will";
import {
  GardenTokenABI,
  getGardenRewardSafe,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";

describe("utils/blockchain/contracts garden reward Safes", () => {
  it("reads every entry the Arbitrum record names, so none is dropped without anyone seeing", () => {
    const entries = rewardSafes.safes as {
      garden: `0x${string}`;
      safe: string;
      gate: string;
      signerHat: string;
    }[];
    for (const entry of entries) {
      expect(getGardenRewardSafe(42161, entry.garden)).toEqual({
        safe: getAddress(entry.safe),
        gate: getAddress(entry.gate),
        signerHat: BigInt(entry.signerHat),
      });
    }
  });
});

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

describe("utils/blockchain/contracts GardenToken ABI compatibility", () => {
  it("includes gardeners/stewards in mintGarden config tuple", () => {
    const mintGarden = (GardenTokenABI as readonly Record<string, unknown>[]).find(
      (item) => item.type === "function" && item.name === "mintGarden"
    );

    expect(mintGarden).toBeDefined();
    const inputs = (mintGarden?.inputs as Array<Record<string, unknown>>) ?? [];
    const tuple = inputs[0]?.components as Array<Record<string, string>>;
    const fieldNames = tuple.map((field) => field.name);

    expect(fieldNames).toContain("gardeners");
    expect(fieldNames).toContain("stewards");
  });
});
