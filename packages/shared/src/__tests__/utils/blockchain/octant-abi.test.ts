import { describe, expect, it } from "vitest";

import { OCTANT_VAULT_ABI } from "../../../utils/blockchain/abis/octant";

describe("OCTANT_VAULT_ABI", () => {
  it("uses the deployed Octant redeem signature with maxLoss and strategies", () => {
    const redeem = OCTANT_VAULT_ABI.find((entry) => entry.name === "redeem");

    expect(redeem).toBeDefined();
    expect(redeem?.inputs).toEqual([
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ]);
  });
});
