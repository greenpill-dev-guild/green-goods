import fs from "node:fs";
import { describe, expect, it } from "vitest";

import { redactRpcUrlsInText, redactSensitiveArgs } from "./cli-parser";
import {
  collectStewardGardenCoverageErrors,
  collectStewardSelectorParityErrors,
  findStorageSlot,
} from "./post-deploy-verify";
import { extractEnumDefinitionsFromSource } from "./storage-layout-enums";

const GARDENS = [
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

describe("Steward upgrade and RPC safety", () => {
  it("redacts hosted RPC credentials from logged forge arguments", () => {
    const rpcUrl = "https://provider.example/rpc/super-secret-key";
    const args = ["script", "RelabelStewardHats", "--rpc-url", rpcUrl, "--chain-id", "42161"];

    const redacted = redactSensitiveArgs(args);

    expect(redacted).toEqual(["script", "RelabelStewardHats", "--rpc-url", "[REDACTED]", "--chain-id", "42161"]);
    expect(redacted).not.toContain(rpcUrl);
  });

  it("redacts sensitive values supplied with inline CLI syntax", () => {
    const rpcUrl = "https://user:password@provider.example/rpc";

    expect(redactSensitiveArgs([`--rpc-url=${rpcUrl}`, "--account=deployer", "--chain-id=42161"])).toEqual([
      "--rpc-url=[REDACTED]",
      "--account=[REDACTED]",
      "--chain-id=42161",
    ]);
  });

  it("redacts arbitrary RPC URL shapes embedded in command failures", () => {
    const message =
      "Command failed: cast storage 0x123 0x0 --rpc-url https://user:password@secret-project.rpc.example.com/custom/key?apiKey=super-secret (exit 1)";
    const redacted = redactRpcUrlsInText(message);

    expect(redacted).toContain("--rpc-url https://[REDACTED] (exit 1)");
    expect(redacted).not.toContain("user:password");
    expect(redacted).not.toContain("secret-project");
    expect(redacted).not.toContain("super-secret");
  });

  it("redacts WebSocket RPC credentials embedded in command failures", () => {
    const message = "Command failed: cast call --rpc-url wss://user:pass@provider.example/rpc?token=secret";
    const redacted = redactRpcUrlsInText(message);

    expect(redacted).toBe("Command failed: cast call --rpc-url wss://[REDACTED]");
    expect(redacted).not.toContain("user:pass");
    expect(redacted).not.toContain("token=secret");
  });

  it("rejects Steward baselines that omit a live garden", () => {
    const errors = collectStewardGardenCoverageErrors(
      [GARDENS[0].garden, GARDENS[1].garden],
      GARDENS.map((garden) => garden.garden),
    );

    expect(errors).toContain("Steward baseline covers 2 gardens but live inventory contains 3");
    expect(errors).toContain(`Steward baseline is missing live garden ${GARDENS[2].garden}`);
  });

  it("allows gardens with no current Steward while enforcing selector parity", () => {
    const garden = GARDENS[0].garden;
    expect(
      collectStewardSelectorParityErrors(garden, [
        { account: GARDENS[1].garden, steward: false, operator: false },
        { account: GARDENS[2].garden, steward: false, operator: false },
      ]),
    ).toEqual([]);
    expect(
      collectStewardSelectorParityErrors(garden, [{ account: GARDENS[1].garden, steward: true, operator: false }]),
    ).toEqual([`selector mismatch for garden ${garden}, account ${GARDENS[1].garden}`]);
  });

  it("derives the live garden mint count from the protected GardenToken storage slot", () => {
    const layout = JSON.parse(
      fs.readFileSync(new URL("../../storage-layouts/GardenToken.json", import.meta.url), "utf8"),
    ) as Parameters<typeof findStorageSlot>[0];

    expect(findStorageSlot(layout, "_nextTokenId", "t_uint256")).toBe("201");
    expect(() => findStorageSlot(layout, "_nextTokenId", "t_address")).toThrow(
      "Storage layout must contain one t_address _nextTokenId at offset zero",
    );
  });

  it("runs the HatsModule storage check before either broadcast wrapper", () => {
    const packageJson = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["check:storage-layout"]).toBe("bash script/check-storage-layout.sh");
    expect(packageJson.scripts["test:fork:hats-module-upgrade:sepolia"]).toBe(
      "bun script/utils/fork-shards.mjs run hats-module-upgrade-sepolia",
    );
    expect(packageJson.scripts["test:fork:hats-module-upgrade:arbitrum"]).toBe(
      "bun script/utils/fork-shards.mjs run hats-module-upgrade-arbitrum",
    );
    expect(packageJson.scripts["upgrade:hats-module:sepolia"]).toMatch(
      /^bun run check:storage-layout:hats-module && bun run test:fork:hats-module-upgrade:sepolia && bun script\/upgrade\.ts hats-module /,
    );
    expect(packageJson.scripts["upgrade:hats-module:arbitrum"]).toMatch(
      /^bun run check:storage-layout:hats-module && bun run test:fork:hats-module-upgrade:arbitrum && bun script\/upgrade\.ts hats-module /,
    );
  });

  it("requires fresh reviewed fork inputs for both HatsModule upgrade rehearsals", () => {
    const shardSource = fs.readFileSync(new URL("./fork-shards.mjs", import.meta.url), "utf8");

    expect(shardSource).toContain('"HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER"');
    expect(shardSource).toContain('"HATS_MODULE_UPGRADE_GARDEN_COUNT"');
    expect(shardSource).toContain('"HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION"');
    expect(shardSource).toContain("requiredPositiveIntegerEnv");
    expect(shardSource).toContain("requiredAddressEnv");
    expect(shardSource).not.toContain("ARBITRUM_FORK_BLOCK_NUMBER=488705295");
  });

  it("commits a baseline for every contract in the repository-wide storage gate", () => {
    for (const contract of [
      "GardenToken",
      "GardenAccount",
      "HatsModule",
      "KarmaGAPModule",
      "ActionRegistry",
      "WorkResolver",
      "WorkApprovalResolver",
      "AssessmentResolver",
      "Deployment",
    ]) {
      expect(fs.existsSync(new URL(`../../storage-layouts/${contract}.json`, import.meta.url))).toBe(true);
    }
  });

  it("extracts top-level and contract enum members in source order", () => {
    const first = extractEnumDefinitionsFromSource(`
      enum Capital { SOCIAL, MATERIAL, FINANCIAL }
      contract GardenToken {
        enum TransferRestriction { None, Limited, Soulbound }
      }
    `);
    const reordered = extractEnumDefinitionsFromSource(`
      enum Capital { MATERIAL, SOCIAL, FINANCIAL }
    `);

    expect(first).toEqual({
      Capital: ["SOCIAL", "MATERIAL", "FINANCIAL"],
      "GardenToken.TransferRestriction": ["None", "Limited", "Soulbound"],
    });
    expect(reordered.Capital).not.toEqual(first.Capital);
  });
});
