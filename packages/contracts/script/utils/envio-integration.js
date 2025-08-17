const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const yaml = require("js-yaml");

class EnvioIntegration {
  constructor() {
    this.contractsDir = path.join(__dirname, "../../deployments");
    this.envioConfigPath = path.join(__dirname, "../../../indexer/config.yaml");
    this.backupConfigPath = path.join(__dirname, "../../../indexer/config.yaml.backup");
    this.watchedFiles = new Map(); // Track file modification times
  }

  /**
   * Auto-update Envio config when deployment files change
   * @param {string[]} chainIds - Chain IDs to monitor (optional, monitors all if empty)
   * @param {boolean} continuous - Whether to watch for continuous changes
   */
  async autoUpdateOnDeployment(chainIds = [], continuous = false) {
    console.log("\n🔄 Setting up auto-update for Envio config...");

    if (continuous) {
      console.log("📡 Watching for deployment file changes...");
      this.startFileWatcher(chainIds);
    } else {
      // Single check for recent deployments
      await this.checkAndUpdateRecentDeployments(chainIds);
    }
  }

  /**
   * Check for recent deployments and update config if needed
   */
  async checkAndUpdateRecentDeployments(chainIds = []) {
    try {
      const deploymentFiles = this.getDeploymentFiles(chainIds);

      for (const filePath of deploymentFiles) {
        const chainId = this.extractChainIdFromFile(filePath);
        const fileStats = fs.statSync(filePath);
        const lastModified = fileStats.mtime;

        // Check if file was modified in the last 5 minutes (deployment just happened)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        if (lastModified > fiveMinutesAgo) {
          console.log(`\n🆕 Recent deployment detected for chain ${chainId}`);
          await this.updateEnvioConfig(chainId, chainId === "31337");
        }
      }
    } catch (error) {
      console.error("❌ Failed to check recent deployments:", error.message);
    }
  }

  /**
   * Start watching deployment files for changes
   */
  startFileWatcher(chainIds = []) {
    const deploymentFiles = this.getDeploymentFiles(chainIds);

    deploymentFiles.forEach((filePath) => {
      // Initialize watched file tracking
      const stats = fs.statSync(filePath);
      this.watchedFiles.set(filePath, stats.mtime);

      // Watch for changes
      fs.watchFile(filePath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          const chainId = this.extractChainIdFromFile(filePath);
          console.log(`\n🔄 Deployment updated for chain ${chainId}`);

          try {
            await this.updateEnvioConfig(chainId, chainId === "31337");
            console.log("✅ Envio config auto-updated successfully");
          } catch (error) {
            console.error("❌ Failed to auto-update Envio config:", error.message);
          }
        }
      });
    });

    console.log(`👀 Watching ${deploymentFiles.length} deployment files for changes`);
    console.log("   Press Ctrl+C to stop watching");
  }

  /**
   * Get all deployment files to monitor
   */
  getDeploymentFiles(chainIds = []) {
    const files = [];

    if (chainIds.length === 0) {
      // Monitor all deployment files
      const allFiles = fs.readdirSync(this.contractsDir);
      const deploymentFiles = allFiles.filter((file) => file.endsWith("-latest.json") && !file.includes("backup"));

      files.push(...deploymentFiles.map((file) => path.join(this.contractsDir, file)));
    } else {
      // Monitor specific chain IDs
      for (const chainId of chainIds) {
        const filePath = path.join(this.contractsDir, `${chainId}-latest.json`);
        if (fs.existsSync(filePath)) {
          files.push(filePath);
        }
      }
    }

    return files;
  }

  /**
   * Extract chain ID from deployment file path
   */
  extractChainIdFromFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName.replace("-latest.json", "");
  }

  /**
   * Update Envio config with deployed contract addresses
   * @param {string} chainId - Chain ID to update config for
   * @param {boolean} useLocalhost - Whether to use localhost RPC
   */
  async updateEnvioConfig(chainId = "31337", useLocalhost = false) {
    try {
      console.log(`\n📝 Updating Envio configuration for chain ${chainId}...`);

      // Load deployment data
      const deploymentFile = path.join(this.contractsDir, `${chainId}-latest.json`);
      if (!fs.existsSync(deploymentFile)) {
        throw new Error(`No deployment found for chain ${chainId}`);
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

      // Validate required addresses
      const requiredAddresses = ["actionRegistry", "gardenToken", "accountProxy"];
      const missingAddresses = requiredAddresses.filter((addr) => !deployment[addr]);

      if (missingAddresses.length > 0) {
        throw new Error(`Missing required addresses: ${missingAddresses.join(", ")}`);
      }

      // Handle local chain config specially
      if (chainId === "31337" || useLocalhost) {
        await this.enableLocalChainConfig();
        await this.updateLocalChainAddresses(deployment);
        console.log("✅ Local chain config updated successfully");
      } else {
        // For non-local deployments, make sure local config is disabled
        await this.disableLocalChainConfig();

        // Continue with regular network config update
        // Backup current config only if it hasn't been backed up recently
        if (fs.existsSync(this.envioConfigPath)) {
          const shouldBackup = !fs.existsSync(this.backupConfigPath) || this.isBackupOld(this.backupConfigPath);

          if (shouldBackup) {
            fs.copyFileSync(this.envioConfigPath, this.backupConfigPath);
            console.log("💾 Backed up existing config");
          }
        }

        // Load current Envio config
        const envioConfig = yaml.load(fs.readFileSync(this.envioConfigPath, "utf8"));

        // Update or add network configuration
        const targetChainId = Number.parseInt(chainId);
        const networkIndex = envioConfig.networks.findIndex((n) => n.id === targetChainId);

        const networkConfig = {
          id: targetChainId,
          start_block: this.getStartBlock(chainId),
          contracts: [
            {
              name: "ActionRegistry",
              address: deployment.actionRegistry,
            },
            {
              name: "GardenToken",
              address: deployment.gardenToken,
            },
            {
              name: "GardenAccount",
              address: deployment.accountProxy,
            },
          ],
        };

        if (networkIndex >= 0) {
          envioConfig.networks[networkIndex] = networkConfig;
          console.log(`🔄 Updated existing network config for chain ${targetChainId}`);
        } else {
          envioConfig.networks.push(networkConfig);
          console.log(`➕ Added new network config for chain ${targetChainId}`);
        }

        // Update RPC configuration
        this.updateRpcConfig(envioConfig, chainId, useLocalhost);

        // Write updated config
        fs.writeFileSync(this.envioConfigPath, yaml.dump(envioConfig, { lineWidth: -1 }));
        console.log("✅ Envio config updated successfully");
      }

      // Display the updated addresses
      console.log(`\n📋 Contract addresses updated in Envio for chain ${chainId}:`);
      console.log(`   ActionRegistry: ${deployment.actionRegistry}`);
      console.log(`   GardenToken: ${deployment.gardenToken}`);
      console.log(`   GardenAccount: ${deployment.accountProxy}`);

      return deployment;
    } catch (error) {
      console.error("❌ Failed to update Envio config:", error.message);
      throw error;
    }
  }

  /**
   * Update RPC configuration based on chain ID
   */
  updateRpcConfig(envioConfig, chainId, useLocalhost) {
    if (!envioConfig.rpc_config) {
      envioConfig.rpc_config = {};
    }

    const rpcConfigs = {
      31337: {
        url: "http://localhost:8545",
      },
      84532: {
        url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
      },
      8453: {
        url: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
      },
      42220: {
        url: `https://celo-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
      },
      44787: {
        url: `https://celo-alfajores.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
      },
      11155111: {
        url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
      },
    };

    if (useLocalhost || chainId === "31337") {
      envioConfig.rpc_config["31337"] = rpcConfigs["31337"];
    } else if (rpcConfigs[chainId]) {
      envioConfig.rpc_config[chainId] = rpcConfigs[chainId];
    }
  }

  /**
   * Get appropriate start block for chain
   */
  getStartBlock(chainId) {
    // For localhost/anvil, start from block 1
    if (chainId === "31337") return 1;

    // For testnets, can start from recent block to speed up sync
    const recentBlocks = {
      84532: 15000000, // Base Sepolia
      44787: 25000000, // Celo Alfajores
      11155111: 5000000, // Ethereum Sepolia
    };

    return recentBlocks[chainId] || 1;
  }

  /**
   * Check if backup is older than 1 hour
   */
  isBackupOld(backupPath) {
    const stats = fs.statSync(backupPath);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return stats.mtime < oneHourAgo;
  }

  /**
   * Start Envio indexer with updated config
   */
  async startIndexer() {
    console.log("\n🚀 Starting Envio indexer...");

    try {
      const indexerDir = path.join(__dirname, "../../../indexer");

      // Stop any existing indexer processes
      try {
        execSync("pkill -f 'envio dev' || true", { stdio: "pipe" });
        console.log("🛑 Stopped existing indexer processes");
      } catch (_e) {
        // Ignore errors if no process found
      }

      // Wait for processes to clean up
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Regenerate code with updated config
      console.log("🔧 Regenerating Envio code...");
      execSync("pnpm codegen", {
        cwd: indexerDir,
        stdio: "inherit",
      });

      // Start indexer in background
      console.log("🏃 Starting indexer in background...");
      const { spawn } = require("node:child_process");
      const indexerProcess = spawn("pnpm", ["dev"], {
        cwd: indexerDir,
        detached: true,
        stdio: "pipe",
      });

      indexerProcess.on("error", (error) => {
        console.error("Failed to start indexer:", error);
      });

      // Wait for indexer to be ready
      console.log("⏳ Waiting for indexer to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log("✅ Indexer started successfully!");
      console.log("   GraphQL endpoint: http://localhost:8080");
      console.log("   Development console: https://envio.dev/console");

      return indexerProcess;
    } catch (error) {
      console.error("❌ Failed to start indexer:", error.message);
      throw error;
    }
  }

  /**
   * Uncomment local chain config for development
   */
  async enableLocalChainConfig() {
    console.log("\n📝 Enabling local chain config for development...");

    try {
      const configContent = fs.readFileSync(this.envioConfigPath, "utf8");

      // Check if local chain config is already uncommented
      if (configContent.includes("  - id: 31337") && !configContent.includes("  # - id: 31337")) {
        console.log("✅ Local chain config is already enabled");
        return;
      }

      // Remove any existing warning comments
      let updatedContent = configContent
        .replace(/^  # WARNING: DO NOT UNCOMMENT THE LOCAL CHAIN CONFIG BELOW!.*?\n/gm, "")
        .replace(/^  # The indexer cannot sync properly with multiple networks if localhost is enabled\.\n/gm, "")
        .replace(/^  # Use the deployment scripts to manage this configuration automatically\.\n/gm, "");

      // Uncomment the local chain config section
      updatedContent = updatedContent
        .replace(/^  # - id: 31337/gm, "  - id: 31337")
        .replace(/^  #   start_block: \d+/gm, "    start_block: 1000")
        .replace(/^  #   rpc_config:/gm, "    rpc_config:")
        .replace(/^  #     url: http:\/\/localhost:8545/gm, "      url: http://localhost:8545")
        .replace(/^  #   contracts:/gm, "    contracts:")
        .replace(/^  #     - name: (ActionRegistry|GardenToken|GardenAccount)/gm, "      - name: $1")
        .replace(/^  #       address: '[^']*'/gm, "      address: '0x0000000000000000000000000000000000000000'");

      fs.writeFileSync(this.envioConfigPath, updatedContent);
      console.log("✅ Local chain config enabled successfully");
    } catch (error) {
      console.error("❌ Failed to enable local chain config:", error.message);
      throw error;
    }
  }

  /**
   * Comment out local chain config after development
   */
  async disableLocalChainConfig() {
    console.log("\n🔒 Disabling local chain config...");

    try {
      const configContent = fs.readFileSync(this.envioConfigPath, "utf8");

      // Check if local chain config is already commented out
      if (configContent.includes("  # - id: 31337")) {
        console.log("✅ Local chain config is already disabled");
        return;
      }

      // Add warning comment
      const warningComment =
        "  # WARNING: DO NOT UNCOMMENT THE LOCAL CHAIN CONFIG BELOW!\n  # The indexer cannot sync properly with multiple networks if localhost is enabled.\n  # Use the deployment scripts to manage this configuration automatically.\n";

      // Comment out the local chain config section
      let updatedContent = configContent
        .replace(/^  - id: 31337/gm, "  # - id: 31337")
        .replace(/^    start_block: \d+/gm, "  #   start_block: 1000")
        .replace(/^    rpc_config:/gm, "  #   rpc_config:")
        .replace(/^      url: http:\/\/localhost:8545/gm, "  #     url: http://localhost:8545")
        .replace(/^    contracts:/gm, "  #   contracts:")
        .replace(/^      - name: (ActionRegistry|GardenToken|GardenAccount)/gm, "  #     - name: $1")
        .replace(/^      address: '[^']*'/gm, "  #       address: '0x547e82BF9c8496f41927583793242f6b91C182A6'");

      // Find the local chain config section and add the warning comment before it
      updatedContent = updatedContent.replace(/^  # - id: 31337/gm, `${warningComment}  # - id: 31337`);

      fs.writeFileSync(this.envioConfigPath, updatedContent);
      console.log("✅ Local chain config disabled with warning comment");
    } catch (error) {
      console.error("❌ Failed to disable local chain config:", error.message);
      throw error;
    }
  }

  /**
   * Update local chain config with deployed contract addresses
   */
  async updateLocalChainAddresses(deployment) {
    console.log("\n🔄 Updating local chain config with deployed addresses...");

    try {
      const configContent = fs.readFileSync(this.envioConfigPath, "utf8");

      // Update the addresses in the local chain config
      let updatedContent = configContent;

      // Update ActionRegistry address
      updatedContent = updatedContent.replace(
        /^      - name: ActionRegistry\n      address: '[^']*'/gm,
        `      - name: ActionRegistry\n      address: '${deployment.actionRegistry}'`,
      );

      // Update GardenToken address
      updatedContent = updatedContent.replace(
        /^      - name: GardenToken\n      address: '[^']*'/gm,
        `      - name: GardenToken\n      address: '${deployment.gardenToken}'`,
      );

      // Update GardenAccount address
      updatedContent = updatedContent.replace(
        /^      - name: GardenAccount\n      address: '[^']*'/gm,
        `      - name: GardenAccount\n      address: '${deployment.accountProxy}'`,
      );

      fs.writeFileSync(this.envioConfigPath, updatedContent);
      console.log("✅ Local chain addresses updated successfully");
    } catch (error) {
      console.error("❌ Failed to update local chain addresses:", error.message);
      throw error;
    }
  }

  /**
   * Stop file watching
   */
  stopWatching() {
    this.watchedFiles.forEach((_, filePath) => {
      fs.unwatchFile(filePath);
    });
    this.watchedFiles.clear();
    console.log("🛑 Stopped watching deployment files");
  }

  /**
   * Restore original Envio config from backup
   */
  restoreConfig() {
    if (fs.existsSync(this.backupConfigPath)) {
      fs.copyFileSync(this.backupConfigPath, this.envioConfigPath);
      console.log("✅ Restored original Envio config");
    }
  }
}

// CLI interface for standalone usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const integration = new EnvioIntegration();

  async function main() {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
Envio Integration CLI

Usage:
  node envio-integration.js [command] [options]

Commands:
  update [chainId]     Update config for specific chain (default: auto-detect recent)
  watch [chainIds...]  Watch for deployment changes and auto-update
  start               Start indexer after updating config
  restore             Restore original config from backup
  enable-local        Enable local chain config for development
  disable-local       Disable local chain config (cleanup after development)
  cleanup             Same as disable-local

Options:
  --localhost         Use localhost RPC for the chain
  --help, -h          Show this help

Examples:
  node envio-integration.js update 31337 --localhost
  node envio-integration.js watch 31337 84532
  node envio-integration.js enable-local
  node envio-integration.js disable-local
  node envio-integration.js update && node envio-integration.js start
      `);
      return;
    }

    try {
      const command = args[0] || "update";

      switch (command) {
        case "update": {
          const chainId = args[1];
          const useLocalhost = args.includes("--localhost");

          if (chainId) {
            await integration.updateEnvioConfig(chainId, useLocalhost);
          } else {
            await integration.checkAndUpdateRecentDeployments();
          }
          break;
        }

        case "watch": {
          const chainIds = args.slice(1).filter((arg) => !arg.startsWith("--"));
          await integration.autoUpdateOnDeployment(chainIds, true);

          // Keep process alive
          process.on("SIGINT", () => {
            integration.stopWatching();
            process.exit(0);
          });
          break;
        }

        case "start": {
          await integration.startIndexer();
          break;
        }

        case "restore": {
          integration.restoreConfig();
          break;
        }

        case "enable-local": {
          await integration.enableLocalChainConfig();
          break;
        }

        case "disable-local":
        case "cleanup": {
          await integration.disableLocalChainConfig();
          break;
        }

        default:
          console.error(`Unknown command: ${command}`);
          process.exit(1);
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = { EnvioIntegration };
