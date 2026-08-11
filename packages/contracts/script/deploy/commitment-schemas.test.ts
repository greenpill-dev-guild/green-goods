import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ParsedOptions } from "../utils/cli-parser";
import type { SchemaRegistrationPlan } from "../utils/pooling-release";
import { CommitmentSchemasDeployer } from "./commitment-schemas";

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
