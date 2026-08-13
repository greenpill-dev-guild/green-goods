import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getCreateAddress, Interface, keccak256 } from "ethers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findLatestUpgradeArtifactIn,
  type PersistedUpgradePlan,
  type UpgradeCheckpoint,
  UPGRADE_TRANSACTION_BOUNDARY_RULE,
  validateReleaseOwnedUpgradePlan,
  validateUpgradeCheckpointPrefix,
} from "../upgrade";
import type { ReleaseLock, ReleaseManifest } from "./release-manifest";

describe("upgrade transaction plan artifact discovery", () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-upgrade-plan-"));
    fs.mkdirSync(path.join(temporaryDirectory, "dry-run"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("finds Foundry's signature-specific dry-run artifact", () => {
    const artifactPath = path.join(temporaryDirectory, "dry-run", "upgradeHatsModule-latest.json");
    fs.writeFileSync(artifactPath, "{}");

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(artifactPath);
  });

  it("retains compatibility with the legacy run-latest artifact", () => {
    const artifactPath = path.join(temporaryDirectory, "dry-run", "run-latest.json");
    fs.writeFileSync(artifactPath, "{}");

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(artifactPath);
  });

  it("selects a fresh legacy artifact over a stale signature-specific artifact", () => {
    const signatureArtifact = path.join(temporaryDirectory, "dry-run", "upgradeHatsModule-latest.json");
    const legacyArtifact = path.join(temporaryDirectory, "dry-run", "run-latest.json");
    fs.writeFileSync(signatureArtifact, "{}");
    fs.writeFileSync(legacyArtifact, "{}");
    fs.utimesSync(signatureArtifact, new Date(1_000), new Date(1_000));
    fs.utimesSync(legacyArtifact, new Date(2_000), new Date(2_000));

    expect(findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule()")).toBe(legacyArtifact);
  });

  it("fails closed for an invalid function signature", () => {
    expect(() => findLatestUpgradeArtifactIn(temporaryDirectory, "upgradeHatsModule")).toThrow(
      "Invalid upgrade function signature",
    );
  });
});

describe("upgrade operator entrypoint", () => {
  it("requires an explicit sender before a transaction plan can touch RPC", () => {
    const result = spawnSync(
      "bun",
      ["script/upgrade.ts", "assessment-resolver", "--network", "arbitrum", "--tx-plan"],
      { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: process.env },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("--tx-plan requires an explicit --sender");
  });

  it("documents only Bun-wrapped rollback and upgrade commands", () => {
    const result = spawnSync("bun", ["script/upgrade.ts", "--help"], {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf8",
      env: process.env,
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain("bun run pooling:upgrade:dry:arbitrum");
    expect(output).not.toContain("forge script");
    expect(output).not.toContain("cast call");
  });

  it("will not enter a release-owned broadcast path without one reviewed plan boundary", () => {
    const result = spawnSync(
      "bun",
      [
        "script/upgrade.ts",
        "assessment-resolver",
        "--network",
        "arbitrum",
        "--broadcast",
        "--sender",
        "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6",
        "--expected-nonce",
        "899",
      ],
      { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: process.env },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("requires --plan <path> and --step <index>");
  });
});

describe("release-owned upgrade plan integrity", () => {
  const sender = "0x0000000000000000000000000000000000000001";
  const proxy = "0x0000000000000000000000000000000000000002";
  const previousImplementation = "0x0000000000000000000000000000000000000003";
  const schemaUid = `0x${"4".repeat(64)}`;
  const createData = "0x1234";
  const expectedNonce = 10;
  const newImplementation = getCreateAddress({ from: sender, nonce: expectedNonce });
  const upgradeInterface = new Interface(["function upgradeTo(address)"]);
  const schemaInterface = new Interface(["function setSchemaUID(bytes32 uid)"]);
  const manifest = {
    ownership: { deploymentSender: sender },
    chains: { arbitrum: { evmChainId: "42161" } },
    existingProxyUpgrades: [
      {
        name: "AssessmentResolver",
        proxy,
        currentImplementation: previousImplementation,
        currentImplementationCodeHash: `0x${"5".repeat(64)}`,
        currentOwner: sender,
        expectedImplementationCreationCodeHash: keccak256(createData),
      },
    ],
  } as ReleaseManifest;
  const lock = {
    manifestHash: `0x${"6".repeat(64)}`,
    sourceCommit: "7".repeat(40),
    identities: [],
  } as unknown as ReleaseLock;
  const deployment = { assessmentResolver: proxy, schemas: { assessmentSchemaUID: schemaUid } };

  function plan(): PersistedUpgradePlan {
    return {
      network: "arbitrum",
      chainId: 42161,
      contract: "assessment-resolver",
      functionSignature: "upgradeAssessmentResolver()",
      sender,
      expectedNonce,
      releaseManifestHash: lock.manifestHash,
      releaseSourceCommit: lock.sourceCommit,
      transactionCount: 3,
      transactions: [
        {
          index: 0,
          transactionType: "CREATE",
          contractName: "AssessmentResolver",
          from: sender,
          to: null,
          nonce: "10",
          value: "0",
          data: createData,
          contractAddress: newImplementation,
          function: null,
        },
        {
          index: 1,
          from: sender,
          to: proxy,
          nonce: "11",
          value: "0",
          data: upgradeInterface.encodeFunctionData("upgradeTo", [newImplementation]),
          contractAddress: proxy,
          function: "upgradeTo(address)",
        },
        {
          index: 2,
          from: sender,
          to: proxy,
          nonce: "12",
          value: "0",
          data: schemaInterface.encodeFunctionData("setSchemaUID", [schemaUid]),
          contractAddress: proxy,
          function: "setSchemaUID(bytes32)",
        },
      ],
      upgrades: [
        {
          deploymentKey: "assessmentResolver",
          proxy,
          ownerAtPlan: sender,
          previousImplementation,
          previousImplementationCodeHash: manifest.existingProxyUpgrades[0].currentImplementationCodeHash,
          newImplementation,
          newImplementationCreationCodeHash: keccak256(createData),
          deployTransactionIndex: 0,
          upgradeTransactionIndex: 1,
        },
      ],
      wiring: [],
      assessmentSchemaPin: {
        proxy,
        expectedSchemaUID: schemaUid,
        transactionIndex: 2,
        resumableState: "reviewed",
      },
      transactionBoundaryRule: UPGRADE_TRANSACTION_BOUNDARY_RULE,
    };
  }

  it("re-derives every upgrade transaction instead of trusting a copied manifest hash", () => {
    const reviewed = plan();
    expect(() => validateReleaseOwnedUpgradePlan(reviewed, manifest, lock, deployment)).not.toThrow();

    const tampered = structuredClone(reviewed);
    tampered.transactions[1].data = upgradeInterface.encodeFunctionData("upgradeTo", [previousImplementation]);
    expect(() => validateReleaseOwnedUpgradePlan(tampered, manifest, lock, deployment)).toThrow(
      "freshly derived boundary",
    );
  });

  it("requires one contiguous receipt-backed checkpoint prefix", () => {
    const reviewed = plan();
    const checkpoint: UpgradeCheckpoint = {
      schemaVersion: 1,
      planHash: `0x${"8".repeat(64)}`,
      completed: [
        {
          step: 2,
          transactionHash: `0x${"9".repeat(64)}`,
          blockNumber: "12",
          verifiedAt: "2026-08-12T12:00:00.000Z",
        },
      ],
    };
    expect(() => validateUpgradeCheckpointPrefix(checkpoint, reviewed, 3)).toThrow(
      "not the next boundary in the verified prefix",
    );
  });
});
