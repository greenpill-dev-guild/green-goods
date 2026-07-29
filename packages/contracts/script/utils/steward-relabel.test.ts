import { describe, expect, it } from "vitest";

import {
  validateInventoryCoverage,
  type InventoryGarden,
} from "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/refresh-direct-plan";
import { redactSensitiveArgs } from "./cli-parser";

type InventoryIdentity = Pick<InventoryGarden, "tokenId" | "garden" | "operatorHatId">;

const GARDENS: InventoryIdentity[] = [
  {
    tokenId: "0",
    garden: "0x0000000000000000000000000000000000000001",
    operatorHatId: "100",
  },
  {
    tokenId: "1",
    garden: "0x0000000000000000000000000000000000000002",
    operatorHatId: "101",
  },
  {
    tokenId: "2",
    garden: "0x0000000000000000000000000000000000000003",
    operatorHatId: "102",
  },
];

describe("Steward relabel safety", () => {
  it("redacts hosted RPC credentials from logged forge arguments", () => {
    const rpcUrl = "https://provider.example/rpc/super-secret-key";
    const args = ["script", "RelabelStewardHats", "--rpc-url", rpcUrl, "--chain-id", "42161"];

    const redacted = redactSensitiveArgs(args);

    expect(redacted).toEqual(["script", "RelabelStewardHats", "--rpc-url", "[REDACTED]", "--chain-id", "42161"]);
    expect(redacted).not.toContain(rpcUrl);
  });

  it("accepts a complete unique inventory even when token rows are unordered", () => {
    expect(() => validateInventoryCoverage([GARDENS[2], GARDENS[0], GARDENS[1]], 3)).not.toThrow();
  });

  it("rejects a duplicate token ID that omits part of the expected range", () => {
    const invalid = [GARDENS[0], GARDENS[1], { ...GARDENS[2], tokenId: "1" }];

    expect(() => validateInventoryCoverage(invalid, 3)).toThrow(
      "Reviewed inventory token IDs must uniquely cover 0..2",
    );
  });

  it("rejects duplicate garden addresses case-insensitively", () => {
    const invalid = [
      GARDENS[0],
      GARDENS[1],
      { ...GARDENS[2], garden: GARDENS[0].garden.toUpperCase() as InventoryIdentity["garden"] },
    ];

    expect(() => validateInventoryCoverage(invalid, 3)).toThrow(
      "Reviewed inventory contains a duplicate garden address",
    );
  });

  it("rejects duplicate operator hat IDs", () => {
    const invalid = [GARDENS[0], GARDENS[1], { ...GARDENS[2], operatorHatId: "0100" }];

    expect(() => validateInventoryCoverage(invalid, 3)).toThrow(
      "Reviewed inventory contains a duplicate operator hat ID",
    );
  });
});
