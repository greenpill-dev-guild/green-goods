import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import * as yaml from "js-yaml";

interface EnvioContract {
  name: string;
  address: string;
}

interface EnvioNetwork {
  id: number;
  start_block: number;
  contracts: EnvioContract[];
  [key: string]: unknown;
}

interface EnvioConfig {
  networks: EnvioNetwork[];
  [key: string]: unknown;
}

interface DeploymentData {
  actionRegistry: string;
  gardenToken: string;
  gardenAccountImpl?: string;
  accountProxy?: string;
  [key: string]: string | undefined;
}

interface BroadcastTransaction {
  blockNumber?: string | number;
}

interface BroadcastReceipt {
  blockNumber?: string | number;
}

interface BroadcastData {
  transactions?: BroadcastTransaction[];
  receipts?: BroadcastReceipt[];
}

export class EnvioIntegration {
  private contractsDir: string;
  private envioConfigPath: string;
  private backupConfigPath: string;
  private watchedFiles: Map<string, Date>;

  constructor() {
    this.contractsDir = path.join(__dirname, "../../deployments");
    this.envioConfigPath = path.join(__dirname, "../../../indexer/config.yaml");
    this.backupConfigPath = path.join(__dirname, "../../../indexer/config.yaml.backup");
    this.watchedFiles = new Map(); // Track file modification times
  }

  /**
   * Auto-update Envio config when deployment files change
   * @param chainIds - Chain IDs to monitor (optional, monitors all if empty)
   * @param continuous - Whether to watch for continuous changes
   */
  async autoUpdateOnDeployment(chainIds: string[] = [], continuous = false): Promise<void> {
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
  async checkAndUpdateRecentDeployments(chainIds: string[] = []): Promise<void> {
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to check recent deployments:", errorMsg);
    }
  }

  /**
   * Start watching deployment files for changes
   */
  startFileWatcher(chainIds: string[] = []): void {
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
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("❌ Failed to auto-update Envio config:", errorMsg);
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
  getDeploymentFiles(chainIds: string[] = []): string[] {
    const files: string[] = [];

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
  extractChainIdFromFile(filePath: string): string {
    const fileName = path.basename(filePath);
    return fileName.replace("-latest.json", "");
  }

  /**
   * Update Envio config with deployed contract addresses
   * @param chainId - Chain ID to update config for
   * @param _isLocalhost - Whether this is a localhost deployment (unused but kept for API compatibility)
   */
  async updateEnvioConfig(chainId = "31337", _isLocalhost = false): Promise<DeploymentData> {
    try {
      console.log(`\n📝 Updating Envio configuration for chain ${chainId}...`);

      // Load deployment data
      const deploymentFile = path.join(this.contractsDir, `${chainId}-latest.json`);
      if (!fs.existsSync(deploymentFile)) {
        throw new Error(`No deployment found for chain ${chainId}`);
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as DeploymentData;

      // Validate required addresses
      const requiredAddresses = ["actionRegistry", "gardenToken", "gardenAccountImpl"];
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
      }) as EnvioConfig;

      // Update or add network configuration
      const targetChainId = Number.parseInt(chainId, 10);
      const networkIndex = envioConfig.networks.findIndex((n) => n.id === targetChainId);

      const startBlock = this.getStartBlock(chainId);
      const networkConfig: EnvioNetwork = {
        id: targetChainId,
        start_block: startBlock,
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
            // Use gardenAccountImpl (new) or accountProxy (old deployments) - check for zero address
            address: String(
              deployment.gardenAccountImpl &&
                deployment.gardenAccountImpl !== "0x0000000000000000000000000000000000000000"
                ? deployment.gardenAccountImpl
                : deployment.accountProxy,
            ),
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
        }),
      );
      console.log("✅ Envio config updated successfully");

      // Display the updated addresses
      const gardenAccountAddress =
        deployment.gardenAccountImpl && deployment.gardenAccountImpl !== "0x0000000000000000000000000000000000000000"
          ? deployment.gardenAccountImpl
          : deployment.accountProxy;

      console.log(`\n📋 Contract addresses updated in Envio for chain ${chainId}:`);
      console.log(`   ActionRegistry: ${deployment.actionRegistry}`);
      console.log(`   GardenToken: ${deployment.gardenToken}`);
      console.log(`   GardenAccount: ${gardenAccountAddress}`);
      console.log(`   start_block: ${startBlock}`);

      return deployment;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to update Envio config:", errorMsg);
      throw error;
    }
  }

  /**
   * Disable local chain config (cleanup method for localhost deployments)
   */
  async disableLocalChainConfig(): Promise<void> {
    // This is a placeholder for cleanup logic
    console.log("🧹 Disabling local chain config...");
  }

  /**
   * Get appropriate start block for chain
   * Uses latest deploy broadcast to rewind slightly before deployment for indexing
   */
  getStartBlock(chainId: string): number {
    // For localhost/anvil, start from block 1
    if (chainId === "31337") return 1;

    // Try to infer from latest broadcast file
    const inferred = this.getStartBlockFromBroadcast(chainId);
    if (inferred !== null) return inferred;

    // Fallback: let HyperSync find start
    return 0;
  }

  /**
   * Infer start block from broadcast run-latest.json (rewind 50 blocks as buffer)
   */
  getStartBlockFromBroadcast(chainId: string): number | null {
    try {
      const broadcastPath = path.join(__dirname, "../../broadcast/Deploy.s.sol", chainId, "run-latest.json");
      if (!fs.existsSync(broadcastPath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(broadcastPath, "utf8")) as BroadcastData;
      const blockNumbers: number[] = [];

      const pushBlock = (val: string | number | undefined): void => {
        if (!val) return;
        const num = typeof val === "string" && val.startsWith("0x") ? Number.parseInt(val, 16) : Number(val);
        if (Number.isFinite(num)) {
          blockNumbers.push(num);
        }
      };

      (data.transactions || []).forEach((tx) => pushBlock(tx.blockNumber));
      (data.receipts || []).forEach((receipt) => pushBlock(receipt.blockNumber));

      if (blockNumbers.length === 0) return null;

      const minBlock = Math.min(...blockNumbers);
      const buffer = 50;
      return Math.max(minBlock - buffer, 0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Unable to derive start block from broadcast for chain ${chainId}: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Check if backup is older than 1 hour
   */
  isBackupOld(backupPath: string): boolean {
    const stats = fs.statSync(backupPath);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return stats.mtime < oneHourAgo;
  }

  /**
   * Start Envio indexer with updated config
   */
  async startIndexer(): Promise<ChildProcess> {
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to start indexer:", errorMsg);
      throw error;
    }
  }

  /**
   * Stop file watching
   */
  stopWatching(): void {
    this.watchedFiles.forEach((_, filePath) => {
      fs.unwatchFile(filePath);
    });
    this.watchedFiles.clear();
    console.log("🛑 Stopped watching deployment files");
  }

  /**
   * Restore original Envio config from backup
   */
  restoreConfig(): void {
    if (fs.existsSync(this.backupConfigPath)) {
      fs.copyFileSync(this.backupConfigPath, this.envioConfigPath);
      console.log("✅ Restored original Envio config");
    }
  }
}

// CLI interface for standalone usage
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const integration = new EnvioIntegration();

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Envio Integration CLI

Usage:
  bun envio-integration.ts [command] [options]

Commands:
  update [chainId]     Update config for specific chain (default: auto-detect recent)
  watch [chainIds...]  Watch for deployment changes and auto-update
  start               Start indexer after updating config
  restore             Restore original config from backup

Options:
  --help, -h          Show this help

Examples:
  bun envio-integration.ts update 31337
  bun envio-integration.ts watch 31337 84532
  bun envio-integration.ts update && bun envio-integration.ts start

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
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", errorMsg);
    process.exit(1);
  }
}

// Run main function if called directly
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("envio-integration.ts");
if (isMain) {
  main();
}
