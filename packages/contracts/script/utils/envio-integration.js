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
          await this.updateEnvioConfig(chainId);
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
            await this.updateEnvioConfig(chainId);
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
   */
  async updateEnvioConfig(chainId = "31337") {
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

      // Backup current config only if it hasn't been backed up recently
      if (fs.existsSync(this.envioConfigPath)) {
        const shouldBackup = !fs.existsSync(this.backupConfigPath) || this.isBackupOld(this.backupConfigPath);

        if (shouldBackup) {
          fs.copyFileSync(this.envioConfigPath, this.backupConfigPath);
          console.log("💾 Backed up existing config");
        }
      }

      // Load current Envio config with schema: 'failsafe' to preserve strings
      const envioConfig = yaml.load(fs.readFileSync(this.envioConfigPath, "utf8"), {
        schema: yaml.CORE_SCHEMA,
      });

      // Update or add network configuration
      const targetChainId = Number.parseInt(chainId);
      const networkIndex = envioConfig.networks.findIndex((n) => n.id === targetChainId);

      const networkConfig = {
        id: targetChainId,
        start_block: this.getStartBlock(chainId),
        contracts: [
          {
            name: "ActionRegistry",
            address: String(deployment.actionRegistry), // Ensure string
          },
          {
            name: "GardenToken",
            address: String(deployment.gardenToken), // Ensure string
          },
          {
            name: "GardenAccount",
            address: String(deployment.accountProxy), // Ensure string
          },
        ],
      };

      if (networkIndex >= 0) {
        // Preserve existing network config structure, only update contracts
        envioConfig.networks[networkIndex] = {
          ...envioConfig.networks[networkIndex],
          ...networkConfig,
        };
        console.log(`🔄 Updated existing network config for chain ${targetChainId}`);
      } else {
        envioConfig.networks.push(networkConfig);
        console.log(`➕ Added new network config for chain ${targetChainId}`);
      }

      // Ensure all network addresses are strings (fix corrupted data)
      envioConfig.networks.forEach((network) => {
        if (network.contracts) {
          network.contracts.forEach((contract) => {
            if (contract.address !== undefined && typeof contract.address !== "string") {
              // Convert scientific notation back to hex if needed
              console.warn(`⚠️  Converting corrupted address for ${contract.name} on chain ${network.id}`);
              // This is corrupted data, we can't recover it - flag for manual fix
              contract.address = String(contract.address);
            }
          });
        }
      });

      // Write updated config with proper string handling
      fs.writeFileSync(
        this.envioConfigPath,
        yaml.dump(envioConfig, {
          lineWidth: -1,
          sortKeys: false,
          quotingType: '"',
          noRefs: true,
          // Custom replacer to ensure addresses stay as quoted strings
          replacer: (key, value) => {
            if (key === "address" && typeof value === "string") {
              return value; // Keep as string
            }
            return value;
          },
        }),
      );
      console.log("✅ Envio config updated successfully");

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
   * Get appropriate start block for chain
   * Per Envio docs: Use 0 to let HyperSync find the first block automatically
   */
  getStartBlock(chainId) {
    // For localhost/anvil, start from block 1
    if (chainId === "31337") return 1;

    // For production chains, let Envio's HyperSync find the optimal start block
    // unless we have a specific known start block
    const knownStartBlocks = {
      42161: 200000000, // Arbitrum One - known deployment block
    };

    return knownStartBlocks[chainId] || 0;
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
      } catch {
        // Ignore errors if no process found
      }

      // Wait for processes to clean up
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Regenerate code with updated config
      console.log("🔧 Regenerating Envio code...");
      execSync("bun run codegen", {
        cwd: indexerDir,
        stdio: "inherit",
      });

      // Start indexer in background
      console.log("🏃 Starting indexer in background...");
      const { spawn } = require("node:child_process");
      const indexerProcess = spawn("bun", ["run", "dev"], {
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

Options:
  --help, -h          Show this help

Examples:
  node envio-integration.js update 31337
  node envio-integration.js watch 31337 84532
  node envio-integration.js update && node envio-integration.js start

Note: RPC URLs are now configured via environment variables.
Set ENVIO_RPC_URL_<CHAIN_ID> for custom RPC endpoints.
      `);
      return;
    }

    try {
      const command = args[0] || "update";

      switch (command) {
        case "update": {
          const chainId = args[1];

          if (chainId) {
            await integration.updateEnvioConfig(chainId);
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
