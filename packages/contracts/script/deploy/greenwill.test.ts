import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { GreenWillDeployer } from "./greenwill";

const ADDRESS = {
  accountProxy: "0x0000000000000000000000000000000000001001",
  actionRegistry: "0x0000000000000000000000000000000000001002",
  deploymentRegistry: "0x0000000000000000000000000000000000001003",
  gardenAccountImpl: "0x0000000000000000000000000000000000001004",
  gardenToken: "0x0000000000000000000000000000000000001005",
  hatsModule: "0x0000000000000000000000000000000000001006",
  eas: "0x0000000000000000000000000000000000001007",
  octantModule: "0x0000000000000000000000000000000000001008",
  owner: "0x0000000000000000000000000000000000001009",
  genesisLock: "0x0000000000000000000000000000000000001010",
  firstWorkLock: "0x0000000000000000000000000000000000001011",
  firstSupportLock: "0x0000000000000000000000000000000000001012",
  implementation: "0x0000000000000000000000000000000000001013",
  greenWill: "0x0000000000000000000000000000000000001014",
  deployer: "0x0000000000000000000000000000000000001015",
};

const WORK_SCHEMA_UID = `0x${"1".repeat(64)}`;
const GENESIS_HAT_ID = "0x0000005c00020002000000000000000000000000000000000000000000000000";

function options(overrides: Partial<ParsedOptions> = {}): ParsedOptions {
  return {
    network: "arbitrum",
    broadcast: false,
    saveArtifacts: false,
    verify: true,
    updateSchemasOnly: false,
    force: false,
    dryRun: true,
    pureSimulation: false,
    skipEnvio: false,
    skipVerification: false,
    startIndexer: false,
    saveReport: false,
    overrideSepoliaGate: false,
    ...overrides,
  };
}

function writeDeployment(dir: string, overrides: Record<string, unknown> = {}): void {
  const deployment = {
    accountProxy: ADDRESS.accountProxy,
    actionRegistry: ADDRESS.actionRegistry,
    deploymentRegistry: ADDRESS.deploymentRegistry,
    gardenAccountImpl: ADDRESS.gardenAccountImpl,
    gardenToken: ADDRESS.gardenToken,
    hatsModule: ADDRESS.hatsModule,
    eas: { address: ADDRESS.eas, schemaRegistry: "0x0000000000000000000000000000000000001015" },
    schemas: { workSchemaUID: WORK_SCHEMA_UID },
    octantModule: ADDRESS.octantModule,
    greenWillConfig: {
      owner: ADDRESS.owner,
      deployer: ADDRESS.deployer,
      genesisHatId: "42",
    },
    unlock: {
      locks: {
        genesis: { address: ADDRESS.genesisLock },
        firstWork: { address: ADDRESS.firstWorkLock },
        firstSupport: { address: ADDRESS.firstSupportLock },
      },
    },
    ...overrides,
  };

  fs.writeFileSync(path.join(dir, "42161-latest.json"), JSON.stringify(deployment, null, 2));
}

describe("GreenWillDeployer", () => {
  let tmpDir: string;
  let deployer: GreenWillDeployer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "greenwill-deploy-"));
    writeDeployment(tmpDir);
    deployer = new GreenWillDeployer(undefined, new DeploymentAddresses(tmpDir), tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires a configured final owner", () => {
    writeDeployment(tmpDir, { greenWillConfig: { deployer: ADDRESS.deployer, genesisHatId: "42" } });

    expect(() => deployer.buildDeploymentPlan(options())).toThrow(/greenWillConfig\.owner/);
  });

  it("requires a non-zero Genesis Hats role id", () => {
    writeDeployment(tmpDir, {
      greenWillConfig: { owner: ADDRESS.owner, deployer: ADDRESS.deployer, genesisHatId: "0" },
    });

    expect(() => deployer.buildDeploymentPlan(options())).toThrow(/greater than zero/);
  });

  it("fails closed when badge locks are missing from artifacts and overrides", () => {
    writeDeployment(tmpDir, { unlock: { locks: {} } });

    expect(() => deployer.buildDeploymentPlan(options())).toThrow(/unlock\.locks\.genesis\.address/);
  });

  it("fails closed when EAS address config is zero", () => {
    writeDeployment(tmpDir, { eas: { address: "0x0000000000000000000000000000000000000000" } });

    expect(() => deployer.buildDeploymentPlan(options())).toThrow(/non-zero address for eas\.address/);
  });

  it("fails closed when work schema config is zero", () => {
    writeDeployment(tmpDir, { schemas: { workSchemaUID: `0x${"0".repeat(64)}` } });

    expect(() => deployer.buildDeploymentPlan(options())).toThrow(/non-zero bytes32 for schemas\.workSchemaUID/);
  });

  it("builds a three-badge plan from the deployment artifact", () => {
    const plan = deployer.buildDeploymentPlan(options());

    expect(plan.owner).toBe("0x0000000000000000000000000000000000001009");
    expect(plan.deployer).toBe("0x0000000000000000000000000000000000001015");
    expect(plan.genesisHatId).toBe("42");
    expect(Object.keys(plan.badges)).toEqual(["genesis", "firstWork", "firstSupport"]);
    expect(plan.badges.genesis.rule).toBe("Hat");
    expect(plan.badges.firstWork.rule).toBe("WorkAttestation");
    expect(plan.badges.firstWork.criteria).toBe(WORK_SCHEMA_UID.toLowerCase());
    expect(plan.badges.firstSupport.rule).toBe("VaultShares");
  });

  it("accepts the production Genesis Hats role id in hex form", () => {
    writeDeployment(tmpDir, {
      greenWillConfig: {
        owner: ADDRESS.owner,
        deployer: ADDRESS.deployer,
        genesisHatId: GENESIS_HAT_ID,
      },
    });

    const plan = deployer.buildDeploymentPlan(options());

    expect(plan.genesisHatId).toBe(BigInt(GENESIS_HAT_ID).toString());
    expect(plan.badges.genesis.criteria).toBe(GENESIS_HAT_ID.toLowerCase());
  });

  it("merges the broadcast artifact into the deployment file", () => {
    const plan = deployer.buildDeploymentPlan(options());
    fs.writeFileSync(
      path.join(tmpDir, "42161-greenwill.json"),
      JSON.stringify(
        {
          greenWill: ADDRESS.greenWill,
          greenWillImplementation: ADDRESS.implementation,
          owner: ADDRESS.owner,
          deployer: ADDRESS.owner,
          deploymentRegistry: ADDRESS.deploymentRegistry,
        },
        null,
        2,
      ),
    );

    deployer.mergeIntoDeployment("42161", plan);

    const deployment = JSON.parse(fs.readFileSync(path.join(tmpDir, "42161-latest.json"), "utf8"));
    expect(deployment.greenWill).toBe("0x0000000000000000000000000000000000001014");
    expect(deployment.greenWillBadges.owner).toBe("0x0000000000000000000000000000000000001009");
    expect(deployment.greenWillBadges.badges.genesis.unlockLock).toBe(ADDRESS.genesisLock);
    expect(fs.existsSync(path.join(tmpDir, "42161-greenwill.json"))).toBe(false);
  });
});
