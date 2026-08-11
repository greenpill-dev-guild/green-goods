import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { POOLING_UPGRADE_KEYS } from "../utils/pooling-release";
import { assertSepoliaGate } from "../utils/release-gate";

const CONTRACTS_ROOT = path.join(__dirname, "../..");

/**
 * Dependencies the module needs wired before it can be unpaused. Read here as well as in the
 * Foundry script so a dry run reports the exact missing key instead of reverting inside a
 * simulation the operator then has to decode.
 */
const REQUIRED_ADDRESS_KEYS = [
  "guardian",
  "gardenToken",
  "hatsModule",
  "actionRegistry",
  "workApprovalResolver",
] as const;

/** Dependencies the artifact nests under their own object rather than a flat key. */
const REQUIRED_NESTED_ADDRESSES = [
  { label: "rootGarden.address", parent: "rootGarden", child: "address" },
  { label: "eas.address", parent: "eas", child: "address" },
] as const;

const REQUIRED_SCHEMA_KEYS = [
  "workSchemaUID",
  "workApprovalSchemaUID",
  "assessmentSchemaUID",
  "assessmentV3SchemaUID",
] as const;

function isZeroOrMissing(value: unknown): boolean {
  return typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value);
}

/**
 * Standalone deploy target for the Commitment Pooling control plane. Kept out of the core
 * deployer on purpose: the module depends on core addresses and both assessment schema UIDs
 * already existing, so it is always a later, separately gated step.
 */
export class PoolingDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployPooling(options: ParsedOptions): Promise<void> {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = this.networkManager.getChainIdString(options.network);
    const deployment = this.loadDeployment(options.network);
    const missing = this.findMissingDependencies(deployment);

    console.log(`${options.broadcast ? "Deploying" : "Planning"} Commitment Pooling for ${options.network}`);
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);

    if (missing.length > 0) {
      throw new Error(
        `Commitment Pooling cannot deploy until these deployment keys are non-zero: ${missing.join(", ")}. ` +
          "Deploy core, then register the commitment schemas, then retry.",
      );
    }

    if (!options.broadcast) {
      this.printDryRunPlan(deployment, chainId);
      return;
    }

    this.broadcast(options, chainId);
  }

  private loadDeployment(network: string): Record<string, unknown> {
    return this.deploymentAddresses.loadForChain(network) as Record<string, unknown>;
  }

  private findMissingDependencies(deployment: Record<string, unknown>): string[] {
    const missing: string[] = REQUIRED_ADDRESS_KEYS.filter((key) => isZeroOrMissing(deployment[key]));

    REQUIRED_NESTED_ADDRESSES.forEach(({ label, parent, child }) => {
      const nested = deployment[parent] as Record<string, unknown> | undefined;
      if (isZeroOrMissing(nested?.[child])) missing.push(label);
    });

    const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;
    const missingSchemas = REQUIRED_SCHEMA_KEYS.filter((key) => {
      const value = schemas[key];
      return typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value);
    }).map((key) => `schemas.${key}`);

    return [...missing, ...missingSchemas];
  }

  private printDryRunPlan(deployment: Record<string, unknown>, chainId: string): void {
    const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;
    console.log("\nDRY RUN - no transactions will be sent");
    console.log("Script: script/DeployPooling.s.sol:DeployCommitmentPooling");
    console.log("\nWould deploy two UUPS proxies:");
    console.log("  - CommitmentPoolingModule (initialize(owner, rootGarden), starts paused)");
    console.log("  - CommitmentRegistry (initialize(owner, module))");
    console.log("\nWould wire the module while still paused:");
    console.log(`  owner/guardian:         ${deployment.guardian}`);
    console.log(`  rootGarden:             ${(deployment.rootGarden as { address?: string } | undefined)?.address}`);
    console.log(`  gardenToken:            ${deployment.gardenToken}`);
    console.log(`  hatsModule:             ${deployment.hatsModule}`);
    console.log(`  actionRegistry:         ${deployment.actionRegistry}`);
    console.log(`  workApprovalResolver:   ${deployment.workApprovalResolver}`);
    console.log(`  eas:                    ${(deployment.eas as { address?: string } | undefined)?.address}`);
    console.log(`  work schema:            ${schemas.workSchemaUID}`);
    console.log(`  workApproval schema:    ${schemas.workApprovalSchemaUID}`);
    console.log(`  legacy assessment:      ${schemas.assessmentSchemaUID}`);
    console.log(`  assessment v3 schema:   ${schemas.assessmentV3SchemaUID}`);
    console.log(`\nWould merge ${POOLING_UPGRADE_KEYS.join(", ")} into deployments/${chainId}-latest.json`);
    console.log("\nThe module stays paused after deployment. Unpausing is a separate operator act.");
    console.log("\nPooling dry-run plan complete.");
  }

  private broadcast(options: ParsedOptions, chainId: string): void {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployPooling.s.sol:DeployCommitmentPooling",
      "--chain-id",
      chainId,
      "--rpc-url",
      rpcUrl,
      "--broadcast",
    ];

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    args.push("--account", keystoreName);
    const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
    if (senderAddress) args.push("--sender", senderAddress);

    console.log(`\nUsing Foundry keystore: ${keystoreName}`);
    console.log("Password will be prompted interactively");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production", FORGE_BROADCAST: "true" },
    });

    this.mergeIntoDeployment(chainId);
    console.log("\nCommitment Pooling deployed. The module is still paused.");
  }

  /**
   * Append-only merge. The Foundry script writes a side file; this promotes it into the canonical
   * artifact and removes it, so a crash between the two leaves a recoverable side file rather
   * than a half-written deployment record.
   */
  private mergeIntoDeployment(chainId: string): void {
    const deploymentsDir = path.join(CONTRACTS_ROOT, "deployments");
    const poolingResultPath = path.join(deploymentsDir, `${chainId}-pooling.json`);
    const mainDeploymentPath = path.join(deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(poolingResultPath)) {
      throw new Error(`Pooling deployment result not found: ${poolingResultPath}`);
    }
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const result = JSON.parse(fs.readFileSync(poolingResultPath, "utf8")) as Record<string, unknown>;
    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;

    POOLING_UPGRADE_KEYS.forEach((key) => {
      if (isZeroOrMissing(result[key])) {
        throw new Error(`Pooling deployment result is missing ${key}`);
      }
      deployment[key] = result[key];
    });

    fs.writeFileSync(mainDeploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
    fs.unlinkSync(poolingResultPath);

    console.log(`\nMerged pooling addresses into ${path.basename(mainDeploymentPath)}`);
    POOLING_UPGRADE_KEYS.forEach((key) => console.log(`  ${key}: ${deployment[key]}`));
  }
}
