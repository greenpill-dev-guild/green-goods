#!/usr/bin/env bun

import { CliParser } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { CoreDeployer } from "./core";
import { GardenDeployer } from "./gardens";
import { ActionDeployer } from "./actions";
import { AnvilManager } from "./anvil";
import { HatsTreeDeployer } from "./hats";
import { GoodsDeployer } from "./goods";
import { OctantFactoryDeployer } from "./octant-factory";

/**
 * DeploymentCLI - Main command-line interface for deployments
 *
 * Refactored from monolithic deploy.js into modular structure.
 * Shared dependencies (NetworkManager, AnvilManager, DeploymentAddresses) are
 * constructed once and injected into all deployers to avoid redundant file reads
 * and ensure consistent configuration.
 */
export class DeploymentCLI {
  private parser: CliParser;
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;
  private coreDeployer: CoreDeployer;
  private gardenDeployer: GardenDeployer;
  private actionDeployer: ActionDeployer;
  private anvilManager: AnvilManager;
  private hatsTreeDeployer: HatsTreeDeployer;
  private goodsDeployer: GoodsDeployer;
  private octantFactoryDeployer: OctantFactoryDeployer;

  constructor() {
    this.parser = new CliParser();

    // Shared dependencies — single instance each
    this.networkManager = new NetworkManager();
    this.anvilManager = new AnvilManager(this.networkManager);
    this.deploymentAddresses = new DeploymentAddresses();

    // Inject shared dependencies into deployers
    this.coreDeployer = new CoreDeployer(this.networkManager, this.anvilManager);
    this.gardenDeployer = new GardenDeployer(this.networkManager, this.anvilManager, this.deploymentAddresses);
    this.actionDeployer = new ActionDeployer(this.networkManager, this.anvilManager, this.deploymentAddresses);
    this.hatsTreeDeployer = new HatsTreeDeployer(this.networkManager, this.deploymentAddresses);
    this.goodsDeployer = new GoodsDeployer(this.networkManager, this.anvilManager);
    this.octantFactoryDeployer = new OctantFactoryDeployer(this.networkManager, this.anvilManager);
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
  goods                    Deploy GOODS Juicebox project (requires env vars)
  juicebox                 Alias for `goods` deployment
  octant-factory           Deploy Octant vault factory (auto-updates deployment JSON)
  garden <config.json>     Deploy garden from config file
  actions <config.json>    Deploy actions from config file
  hats-tree                Create and configure the Hats protocol tree
  status [network]         Check deployment status
  fork <network>           Start Anvil fork for network

Common Options:
  --network, -n <network>  Network to deploy to (default: localhost)
  --broadcast, -b          Broadcast transactions
  --update-schemas         Only update schemas, skip existing contracts
  --force                  Force fresh deployment
  --dry-run                Validate config without deploying
  --pure-simulation        Run compile + config preflight only (no RPC calls)
  --salt <value>           Override deployment salt string for CREATE2
  --override-sepolia-gate  Bypass Sepolia gate for Arbitrum/Celo broadcast
  --help, -h               Show this help

Examples:
  # Fresh deployment
  bun deploy.ts core --network sepolia --broadcast
  
  # Update schemas only
  bun deploy.ts core --network sepolia --broadcast --update-schemas
  
  # Deploy garden
  bun deploy.ts garden config/my-garden.json --network arbitrum --broadcast
  
  # Deploy actions
  bun deploy.ts actions config/my-actions.json --network arbitrum --broadcast

  # Deploy Octant vault factory
  bun deploy.ts octant-factory --network arbitrum --broadcast

  # Create Hats tree
  bun deploy.ts hats-tree --network sepolia --broadcast

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
        console.log(`   Garden Account Impl: ${addresses.gardenAccountImpl}`);
        console.log(`   Work Resolver: ${addresses.workResolver}`);
        console.log(`   Work Approval Resolver: ${addresses.workApprovalResolver}`);
        console.log(`   Assessment Resolver: ${addresses.assessmentResolver}`);
        console.log(`   Octant Module: ${addresses.octantModule || "not deployed"}`);
        console.log(`   Octant Factory: ${addresses.octantFactory || "not deployed"}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`❌ ${network}: ${errorMsg}`);
      }
    } else {
      // List all networks
      const networks = ["localhost", "arbitrum", "celo", "sepolia"];

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

        case "goods":
        case "juicebox":
          await this.goodsDeployer.deployGoods(options);
          break;

        case "octant-factory":
          await this.octantFactoryDeployer.deployOctantFactory(options);
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

        case "hats-tree": {
          await this.hatsTreeDeployer.setupHatsTree(options);
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
