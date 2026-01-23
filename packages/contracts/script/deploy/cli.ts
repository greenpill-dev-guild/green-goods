#!/usr/bin/env bun

import { CliParser } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { CoreDeployer } from "./core";
import { GardenDeployer } from "./gardens";
import { ActionDeployer } from "./actions";
import { AnvilManager } from "./anvil";

/**
 * DeploymentCLI - Main command-line interface for deployments
 *
 * Refactored from monolithic deploy.js into modular structure
 */
export class DeploymentCLI {
  private parser: CliParser;
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;
  private coreDeployer: CoreDeployer;
  private gardenDeployer: GardenDeployer;
  private actionDeployer: ActionDeployer;
  private anvilManager: AnvilManager;

  constructor() {
    this.parser = new CliParser();
    this.networkManager = new NetworkManager();
    this.deploymentAddresses = new DeploymentAddresses();
    this.coreDeployer = new CoreDeployer();
    this.gardenDeployer = new GardenDeployer();
    this.actionDeployer = new ActionDeployer();
    this.anvilManager = new AnvilManager();
  }

  /**
   * Show help message
   */
  showHelp(): void {
    console.log(`
Green Goods Deployment CLI

Usage: bun deploy.ts <command> [options]

Commands:
  core                     Deploy core contracts
  garden <config.json>     Deploy garden from config file
  actions <config.json>    Deploy actions from config file
  status [network]         Check deployment status
  fork <network>           Start Anvil fork for network

Common Options:
  --network, -n <network>  Network to deploy to (default: localhost)
  --broadcast, -b          Broadcast transactions
  --update-schemas         Only update schemas, skip existing contracts
  --force                  Force fresh deployment
  --dry-run                Validate config without deploying
  --help, -h               Show this help

Examples:
  # Fresh deployment
  bun deploy.ts core --network baseSepolia --broadcast
  
  # Update schemas only
  bun deploy.ts core --network baseSepolia --broadcast --update-schemas
  
  # Deploy garden
  bun deploy.ts garden config/my-garden.json --network arbitrum --broadcast
  
  # Deploy actions
  bun deploy.ts actions config/my-actions.json --network arbitrum --broadcast

Available networks: ${this.networkManager.getAvailableNetworks().join(", ")}

Note: Contracts are automatically verified on all networks except localhost.
For UUPS upgrades, use: bun upgrade.ts <contract> --network <network> --broadcast
    `);
  }

  /**
   * Check deployment status for a network
   * @param network - Network name (null for all networks)
   */
  async checkDeploymentStatus(network: string | null): Promise<void> {
    console.log("🚀 Green Goods Deployment Status\n");

    if (network) {
      try {
        const addresses = this.deploymentAddresses.loadForChain(network);
        const networkConfig = this.deploymentAddresses.getNetworkConfig(network);
        const communityToken = this.deploymentAddresses.getCommunityToken(network);

        console.log(`✅ Chain ${network} (${networkConfig.name})`);
        console.log(`   Garden Token: ${addresses.gardenToken}`);
        console.log(`   Action Registry: ${addresses.actionRegistry}`);
        console.log(`   Community Token: ${communityToken}`);
        console.log(`   Deployment Registry: ${addresses.deploymentRegistry}`);
        console.log(`   Gardener Account Logic: ${addresses.gardenerAccountLogic}`);
        console.log(`   Work Resolver: ${addresses.workResolver}`);
        console.log(`   Work Approval Resolver: ${addresses.workApprovalResolver}`);
        console.log(`   Assessment Resolver: ${addresses.assessmentResolver}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`❌ ${network}: ${errorMsg}`);
      }
    } else {
      // List all networks
      const networks = ["localhost", "arbitrum", "baseSepolia", "celo"];

      for (const net of networks) {
        try {
          this.deploymentAddresses.loadForChain(net);
          console.log(`✅ ${net} - Contracts deployed`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`❌ ${net} - ${errorMsg}`);
        }
      }
    }
  }

  /**
   * Main execution function
   * @param args - Command line arguments
   */
  async run(args: string[]): Promise<void> {
    // Get command
    const command = this.parser.getCommand(args);

    // Check for help
    if (args.includes("--help") || args.includes("-h") || !command) {
      this.showHelp();
      return;
    }

    // Parse options
    const options = this.parser.parseOptions(args);

    if (options.error) {
      console.error(`❌ ${options.error}`);
      this.showHelp();
      process.exit(1);
    }

    try {
      switch (command) {
        case "core":
          await this.coreDeployer.deployCoreContracts(options);
          break;

        case "garden": {
          const gardenConfigPath = this.parser.getPositionalArg(args, 1);
          if (!gardenConfigPath) {
            console.error("❌ Garden config file required");
            process.exit(1);
          }
          await this.gardenDeployer.deployGarden(gardenConfigPath, options);
          break;
        }

        case "actions": {
          const actionsConfigPath = this.parser.getPositionalArg(args, 1);
          if (!actionsConfigPath) {
            console.error("❌ Actions config file required");
            process.exit(1);
          }
          await this.actionDeployer.deployActions(actionsConfigPath, options);
          break;
        }

        case "status": {
          const networkArg = this.parser.getPositionalArg(args, 1);
          await this.checkDeploymentStatus(networkArg);
          break;
        }

        case "fork": {
          const forkNetwork = this.parser.getPositionalArg(args, 1);
          if (!forkNetwork) {
            console.error("❌ Network required for fork");
            process.exit(1);
          }
          await this.anvilManager.startFork(forkNetwork);
          break;
        }

        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Error:", errorMsg);
      process.exit(1);
    }
  }
}

// Main execution
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.ts");
if (isMain) {
  const cli = new DeploymentCLI();
  cli.run(process.argv).catch(console.error);
}
