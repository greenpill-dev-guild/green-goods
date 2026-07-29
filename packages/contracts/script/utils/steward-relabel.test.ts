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
  validateReviewedPlanArtifact,
  type RelabelPlan,
} from "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/relabel";
import { redactRpcUrl as redactSharedRpcUrl, redactSensitiveArgs } from "./cli-parser";
import { collectStewardGardenCoverageErrors, findStorageSlot } from "./post-deploy-verify";
import { extractEnumDefinitionsFromSource } from "./storage-layout-enums";

type InventoryIdentity = Pick<InventoryGarden, "tokenId" | "garden" | "operatorHatId">;

const UNIVERSAL_HATS = "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137";
const REVIEWED_PLAN_PATH = new URL(
  "../../deployments/tx-plans/42161-steward-relabel-488705295-plan.json",
  import.meta.url,
);

function loadReviewedPlan(): RelabelPlan {
  return JSON.parse(fs.readFileSync(REVIEWED_PLAN_PATH, "utf8")) as RelabelPlan;
}

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

  it("redacts sensitive values supplied with inline CLI syntax", () => {
    const rpcUrl = "https://user:password@provider.example/rpc";

    expect(redactSensitiveArgs([`--rpc-url=${rpcUrl}`, "--account=deployer", "--chain-id=42161"])).toEqual([
      "--rpc-url=[REDACTED]",
      "--account=[REDACTED]",
      "--chain-id=42161",
    ]);
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

  it("persists a fully redacted RPC marker in refreshed preflight artifacts", () => {
    const rpcUrl = "https://api-key.provider.example/custom/key?token=secret";
    const refreshSource = fs.readFileSync(
      new URL(
        "../../../../.plans/active/commitment-pooling/operations/steward-hat-relabel/refresh-direct-plan.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(redactSharedRpcUrl(rpcUrl)).toBe("https://[REDACTED]");
    expect(refreshSource).toContain("rpcUrl: redactRpcUrl(rpcUrl)");
    expect(refreshSource).not.toContain("rpcUrl: new URL(rpcUrl).origin");
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
    const plan = loadReviewedPlan();
    plan.hatsProtocol = "0x0000000000000000000000000000000000000001";

    expect(() => validateRelabelPlan(plan, 18)).toThrow(
      `Relabel plan Hats Protocol ${plan.hatsProtocol} does not match ${UNIVERSAL_HATS}`,
    );
  });

  it("rejects operator-supplied target counts that differ from the reviewed operation", () => {
    expect(() => validateRelabelPlan(loadReviewedPlan(), 17)).toThrow(
      "Relabel target count must equal the reviewed count 18",
    );
  });

  it("rejects altered same-count relabel transactions", () => {
    const plan = loadReviewedPlan();
    const transaction = plan.transactions[0] as {
      targetDetails: string;
      contractInputsValues: { _newDetails: string };
    };
    transaction.targetDetails = "Substituted Steward";
    transaction.contractInputsValues._newDetails = transaction.targetDetails;

    expect(() => validateRelabelPlan(plan, 18)).toThrow(
      "Relabel transaction 0 is not the reviewed changeHatDetails operation",
    );
  });

  it("pins execution to the reviewed plan artifact and digest", () => {
    const contents = fs.readFileSync(REVIEWED_PLAN_PATH, "utf8");
    expect(() => validateReviewedPlanArtifact(REVIEWED_PLAN_PATH.pathname, contents)).not.toThrow();
    expect(() => validateReviewedPlanArtifact(REVIEWED_PLAN_PATH.pathname, `${contents}\n`)).toThrow(
      "does not match the reviewed artifact",
    );
  });

  it("rejects Steward baselines that omit a live garden", () => {
    const errors = collectStewardGardenCoverageErrors(
      [GARDENS[0].garden, GARDENS[1].garden],
      GARDENS.map((garden) => garden.garden),
    );

    expect(errors).toContain("Steward baseline covers 2 gardens but live inventory contains 3");
    expect(errors).toContain(`Steward baseline is missing live garden ${GARDENS[2].garden}`);
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
    for (const scriptName of ["upgrade:hats-module:sepolia", "upgrade:hats-module:arbitrum"]) {
      expect(packageJson.scripts[scriptName]).toMatch(
        /^bun run check:storage-layout:hats-module && bun script\/upgrade\.ts hats-module /,
      );
    }
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
