import { Interface, ZeroAddress } from "ethers";
import type { ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";

interface BadgeDeployDependencies {
  networkManager: NetworkManager;
  deploymentAddresses: DeploymentAddresses;
}

const GREEN_GOODS_BADGE_SCHEMA = "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier";
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
    console.log(`Planning GreenWill badge schema registration for ${options.network}`);

    const networkConfig = this.networkManager.getNetwork(options.network);
    const schemaRegistry = this.resolveSchemaRegistry(options.network);
    const registerCalldata = schemaRegistryInterface.encodeFunctionData("register", [
      GREEN_GOODS_BADGE_SCHEMA,
      ZeroAddress,
      REVOCABLE,
    ]);

    if (options.broadcast) {
      throw new Error(
        "badge-schemas broadcast is blocked: this target is dry-run planning only. " +
          "Before broadcast can be enabled, confirm the attester wallet, wire deployment " +
          "persistence for schemas.greenGoodsBadgeSchemaUID (with sibling " +
          "schemas.greenGoodsBadgeSchema/Name/Description) in deployments/<chainId>-latest.json — " +
          "the same top-level `schemas.*` convention used for workSchemaUID, " +
          "workApprovalSchemaUID, and assessmentSchemaUID — then re-enable this path.",
      );
    }

    console.log("\nDRY RUN - no transactions will be sent (broadcast is blocked)");
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
    console.log("\n[planning-only] Badge schema dry-run plan complete. Broadcast is blocked; see --help.");
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
