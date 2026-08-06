import { describe, expect, it } from "vitest";
import { NetworkManager } from "./network";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  POOLING_UPGRADE_KEYS,
  assertProxyOwnership,
  computeSchemaUID,
  loadCommitmentSchemas,
  planSchemaRegistration,
  schemaString,
} from "./pooling-release";
import { resolveUpgradeTargets } from "../upgrade";

const ZERO = "0x0000000000000000000000000000000000000000";
const OWNER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";

describe("Arbitrum Sepolia network record", () => {
  const networkManager = new NetworkManager();

  it("resolves the 421614 rehearsal target by name and by chain id", () => {
    expect(networkManager.getChainId("arbitrum-sepolia")).toBe(421_614);
    expect(networkManager.getChainIdString("arbitrum-sepolia")).toBe(ARBITRUM_SEPOLIA_CHAIN_ID);
    expect(networkManager.getNetwork(421_614).name).toBe("arbitrum-sepolia");
  });

  it("carries the published Arbitrum Sepolia EAS deployment, never a copied Ethereum Sepolia address", () => {
    const arbitrumSepolia = networkManager.getNetwork("arbitrum-sepolia");
    const ethereumSepolia = networkManager.getNetwork("sepolia");

    expect(arbitrumSepolia.contracts?.eas).toBe("0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE");
    expect(arbitrumSepolia.contracts?.easSchemaRegistry).toBe("0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475");
    expect(arbitrumSepolia.contracts?.eas).not.toBe(ethereumSepolia.contracts?.eas);
    expect(arbitrumSepolia.contracts?.easSchemaRegistry).not.toBe(ethereumSepolia.contracts?.easSchemaRegistry);
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
