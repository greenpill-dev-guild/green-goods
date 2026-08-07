import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { NetworkManager } from "./network";
import {
  POOLING_CONFIGURATION_STEP_KEYS,
  POOLING_REHEARSAL_FORK_NETWORK,
  POOLING_UPGRADE_KEYS,
  assertProxyOwnership,
  computeSchemaUID,
  configurationOwnerTargets,
  loadCommitmentSchemas,
  planPoolingConfiguration,
  planSchemaRegistration,
  readPoolingConfigurationTargets,
  schemaString,
} from "./pooling-release";
import { resolveUpgradeTargets } from "../upgrade";

const ZERO = "0x0000000000000000000000000000000000000000";
const OWNER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";

describe("pooling rehearsal target", () => {
  const networkManager = new NetworkManager();

  it("rehearses on an Arbitrum One fork", () => {
    expect(POOLING_REHEARSAL_FORK_NETWORK).toBe("arbitrum");
    expect(networkManager.getChainId(POOLING_REHEARSAL_FORK_NETWORK)).toBe(42_161);
  });

  it("does not configure a half-supported Sepolia testnet as a deploy target", () => {
    // Hats Protocol has no Arbitrum Sepolia deployment and Celo Sepolia has no published CCIP
    // lane, so neither can carry an honest rehearsal. Listing them would advertise support the
    // toolchain cannot deliver; the fork lane is the rehearsal.
    const configured = networkManager.getAvailableNetworks();

    expect(configured).not.toContain("arbitrum-sepolia");
    expect(configured).not.toContain("celo-sepolia");
    expect(() => networkManager.getNetwork(421_614)).toThrow(/Network not found/);
  });
});

describe("commitment schema definitions", () => {
  it("exposes exactly the two additive registrations, both non-revocable", () => {
    const schemas = loadCommitmentSchemas();

    expect(schemas.map((schema) => schema.key)).toEqual(["assessmentV3", "communityTestimony"]);
    expect(schemas.every((schema) => schema.revocable === false)).toBe(true);
  });

  it("builds the canonical assessment v3 string as v2's seven fields plus three", () => {
    const [assessmentV3] = loadCommitmentSchemas();

    expect(schemaString(assessmentV3.fields)).toBe(
      "string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate," +
        "uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,bytes32 baselineUID",
    );
  });

  it("builds the canonical community testimony string", () => {
    const testimony = loadCommitmentSchemas()[1];

    expect(schemaString(testimony.fields)).toBe("uint256 commitmentId,string title,string testimonyCID");
  });
});

describe("deterministic schema UID", () => {
  it("matches SchemaRegistry._getUID over schema, resolver, and revocable", () => {
    // keccak256(abi.encodePacked(schema, resolver, revocable)) — EAS SchemaRegistry.sol:52-54.
    const uid = computeSchemaUID("uint256 commitmentId,string title,string testimonyCID", ZERO, false);

    expect(uid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(computeSchemaUID("uint256 commitmentId,string title,string testimonyCID", ZERO, false)).toBe(uid);
  });

  it("changes when the resolver or revocability changes", () => {
    const base = computeSchemaUID("uint256 a", ZERO, false);

    expect(computeSchemaUID("uint256 a", OWNER, false)).not.toBe(base);
    expect(computeSchemaUID("uint256 a", ZERO, true)).not.toBe(base);
  });
});

describe("schema registration planning", () => {
  const definition = { key: "communityTestimony", schema: "uint256 commitmentId", resolver: OWNER, revocable: false };
  const uid = computeSchemaUID(definition.schema, definition.resolver, definition.revocable);

  it("registers when the registry has no record for the deterministic uid", () => {
    expect(planSchemaRegistration(definition, null)).toEqual({ key: definition.key, uid, action: "register" });
  });

  it("reconciles an exact existing record instead of registering twice", () => {
    const existing = { uid, schema: definition.schema, resolver: definition.resolver, revocable: false };

    expect(planSchemaRegistration(definition, existing)).toEqual({ key: definition.key, uid, action: "reconcile" });
  });

  it("fails closed when the registry holds a different record under the same uid", () => {
    const conflicting = { uid, schema: "uint256 other", resolver: definition.resolver, revocable: false };

    expect(() => planSchemaRegistration(definition, conflicting)).toThrow(/communityTestimony/);
  });
});

describe("pooling upgrade targets", () => {
  it("resolves the module and the register together as one grouped target", () => {
    const deployment = {
      commitmentPoolingModule: "0x1111111111111111111111111111111111111111",
      commitmentRegistry: "0x2222222222222222222222222222222222222222",
    };

    const { resolved } = resolveUpgradeTargets("pooling", deployment);

    expect(resolved.map((target) => target.deploymentKey)).toEqual([...POOLING_UPGRADE_KEYS]);
  });

  it("fails closed when either half is missing from the artifact", () => {
    expect(() =>
      resolveUpgradeTargets("pooling", { commitmentPoolingModule: "0x1111111111111111111111111111111111111111" }),
    ).toThrow(/commitmentRegistry/);
  });

  it("fails closed on a zero address rather than upgrading nothing", () => {
    expect(() =>
      resolveUpgradeTargets("pooling", {
        commitmentPoolingModule: "0x1111111111111111111111111111111111111111",
        commitmentRegistry: ZERO,
      }),
    ).toThrow(/commitmentRegistry/);
  });
});

describe("live proxy owner preflight", () => {
  const targets = [
    { label: "commitmentPoolingModule", address: "0x1111111111111111111111111111111111111111", owner: OWNER },
    { label: "commitmentRegistry", address: "0x2222222222222222222222222222222222222222", owner: OWNER },
  ];

  it("accepts a sender that owns every proxy, ignoring checksum casing", () => {
    expect(() => assertProxyOwnership(targets, OWNER.toLowerCase())).not.toThrow();
  });

  it("rejects a sender that owns only some of the proxies", () => {
    const mixed = [targets[0], { ...targets[1], owner: "0x3333333333333333333333333333333333333333" }];

    expect(() => assertProxyOwnership(mixed, OWNER)).toThrow(/commitmentRegistry/);
  });

  it("refuses to run without a sender rather than assuming the keystore owns the proxies", () => {
    expect(() => assertProxyOwnership(targets, undefined)).toThrow(/--sender/);
  });

  it("refuses an unreadable owner rather than treating it as a pass", () => {
    const unreadable = [{ ...targets[0], owner: null }];

    expect(() => assertProxyOwnership(unreadable, OWNER)).toThrow(/commitmentPoolingModule/);
  });
});

describe("pooling configuration targets", () => {
  const artifact = {
    assessmentResolver: "0xA000000000000000000000000000000000000001",
    testimonyResolver: "0xA000000000000000000000000000000000000002",
    workApprovalResolver: "0xA000000000000000000000000000000000000003",
    commitmentPoolingModule: "0xA000000000000000000000000000000000000004",
    schemas: {
      assessmentSchemaUID: `0x${"11".repeat(32)}`,
      assessmentV3SchemaUID: `0x${"22".repeat(32)}`,
      communityTestimonySchemaUID: `0x${"33".repeat(32)}`,
    },
  };

  it("reads every address and schema UID the configuration run needs", () => {
    const targets = readPoolingConfigurationTargets(artifact);

    expect(targets.commitmentPoolingModule).toBe(artifact.commitmentPoolingModule);
    expect(targets.assessmentV3SchemaUID).toBe(artifact.schemas.assessmentV3SchemaUID);
    expect(targets.communityTestimonySchemaUID).toBe(artifact.schemas.communityTestimonySchemaUID);
  });

  it("names the missing key rather than configuring against a zero address", () => {
    expect(() => readPoolingConfigurationTargets({ ...artifact, testimonyResolver: ZERO })).toThrow(
      /testimonyResolver/,
    );
    expect(() => readPoolingConfigurationTargets({ ...artifact, commitmentPoolingModule: undefined })).toThrow(
      /commitmentPoolingModule/,
    );
  });

  it("names the missing schema UID, which is the prerequisite the resolvers actually revert on", () => {
    const withoutV3 = { ...artifact, schemas: { ...artifact.schemas, assessmentV3SchemaUID: undefined } };

    expect(() => readPoolingConfigurationTargets(withoutV3)).toThrow(/assessmentV3SchemaUID/);
  });
});

describe("pooling configuration planning", () => {
  const targets = {
    assessmentResolver: "0xA000000000000000000000000000000000000001",
    testimonyResolver: "0xA000000000000000000000000000000000000002",
    workApprovalResolver: "0xA000000000000000000000000000000000000003",
    commitmentPoolingModule: "0xA000000000000000000000000000000000000004",
    assessmentSchemaUID: `0x${"11".repeat(32)}`,
    assessmentV3SchemaUID: `0x${"22".repeat(32)}`,
    communityTestimonySchemaUID: `0x${"33".repeat(32)}`,
  };
  const ZERO_UID = `0x${"00".repeat(32)}`;
  /** Live Arbitrum before this lane runs: core deployed, nothing pooling-related configured. */
  const unconfigured = {
    assessmentSchemaUID: ZERO_UID,
    assessmentV3SchemaUID: ZERO_UID,
    testimonySchemaUID: ZERO_UID,
    testimonyCommitmentModule: ZERO,
    workApprovalCommitmentModule: ZERO,
  };

  it("plans every step in dependency order from an unconfigured chain", () => {
    const plan = planPoolingConfiguration(targets, unconfigured);

    expect(plan.map((step) => step.key)).toEqual([...POOLING_CONFIGURATION_STEP_KEYS]);
    expect(plan.every((step) => step.action === "set")).toBe(true);
  });

  it("pins the v2 assessment UID before setting v3, which reverts while v2 is zero", () => {
    const plan = planPoolingConfiguration(targets, unconfigured);
    const v2Index = plan.findIndex((step) => step.key === "assessmentV2Pin");
    const v3Index = plan.findIndex((step) => step.key === "assessmentV3");

    expect(v2Index).toBeGreaterThanOrEqual(0);
    expect(v2Index).toBeLessThan(v3Index);
  });

  it("registers the testimony schema before its commitment module, which reverts while the UID is zero", () => {
    const plan = planPoolingConfiguration(targets, unconfigured);
    const schemaIndex = plan.findIndex((step) => step.key === "testimonySchema");
    const moduleIndex = plan.findIndex((step) => step.key === "testimonyModule");

    expect(schemaIndex).toBeLessThan(moduleIndex);
  });

  it("is safe to re-run: a fully configured chain plans no writes", () => {
    const configured = {
      assessmentSchemaUID: targets.assessmentSchemaUID,
      assessmentV3SchemaUID: targets.assessmentV3SchemaUID,
      testimonySchemaUID: targets.communityTestimonySchemaUID,
      testimonyCommitmentModule: targets.commitmentPoolingModule,
      workApprovalCommitmentModule: targets.commitmentPoolingModule,
    };

    const plan = planPoolingConfiguration(targets, configured);

    expect(plan.map((step) => step.key)).toEqual([...POOLING_CONFIGURATION_STEP_KEYS]);
    expect(plan.every((step) => step.action === "satisfied")).toBe(true);
  });

  it("resumes an interrupted run, writing only the steps that did not land", () => {
    const halfway = {
      ...unconfigured,
      assessmentSchemaUID: targets.assessmentSchemaUID,
      assessmentV3SchemaUID: targets.assessmentV3SchemaUID,
    };

    const plan = planPoolingConfiguration(targets, halfway);

    expect(plan.filter((step) => step.action === "set").map((step) => step.key)).toEqual([
      "testimonySchema",
      "testimonyModule",
      "workApprovalBridge",
    ]);
  });

  it("ignores checksum casing when comparing a live module address", () => {
    const configured = {
      ...unconfigured,
      testimonyCommitmentModule: targets.commitmentPoolingModule.toLowerCase(),
      workApprovalCommitmentModule: targets.commitmentPoolingModule.toUpperCase().replace("0X", "0x"),
    };

    const plan = planPoolingConfiguration(targets, configured);
    const bridges = plan.filter((step) => step.key === "testimonyModule" || step.key === "workApprovalBridge");

    expect(bridges.every((step) => step.action === "satisfied")).toBe(true);
  });

  it("fails closed when the testimony resolver already holds a different schema UID", () => {
    const conflicting = { ...unconfigured, testimonySchemaUID: `0x${"99".repeat(32)}` };

    expect(() => planPoolingConfiguration(targets, conflicting)).toThrow(/testimony/i);
  });

  it("fails closed when the assessment resolver is validating a different v2 schema than the artifact records", () => {
    const conflicting = { ...unconfigured, assessmentSchemaUID: `0x${"99".repeat(32)}` };

    expect(() => planPoolingConfiguration(targets, conflicting)).toThrow(/assessment/i);
  });

  it("refuses to silently repoint a live v3 schema UID, which would revalidate existing attestations", () => {
    const conflicting = {
      ...unconfigured,
      assessmentSchemaUID: targets.assessmentSchemaUID,
      assessmentV3SchemaUID: `0x${"99".repeat(32)}`,
    };

    expect(() => planPoolingConfiguration(targets, conflicting)).toThrow(/assessmentV3SchemaUID/);
  });

  it("refuses to silently repoint the live work-approval bridge at a different module", () => {
    const conflicting = { ...unconfigured, workApprovalCommitmentModule: "0xB000000000000000000000000000000000000009" };

    expect(() => planPoolingConfiguration(targets, conflicting)).toThrow(/workApprovalResolver/);
  });

  it("rejects a v3 UID equal to v2, which the resolver reverts as a collision", () => {
    const collided = { ...targets, assessmentV3SchemaUID: targets.assessmentSchemaUID };

    expect(() => planPoolingConfiguration(collided, unconfigured)).toThrow(/collision/i);
  });

  it("derives the owner-preflight proxies from the plan, so a new step cannot escape the check", () => {
    const plan = planPoolingConfiguration(targets, unconfigured);
    const proxies = configurationOwnerTargets(plan);

    // Every proxy the plan writes to, each listed once.
    expect(proxies.map((proxy) => proxy.label).sort()).toEqual([
      "assessmentResolver",
      "testimonyResolver",
      "workApprovalResolver",
    ]);
    expect(new Set(plan.map((step) => step.target)).size).toBe(proxies.length);
    expect(proxies.find((proxy) => proxy.label === "testimonyResolver")?.address).toBe(targets.testimonyResolver);
  });
});

describe("CCIP chain selector serialization", () => {
  const networksPath = path.join(__dirname, "../../deployments/networks.json");
  const raw = fs.readFileSync(networksPath, "utf8");

  /**
   * CCIP selectors are uint64 and exceed `Number.MAX_SAFE_INTEGER`, so a JSON number is lossy the
   * moment any TypeScript consumer calls `JSON.parse` — Arbitrum's `4949039107694359620` becomes
   * `4949039107694359552`, off by 68. Solidity's `vm.parseJson` is exact, which is precisely why a
   * Solidity-only fork test could report the lane green while the shipped config was already
   * corrupt for every JS reader.
   */
  it("stores every selector as a base-10 string, never a JSON number", () => {
    const unquoted = [...raw.matchAll(/"ccipChainSelector":\s*([^"\s,}][^,}]*)/g)].map((match) => match[1].trim());

    expect(unquoted).toEqual([]);
  });

  it("round-trips every selector through JSON.parse without losing a digit", () => {
    const networks = JSON.parse(raw).networks as Record<string, { ccipChainSelector?: unknown }>;

    for (const [name, config] of Object.entries(networks)) {
      const selector = config.ccipChainSelector;
      if (selector === undefined) continue;

      expect(typeof selector, `${name}.ccipChainSelector must be a string`).toBe("string");
      // Exact both ways: parseable as an integer, and unchanged when rendered back.
      expect(String(BigInt(selector as string)), `${name}.ccipChainSelector lost precision`).toBe(selector);
    }
  });

  it("pins the two selectors the settlement lane was verified against", () => {
    const networks = JSON.parse(raw).networks as Record<string, { ccipChainSelector?: string }>;

    // Official Chainlink directory values, proven live on chain 2026-08-06.
    expect(networks.arbitrum.ccipChainSelector).toBe("4949039107694359620");
    expect(networks.celo.ccipChainSelector).toBe("1346049177634351622");
  });
});
