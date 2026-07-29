import fs from "node:fs";
import { describe, expect, it } from "vitest";

import {
  validateInventoryCoverage,
  type InventoryGarden,
} from "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/refresh-direct-plan";
import {
  collectPreparationValidationErrors,
  redactRpcError,
  redactRpcUrl,
} from "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/prepare";
import {
  validateRelabelPlan,
  type RelabelPlan,
} from "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/relabel";
import { redactSensitiveArgs } from "./cli-parser";

type InventoryIdentity = Pick<InventoryGarden, "tokenId" | "garden" | "operatorHatId">;

const UNIVERSAL_HATS = "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137";
const EXPECTED_CALLER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";

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

  it("fully redacts RPC URLs and error messages regardless of credential shape", () => {
    const rpcUrl = "https://user:password@api-key.provider.example/custom/key?token=secret";
    const message = `cast failed while calling ${rpcUrl}`;

    expect(redactRpcUrl(rpcUrl)).toBe("https://[REDACTED]");
    expect(redactRpcError(message, rpcUrl)).toBe("cast failed while calling https://[REDACTED]");
    expect(redactRpcError(message, rpcUrl)).not.toContain("password");
    expect(redactRpcError(message, rpcUrl)).not.toContain("api-key");
    expect(redactRpcError(message, rpcUrl)).not.toContain("secret");
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

  it("blocks preparation when any target hat is inactive", () => {
    const errors = collectPreparationValidationErrors([
      {
        garden: GARDENS[0].garden,
        operatorHatId: GARDENS[0].operatorHatId,
        mutable: true,
        active: false,
        expectedCallerIsAdmin: true,
        expectedCallerControlsGarden: false,
        gardenIsAdmin: true,
        validationErrors: [],
      },
    ]);

    expect(errors).toContain("At least one target operator hat is inactive");
  });

  it("rejects relabel plans that do not target the canonical Hats contract", () => {
    const plan: RelabelPlan = {
      version: 1,
      chainId: "42161",
      caller: EXPECTED_CALLER,
      hatsProtocol: "0x0000000000000000000000000000000000000001",
      targetCount: 1,
      transactions: [{}],
    };

    expect(() => validateRelabelPlan(plan, 1)).toThrow(
      `Relabel plan Hats Protocol ${plan.hatsProtocol} does not match ${UNIVERSAL_HATS}`,
    );
  });

  it("runs the HatsModule storage check before either broadcast wrapper", () => {
    const packageJson = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };

    for (const scriptName of ["upgrade:hats-module:sepolia", "upgrade:hats-module:arbitrum"]) {
      expect(packageJson.scripts[scriptName]).toMatch(
        /^bun run check:storage-layout:hats-module && bun script\/upgrade\.ts hats-module /,
      );
    }
  });
});
