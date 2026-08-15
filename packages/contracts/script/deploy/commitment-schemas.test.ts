import * as fs from "node:fs";
import * as path from "node:path";
import { Interface, keccak256 } from "ethers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ParsedOptions } from "../utils/cli-parser";
import type { SchemaRegistrationPlan } from "../utils/pooling-release";
import {
  CommitmentSchemasDeployer,
  finalizedPreparationModuleForReplay,
  SCHEMA_RESUMABLE_STATE,
  SCHEMA_TRANSACTION_BOUNDARY_RULE,
  type FrozenSchemaPlanInputs,
  type PersistedSchemaPlan,
  type SchemaCheckpoint,
  schemaSimulationArtifactName,
  validateReviewedSchemaPlan,
  validateSchemaCheckpointPrefix,
  validateSchemaReceiptTransaction,
} from "./commitment-schemas";

/**
 * The append-only merge and its two side files.
 *
 * These paths had no coverage at all: a mutation removing `mergePreparedResolver`'s zero-address
 * refusal survived the entire suite, and the finalization side file was written by the broadcast
 * and never read. Both run as the last step of a lane whose earlier steps are already on chain, so
 * a defect here corrupts the canonical artifact after the irreversible part has happened.
 *
 * Everything runs against a synthetic chain id. The deployer resolves `deployments/` relative to
 * its own module, so the fixtures land in the real directory — but never under a chain the repo
 * actually deploys to, so a failing case cannot leave a real artifact damaged.
 */
describe("CommitmentSchemasDeployer artifact merge", () => {
  it("uses Foundry's signature-specific artifact name for finalization plans", () => {
    expect(schemaSimulationArtifactName(false)).toBe("run-latest.json");
    expect(schemaSimulationArtifactName(true)).toBe("finalizeCommunityTestimony-latest.json");
  });

  it("accepts downstream activation only when replaying a fully checkpointed preparation", () => {
    const module = `0x${"44".repeat(20)}`;
    expect(
      finalizedPreparationModuleForReplay({
        mode: "preparation",
        replayComplete: true,
        deploymentModule: module,
        frozenPoolingModule: module,
      }),
    ).toBe(module);
    expect(
      finalizedPreparationModuleForReplay({
        mode: "preparation",
        replayComplete: false,
        deploymentModule: module,
        frozenPoolingModule: module,
      }),
    ).toBeUndefined();
    expect(
      finalizedPreparationModuleForReplay({
        mode: "preparation",
        replayComplete: true,
        deploymentModule: module,
        frozenPoolingModule: `0x${"55".repeat(20)}`,
      }),
    ).toBeUndefined();
  });

  const CHAIN_ID = "99999901";
  const RESOLVER = `0x${"ab".repeat(20)}`;
  const RESOLVER_IMPL = `0x${"cd".repeat(20)}`;
  const TESTIMONY_UID = `0x${"33".repeat(32)}`;
  const EXISTING_UID = `0x${"11".repeat(32)}`;

  const deploymentsDir = path.join(__dirname, "../../deployments");
  const mainPath = path.join(deploymentsDir, `${CHAIN_ID}-latest.json`);
  const preparedPath = path.join(deploymentsDir, `${CHAIN_ID}-commitment-schemas-prepared.json`);
  const finalPath = path.join(deploymentsDir, `${CHAIN_ID}-commitment-schemas-final.json`);

  let deployer: CommitmentSchemasDeployer;

  beforeEach(() => {
    deployer = new CommitmentSchemasDeployer();
    fs.writeFileSync(
      mainPath,
      `${JSON.stringify({ assessmentResolver: RESOLVER, schemas: { assessmentSchemaUID: EXISTING_UID } }, null, 2)}\n`,
    );
  });

  afterEach(() => {
    for (const file of [mainPath, preparedPath, finalPath]) {
      if (fs.existsSync(file)) fs.rmSync(file);
    }
  });

  function readArtifact(): { root: Record<string, unknown>; schemas: Record<string, unknown> } {
    const root = JSON.parse(fs.readFileSync(mainPath, "utf8")) as Record<string, unknown>;
    return { root, schemas: (root.schemas ?? {}) as Record<string, unknown> };
  }

  /** `mergeIntoDeployment` is private; these tests drive it exactly as `broadcast` does. */
  function merge(plans: SchemaRegistrationPlan[], finalizeCommunityTestimony: boolean): void {
    const definitions = plans.map((plan) => ({
      key: plan.key,
      name: `name-${plan.key}`,
      description: `description-${plan.key}`,
      revocable: false,
      fields: [{ name: "commitmentId", type: "uint256" }],
    }));

    (
      deployer as unknown as {
        mergeIntoDeployment: (
          chainId: string,
          definitions: unknown[],
          plans: SchemaRegistrationPlan[],
          options: ParsedOptions,
        ) => void;
      }
    ).mergeIntoDeployment(CHAIN_ID, definitions, plans, { finalizeCommunityTestimony } as ParsedOptions);
  }

  const preparationPlans: SchemaRegistrationPlan[] = [
    { key: "assessmentV3", uid: `0x${"22".repeat(32)}`, action: "register" },
  ];
  const finalizationPlans = (uid = TESTIMONY_UID): SchemaRegistrationPlan[] => [
    { key: "communityTestimony", uid, action: "register" },
  ];

  it("refuses to record a partial deployment when the prepared side file has a zero address", () => {
    fs.writeFileSync(
      preparedPath,
      JSON.stringify({ testimonyResolver: `0x${"0".repeat(40)}`, testimonyResolverImpl: RESOLVER_IMPL }),
    );

    // Without the guard this writes a zero `testimonyResolver` into the canonical artifact, and
    // every later step reads that zero as the resolver the schema UID commits to.
    expect(() => merge(preparationPlans, false)).toThrow(/refusing to record a partial deployment/);
  });

  it("refuses a prepared side file that is missing a key outright", () => {
    fs.writeFileSync(preparedPath, JSON.stringify({ testimonyResolver: RESOLVER }));

    expect(() => merge(preparationPlans, false)).toThrow(/testimonyResolverImpl/);
  });

  it("promotes both resolver addresses and all four schema keys on a complete preparation", () => {
    fs.writeFileSync(
      preparedPath,
      JSON.stringify({ testimonyResolver: RESOLVER, testimonyResolverImpl: RESOLVER_IMPL }),
    );

    merge(preparationPlans, false);

    const { root, schemas } = readArtifact();
    expect(root.testimonyResolver).toBe(RESOLVER);
    expect(root.testimonyResolverImpl).toBe(RESOLVER_IMPL);
    // §6.4.4 lists all four keys per schema, not just the UID.
    expect(schemas.assessmentV3SchemaUID).toBe(preparationPlans[0].uid);
    expect(schemas.assessmentV3Schema).toBe("uint256 commitmentId");
    expect(schemas.assessmentV3Name).toBe("name-assessmentV3");
    expect(schemas.assessmentV3Description).toBe("description-assessmentV3");
    // Append-only: preparation must never write the Community Testimony key, and must not disturb
    // the keys already there.
    expect(schemas.communityTestimonySchemaUID).toBeUndefined();
    expect(schemas.assessmentSchemaUID).toBe(EXISTING_UID);
  });

  it("refuses to write the canonical UID when the finalization side file is absent", () => {
    // The side file is the broadcast's last action, so its absence means the resolver was never
    // activated — the canonical key must not appear.
    expect(() => merge(finalizationPlans(), true)).toThrow(/Finalization side file not found/);
    expect(readArtifact().schemas.communityTestimonySchemaUID).toBeUndefined();
  });

  it("refuses when the broadcast recorded a different UID than this run planned", () => {
    fs.writeFileSync(finalPath, JSON.stringify({ communityTestimonySchemaUID: `0x${"99".repeat(32)}` }));

    expect(() => merge(finalizationPlans(), true)).toThrow(/Community Testimony UID mismatch/);
    expect(readArtifact().schemas.communityTestimonySchemaUID).toBeUndefined();
  });

  it("refuses a finalization side file with no UID in it", () => {
    fs.writeFileSync(finalPath, JSON.stringify({ somethingElse: true }));

    expect(() => merge(finalizationPlans(), true)).toThrow(/missing communityTestimonySchemaUID/);
  });

  it("writes the canonical UID once the broadcast's own record agrees", () => {
    fs.writeFileSync(finalPath, JSON.stringify({ communityTestimonySchemaUID: TESTIMONY_UID }));

    merge(finalizationPlans(), true);

    expect(readArtifact().schemas.communityTestimonySchemaUID).toBe(TESTIMONY_UID);
  });

  it("compares the two UIDs without regard to hex casing", () => {
    fs.writeFileSync(
      finalPath,
      JSON.stringify({ communityTestimonySchemaUID: TESTIMONY_UID.toUpperCase().replace("0X", "0x") }),
    );

    expect(() => merge(finalizationPlans(), true)).not.toThrow();
  });

  it("names the missing artifact rather than throwing a bare parse error", () => {
    fs.rmSync(mainPath);

    expect(() => merge(preparationPlans, false)).toThrow(/Main deployment file not found/);
  });

  it("refuses a release broadcast before RPC when its reviewed boundary evidence is missing", async () => {
    await expect(
      deployer.deployCommitmentSchemas({
        network: "arbitrum",
        broadcast: true,
        transactionPlan: false,
      } as ParsedOptions),
    ).rejects.toThrow(/requires --artifact <reviewed-plan>, --step, --expected-nonce, and --sender/);
  });
});

describe("CommitmentSchemasDeployer reviewed boundary evidence", () => {
  const SENDER = `0x${"10".repeat(20)}`;
  const REGISTRY = `0x${"20".repeat(20)}`;
  const FACTORY = `0x${"30".repeat(20)}`;
  const RESOLVER = `0x${"40".repeat(20)}`;
  const RESOLVER_IMPL = `0x${"50".repeat(20)}`;
  const ASSESSMENT_RESOLVER = `0x${"60".repeat(20)}`;
  const IMPLEMENTATION_SALT = `0x${"70".repeat(32)}`;
  const PROXY_SALT = `0x${"80".repeat(32)}`;
  const IMPLEMENTATION_INIT_CODE = "0x60006000";
  const PROXY_INIT_CODE = "0x60016001";
  const ASSESSMENT_UID = `0x${"11".repeat(32)}`;
  const TESTIMONY_UID = `0x${"22".repeat(32)}`;
  const schemaInterface = new Interface(["function register(string schema,address resolver,bool revocable)"]);
  const testimonyInterface = new Interface(["function setSchemaUID(bytes32 uid)"]);

  function fixture(): { plan: PersistedSchemaPlan; expected: FrozenSchemaPlanInputs } {
    const schemas = [
      {
        key: "assessmentV3",
        uid: ASSESSMENT_UID,
        schema: "uint256 commitmentId",
        resolver: ASSESSMENT_RESOLVER,
        revocable: false,
        name: "Assessment v3",
        description: "canonical fixture",
      },
    ];
    const expected: FrozenSchemaPlanInputs = {
      releaseId: "review-fixture",
      manifestHash: `0x${"aa".repeat(32)}`,
      sourceCommit: "b".repeat(40),
      mode: "preparation",
      network: "arbitrum",
      chainId: 42161,
      sender: SENDER,
      schemaRegistry: REGISTRY,
      testimonyResolver: RESOLVER,
      testimonyResolverImpl: RESOLVER_IMPL,
      commitmentPoolingModule: null,
      pinnedCommunityTestimonyUID: TESTIMONY_UID,
      create2: {
        factory: FACTORY,
        implementationSalt: IMPLEMENTATION_SALT,
        proxySalt: PROXY_SALT,
        implementationCreationCodeHash: keccak256(IMPLEMENTATION_INIT_CODE),
        proxyCreationCodeHash: keccak256(PROXY_INIT_CODE),
      },
      schemas,
    };
    const plan: PersistedSchemaPlan = {
      schemaVersion: 1,
      releaseId: expected.releaseId,
      manifestHash: expected.manifestHash,
      sourceCommit: expected.sourceCommit,
      mode: expected.mode,
      network: expected.network,
      chainId: expected.chainId,
      sender: expected.sender,
      expectedNonce: 30,
      schemaRegistry: expected.schemaRegistry,
      testimonyResolver: expected.testimonyResolver,
      testimonyResolverImpl: expected.testimonyResolverImpl,
      commitmentPoolingModule: null,
      pinnedCommunityTestimonyUID: TESTIMONY_UID,
      schemas,
      transactions: [
        {
          index: 1,
          from: SENDER,
          to: FACTORY,
          nonce: 30,
          data: `${IMPLEMENTATION_SALT}${IMPLEMENTATION_INIT_CODE.slice(2)}`,
          value: "0x0",
          kind: "CREATE2_IMPLEMENTATION",
          expectedAddress: RESOLVER_IMPL,
          resumableState: SCHEMA_RESUMABLE_STATE,
        },
        {
          index: 2,
          from: SENDER,
          to: FACTORY,
          nonce: 31,
          data: `${PROXY_SALT}${PROXY_INIT_CODE.slice(2)}`,
          value: "0x0",
          kind: "CREATE2_PROXY",
          expectedAddress: RESOLVER,
          resumableState: SCHEMA_RESUMABLE_STATE,
        },
        {
          index: 3,
          from: SENDER,
          to: REGISTRY,
          nonce: 32,
          data: schemaInterface.encodeFunctionData("register", [
            schemas[0].schema,
            schemas[0].resolver,
            schemas[0].revocable,
          ]),
          value: "0x0",
          kind: "REGISTER_SCHEMA",
          expectedUID: ASSESSMENT_UID,
          resumableState: SCHEMA_RESUMABLE_STATE,
        },
        {
          index: 4,
          from: SENDER,
          to: RESOLVER,
          nonce: 33,
          data: testimonyInterface.encodeFunctionData("setSchemaUID", [TESTIMONY_UID]),
          value: "0x0",
          kind: "PIN_UID",
          expectedUID: TESTIMONY_UID,
          resumableState: SCHEMA_RESUMABLE_STATE,
        },
      ],
      transactionBoundaryRule: SCHEMA_TRANSACTION_BOUNDARY_RULE,
      canonicalArtifactMutation: false,
    };
    return { plan, expected };
  }

  it("re-derives every schema definition, identity, and transaction before authorization", () => {
    const { plan, expected } = fixture();
    expect(() => validateReviewedSchemaPlan(plan, expected)).not.toThrow();

    const tampered = structuredClone(plan);
    tampered.transactions[2].data = "0x1234";
    expect(() => validateReviewedSchemaPlan(tampered, expected)).toThrow(/canonical registration/);
  });

  it("requires one receipt-backed contiguous checkpoint prefix", () => {
    const { plan } = fixture();
    const evidence = (step: number): SchemaCheckpoint["completed"][number] => ({
      step,
      transactionHash: `0x${String(step).padStart(64, "0")}`,
      blockNumber: 100 + step,
      verifiedAt: "2026-08-12T00:00:00.000Z",
    });
    const valid: SchemaCheckpoint = {
      schemaVersion: 1,
      planHash: `0x${"99".repeat(32)}`,
      completed: [evidence(1), evidence(2)],
    };
    expect(() => validateSchemaCheckpointPrefix(valid, plan, 3)).not.toThrow();

    const truncated = { ...valid, completed: [evidence(2)] };
    expect(() => validateSchemaCheckpointPrefix(truncated, plan, 3)).toThrow(/contiguous verified prefix/);
  });

  it("rejects a recovery receipt carrying value outside the reviewed boundary", () => {
    const { plan } = fixture();
    const boundary = plan.transactions[0];
    expect(() =>
      validateSchemaReceiptTransaction(
        {
          from: plan.sender,
          to: boundary.to,
          data: boundary.data,
          nonce: boundary.nonce,
          value: 1n,
        },
        plan,
        boundary,
        `0x${"77".repeat(32)}`,
      ),
    ).toThrow(/differs from the reviewed boundary/);
  });
});
