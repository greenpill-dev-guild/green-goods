#!/usr/bin/env node

const { CliParser } = require("../utils/cli-parser");
const { NetworkManager } = require("../utils/network");
const { DeploymentAddresses } = require("../utils/deployment-addresses");
const { CoreDeployer } = require("./core");
const { GardenDeployer } = require("./gardens");
const { ActionDeployer } = require("./actions");
const { AnvilManager } = require("./anvil");

/**
 * DeploymentCLI - Main command-line interface for deployments
 *
 * Refactored from monolithic deploy.js into modular structure
 */
class DeploymentCLI {
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
  showHelp() {
    console.log(`
Green Goods Deployment CLI

Usage: node deploy.js <command> [options]

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
  node deploy.js core --network baseSepolia --broadcast
  
  # Update schemas only
  node deploy.js core --network baseSepolia --broadcast --update-schemas
  
  # Deploy garden
  node deploy.js garden config/my-garden.json --network arbitrum --broadcast
  
  # Deploy actions
  node deploy.js actions config/my-actions.json --network arbitrum --broadcast

Available networks: ${this.networkManager.getAvailableNetworks().join(", ")}

Note: Contracts are automatically verified on all networks except localhost.
For UUPS upgrades, use: bun run upgrade <contract> --network <network> --broadcast
    `);
  }

  /**
   * Check deployment status for a network
   * @param {string|null} network - Network name (null for all networks)
   */
  async checkDeploymentStatus(network) {
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
        console.log(`❌ ${network}: ${error.message}`);
      }
    } else {
      // List all networks
      const networks = ["localhost", "arbitrum", "baseSepolia", "celo"];

      for (const net of networks) {
        try {
          this.deploymentAddresses.loadForChain(net);
          console.log(`✅ ${net} - Contracts deployed`);
        } catch (error) {
          console.log(`❌ ${net} - ${error.message}`);
        }
      }
    }
  }

  /**
   * Main execution function
   * @param {string[]} args - Command line arguments
   */
  async run(args) {
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
          const configPath = this.parser.getPositionalArg(args, 1);
          if (!configPath) {
            console.error("❌ Garden config file required");
            process.exit(1);
          }
          await this.gardenDeployer.deployGarden(configPath, options);
          break;
        }

        case "actions": {
          const configPath = this.parser.getPositionalArg(args, 1);
          if (!configPath) {
            console.error("❌ Actions config file required");
            process.exit(1);
          }
          await this.actionDeployer.deployActions(configPath, options);
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
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new DeploymentCLI();
  cli.run(process.argv).catch(console.error);
}

module.exports = { DeploymentCLI };
