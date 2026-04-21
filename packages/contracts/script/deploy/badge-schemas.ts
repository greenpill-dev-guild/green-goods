import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Interface, ZeroAddress } from "ethers";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { assertSepoliaGate } from "../utils/release-gate";

interface BadgeDeployDependencies {
  networkManager: NetworkManager;
  deploymentAddresses: DeploymentAddresses;
}

interface BadgeSchemaArtifact {
  schemaRegistry: string;
  schemaUID: string;
  schema: string;
  name: string;
  description: string;
  revocable: boolean;
}

const GREEN_GOODS_BADGE_SCHEMA = "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier";
const GREEN_GOODS_BADGE_NAME = "GreenGoodsBadge";
const GREEN_GOODS_BADGE_DESCRIPTION = "Shared EAS schema for GreenWill reputation badges";
const REVOCABLE = true;

const schemaRegistryInterface = new Interface([
  "function register(string schema,address resolver,bool revocable) returns (bytes32 uid)",
]);

export class BadgeSchemasDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployBadgeSchemas(options: ParsedOptions): Promise<void> {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const schemaRegistry = this.resolveSchemaRegistry(options.network);
    const registerCalldata = schemaRegistryInterface.encodeFunctionData("register", [
      GREEN_GOODS_BADGE_SCHEMA,
      ZeroAddress,
      REVOCABLE,
    ]);

    console.log(
      `${options.broadcast ? "Deploying" : "Planning"} GreenWill badge schema registration for ${options.network}`,
    );

    if (options.broadcast) {
      this.broadcastBadgeSchema(options, networkConfig.chainId.toString(), schemaRegistry);
      return;
    }

    console.log("\nDRY RUN - no transactions will be sent");
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);
    console.log(`SchemaRegistry: ${schemaRegistry}`);
    console.log("Method: register(string,address,bool)");
    console.log(`schema: ${GREEN_GOODS_BADGE_SCHEMA}`);
    console.log(`resolver: ${ZeroAddress}`);
    console.log(`revocable: ${REVOCABLE}`);
    console.log(`registerCalldata: ${registerCalldata}`);
    console.log("schemaUID: <returned by SchemaRegistry.register on broadcast>");
    console.log("\nBadge IDs using this shared schema:");
    console.log("  - verified-gardener");
    console.log("  - active-contributor");
    console.log("  - stewardship");
    console.log("  - garden-operator");
    console.log("  - community-builder");
    console.log("  - impact-verified");
    console.log("\nBadge schema dry-run plan complete.");
  }

  private broadcastBadgeSchema(options: ParsedOptions, chainId: string, schemaRegistry: string): void {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployBadgeSchema.s.sol:DeployBadgeSchema",
      "--chain-id",
      chainId,
      "--rpc-url",
      rpcUrl,
    ];
    args.push("--broadcast");

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    args.push("--account", keystoreName);

    const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
    if (senderAddress) {
      args.push("--sender", senderAddress);
    }

    console.log(`\nUsing Foundry keystore: ${keystoreName === "green-goods-deployer" ? keystoreName : "[custom]"}`);
    console.log("Password will be prompted interactively");
    console.log(`SchemaRegistry: ${schemaRegistry}`);
    console.log("\nExecuting badge schema registration...");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    try {
      execFileSync("forge", args, {
        stdio: "inherit",
        env: {
          ...process.env,
          FOUNDRY_PROFILE: "production",
          FORGE_BROADCAST: "true",
        },
        cwd: path.join(__dirname, "../.."),
      });

      this.mergeIntoDeployment(chainId);
      console.log("\nBadge schema registered successfully!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\nBadge schema registration failed:", errorMsg);
      process.exit(1);
    }
  }

  private mergeIntoDeployment(chainId: string): void {
    const deploymentsDir = path.join(__dirname, "../../deployments");
    const badgeSchemaResultPath = path.join(deploymentsDir, `${chainId}-badge-schema.json`);
    const mainDeploymentPath = path.join(deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(badgeSchemaResultPath)) {
      throw new Error(`Badge schema result file not found: ${badgeSchemaResultPath}`);
    }
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(badgeSchemaResultPath, "utf8")) as Partial<BadgeSchemaArtifact>;
    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;
    const existingSchemas =
      typeof deployment.schemas === "object" && deployment.schemas !== null
        ? (deployment.schemas as Record<string, unknown>)
        : {};

    if (
      typeof artifact.schemaUID !== "string" ||
      typeof artifact.schema !== "string" ||
      typeof artifact.name !== "string" ||
      typeof artifact.description !== "string"
    ) {
      throw new Error("Badge schema artifact is missing required schema metadata");
    }

    deployment.schemas = {
      ...existingSchemas,
      greenGoodsBadgeSchemaUID: artifact.schemaUID,
      greenGoodsBadgeSchema: artifact.schema,
      greenGoodsBadgeName: artifact.name,
      greenGoodsBadgeDescription: artifact.description,
    };

    fs.writeFileSync(mainDeploymentPath, JSON.stringify(deployment, null, 2) + "\n");
    fs.unlinkSync(badgeSchemaResultPath);

    console.log(`\nMerged GreenWill badge schema into ${path.basename(mainDeploymentPath)}`);
    console.log(`  UID: ${artifact.schemaUID}`);
  }

  private resolveSchemaRegistry(network: string): string {
    const deployment = this.deploymentAddresses.loadForChain(network) as Record<string, unknown>;
    const easDeployment = deployment.eas;

    if (
      typeof easDeployment === "object" &&
      easDeployment !== null &&
      typeof (easDeployment as { schemaRegistry?: unknown }).schemaRegistry === "string"
    ) {
      return (easDeployment as { schemaRegistry: string }).schemaRegistry;
    }

    if (typeof deployment.easSchemaRegistry === "string") {
      return deployment.easSchemaRegistry;
    }

    const networkConfig = this.networkManager.getNetwork(network);
    const schemaRegistry = networkConfig.contracts?.easSchemaRegistry;
    if (schemaRegistry) {
      return schemaRegistry;
    }

    throw new Error(
      `Missing EAS schema registry address: eas.schemaRegistry deployment key or contracts.easSchemaRegistry network key for network ${network}`,
    );
  }
}

export async function deployBadgeSchemas(options: ParsedOptions, dependencies: BadgeDeployDependencies): Promise<void> {
  const deployer = new BadgeSchemasDeployer(dependencies.networkManager, dependencies.deploymentAddresses);
  await deployer.deployBadgeSchemas(options);
}

export default deployBadgeSchemas;
