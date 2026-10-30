import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getCreateAddress, Interface, keccak256 } from "ethers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCastJsonArgs,
  buildUpgradeBoundarySendArgs,
  hatsUpgradeRuntime,
  findLatestUpgradeArtifactIn,
  isAddressOrZero,
  type PersistedUpgradePlan,
  type UpgradeCheckpoint,
  UPGRADE_TRANSACTION_BOUNDARY_RULE,
  validateReleaseOwnedUpgradePlan,
  validateHatsUpgradePlan,
  validateUpgradeCheckpointPrefix,
} from "../upgrade";
import { buildReadOnlyCastEnv } from "./cast-env";
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

describe("Arbitrum Hats upgrade boundaries", () => {
  const sender = "0x0000000000000000000000000000000000000001";
  const proxy = "0x0000000000000000000000000000000000000002";
  const prior = "0x0000000000000000000000000000000000000003";
  const creationCode = "0x1234";
  const sourceCommit = "a".repeat(40);
  const implementation = getCreateAddress({ from: sender, nonce: 10 });
  const abi = new Interface(["function upgradeTo(address)"]);
  const inputs = { sender, proxy, sourceCommit, creationCode };
  function plan(): PersistedUpgradePlan {
    return {
      network: "arbitrum",
      chainId: 42161,
      contract: "hats-module",
      functionSignature: "upgradeHatsModule()",
      sender,
      expectedNonce: 10,
      releaseSourceCommit: sourceCommit,
      transactionBoundaryRule: UPGRADE_TRANSACTION_BOUNDARY_RULE,
      hatsUpgrade: { maxFeePerGasWei: "50000000" },
      transactionCount: 2,
      transactions: [
        {
          index: 0,
          transactionType: "CREATE",
          contractName: "HatsModule",
          from: sender,
          to: null,
          nonce: "10",
          value: "0",
          gas: "5000000",
          data: creationCode,
          contractAddress: implementation,
          function: null,
        },
        {
          index: 1,
          transactionType: "CALL",
          from: sender,
          to: proxy,
          nonce: "11",
          value: "0",
          gas: "100000",
          data: abi.encodeFunctionData("upgradeTo", [implementation]),
          contractAddress: proxy,
          function: "upgradeTo(address)",
        },
      ],
      upgrades: [
        {
          deploymentKey: "hatsModule",
          proxy,
          ownerAtPlan: sender,
          previousImplementation: prior,
          previousImplementationCodeHash: `0x${"b".repeat(64)}`,
          newImplementation: implementation,
          newImplementationCreationCodeHash: keccak256(creationCode),
          deployTransactionIndex: 0,
          upgradeTransactionIndex: 1,
        },
      ],
      wiring: [],
    };
  }
  it("accepts only the exact two zero-value nonce-bound transactions", () => {
    expect(() => validateHatsUpgradePlan(plan(), inputs)).not.toThrow();
  });
  it.each([
    [
      "an old unbound plan",
      (p: PersistedUpgradePlan) => {
        delete p.releaseSourceCommit;
      },
    ],
    [
      "a different commit",
      (p: PersistedUpgradePlan) => {
        p.releaseSourceCommit = "c".repeat(40);
      },
    ],
    [
      "changed creation code",
      (p: PersistedUpgradePlan) => {
        p.transactions[0].data = "0x1235";
      },
    ],
    [
      "another proxy",
      (p: PersistedUpgradePlan) => {
        p.transactions[1].to = prior;
      },
    ],
    [
      "a different implementation",
      (p: PersistedUpgradePlan) => {
        p.transactions[1].data = abi.encodeFunctionData("upgradeTo", [prior]);
      },
    ],
    [
      "a skipped nonce",
      (p: PersistedUpgradePlan) => {
        p.transactions[1].nonce = "12";
      },
    ],
    [
      "a value transfer",
      (p: PersistedUpgradePlan) => {
        p.transactions[0].value = "1";
      },
    ],
    [
      "an extra call",
      (p: PersistedUpgradePlan) => {
        p.transactions.push({ ...p.transactions[1], index: 2 });
        p.transactionCount = 3;
      },
    ],
    [
      "a higher fee",
      (p: PersistedUpgradePlan) => {
        p.hatsUpgrade!.maxFeePerGasWei = "50000001";
      },
    ],
    [
      "gas beyond the approved cap",
      (p: PersistedUpgradePlan) => {
        p.transactions[0].gas = "100000001";
      },
    ],
  ])("rejects %s before signing", (_name, mutate) => {
    const p = plan();
    mutate(p);
    expect(() => validateHatsUpgradePlan(p, inputs)).toThrow();
  });
  it("materializes the implementation's self immutable for exact runtime verification", () => {
    expect(hatsUpgradeRuntime(`0x60${"00".repeat(32)}ff`, [{ start: 1, length: 32 }], proxy)).toBe(
      `0x60${proxy.slice(2).padStart(64, "0")}ff`,
    );
    expect(() => hatsUpgradeRuntime("0x60ff", [{ start: 1, length: 32 }], proxy)).toThrow();
  });
});

describe("upgrade operator entrypoint", () => {
  it("accepts zero as a readable pre-wiring address without treating it as configured", () => {
    expect(isAddressOrZero("0x0000000000000000000000000000000000000000")).toBe(true);
    expect(isAddressOrZero("0x0000000000000000000000000000000000000001")).toBe(true);
    expect(isAddressOrZero("0x0")).toBe(false);
  });

  it("keeps the password lease out of read-only cast commands", () => {
    expect(
      buildReadOnlyCastEnv({
        ETH_PASSWORD: "/tmp/private-password-file",
        FOUNDRY_KEYSTORE_ACCOUNT: "green-goods-deployer",
        RPC_MARKER: "preserved",
      }),
    ).toEqual({ FOUNDRY_KEYSTORE_ACCOUNT: "green-goods-deployer", RPC_MARKER: "preserved" });
  });

  it("places every cast option before the raw CREATE subcommand", () => {
    const sendArgs = buildUpgradeBoundarySendArgs(
      {
        index: 0,
        from: "0x0000000000000000000000000000000000000001",
        to: null,
        nonce: "899",
        value: "0",
        data: "0x1234",
        contractAddress: "0x0000000000000000000000000000000000000002",
        function: null,
      },
      "42161",
      899,
      "green-goods-deployer",
    );

    expect(buildCastJsonArgs(sendArgs, "https://arb.example")).toEqual([
      "send",
      "--rpc-url",
      "https://arb.example",
      "--json",
      "--chain",
      "42161",
      "--nonce",
      "899",
      "--account",
      "green-goods-deployer",
      "--create",
      "0x1234",
    ]);
  });

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
    expect(output).toContain("bun run contracts -- upgrade commitment-pooling --network arbitrum --mode preflight");
    expect(output).not.toContain("forge script");
    expect(output).not.toContain("cast call");
  });

  it.each([
    "assessment-resolver",
    "hats-module",
  ])("will not broadcast %s without one reviewed plan boundary", (target) => {
    const result = spawnSync(
      "bun",
      [
        "script/upgrade.ts",
        target,
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

  it("keeps Hats gas and max-fee bounds before the CREATE payload", () => {
    const args = buildUpgradeBoundarySendArgs(
      {
        index: 0,
        from: "0x0000000000000000000000000000000000000001",
        to: null,
        nonce: "10",
        value: "0",
        gas: "0x4c4b40",
        data: "0x1234",
        contractAddress: null,
        function: null,
      },
      "42161",
      10,
      "green-goods-deployer",
      "50000000",
    );
    expect(args).toEqual([
      "send",
      "--chain",
      "42161",
      "--nonce",
      "10",
      "--account",
      "green-goods-deployer",
      "--gas-limit",
      "5000000",
      "--gas-price",
      "50000000",
      "--priority-gas-price",
      "0",
      "--create",
      "0x1234",
    ]);
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
