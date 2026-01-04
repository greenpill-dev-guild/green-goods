import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { NetworkManager } from "../utils/network";
import { AnvilManager } from "./anvil";
import { EnvioIntegration } from "../utils/envio-integration";
import { DocsUpdater } from "../utils/docs-updater";
import type { ParsedOptions } from "../utils/cli-parser";

/**
 * CoreDeployer - Handles core contract deployment
 *
 * Extracted from deploy.js - handles deployment of core protocol contracts
 */
export class CoreDeployer {
  private networkManager: NetworkManager;
  private anvilManager: AnvilManager;

  constructor() {
    this.networkManager = new NetworkManager();
    this.anvilManager = new AnvilManager();
  }

  /**
   * Deploy core contracts to a network
   * @param options - Deployment options
   */
  async deployCoreContracts(options: ParsedOptions): Promise<void> {
    console.log(`Deploying core contracts to ${options.network}`);

    // Set environment variables for the Solidity script
    this._setEnvironmentFlags(options);

    // Display active deployment flags
    this._logActiveFlags(options);

    const networkConfig = this.networkManager.getNetwork(options.network);

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost") {
      await this.anvilManager.ensureAnvilRunning("celo");
    }

    // Get RPC URL
    const rpcUrl = this.networkManager.getRpcUrl(options.network);

    // Build forge script command - always use unified Deploy.s.sol
    const args = ["script", "script/Deploy.s.sol:Deploy"];
    args.push("--chain-id", networkConfig.chainId.toString());
    args.push("--rpc-url", rpcUrl);

    if (options.broadcast) {
      args.push("--broadcast");

      // Require Foundry keystore account
      const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
      args.push("--account", keystoreName);

      // Optionally specify sender address for verification
      const senderAddress = process.env.SENDER_ADDRESS;
      if (senderAddress) {
        args.push("--sender", senderAddress);
      }

      console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
      console.log("💡 Password will be prompted interactively");
    }

    // Handle verification
    const shouldVerify = this._shouldVerifyContracts(options);

    if (shouldVerify) {
      const verifierConfig = this.networkManager.getVerifierConfig(options.network);
      if (verifierConfig) {
        args.push("--verify");
        args.push("--verifier-url", verifierConfig.apiUrl);

        if (verifierConfig.apiKey) {
          args.push("--etherscan-api-key", verifierConfig.apiKey);
        }
      }
    }

    console.log("\nExecuting deployment command:");
    const displayArgs = args.map((arg, idx) => (idx > 0 && args[idx - 1] === "--private-key" ? "[REDACTED]" : arg));
    console.log("forge", displayArgs.join(" "));

    try {
      execSync(`forge ${args.join(" ")}`, {
        stdio: "inherit",
        env: {
          ...process.env,
          FOUNDRY_PROFILE: "production",
          FORGE_BROADCAST: options.broadcast ? "true" : "false",
        },
        cwd: path.join(__dirname, "../.."),
      });

      console.log("\n✅ Core contracts deployed successfully!");

      // Auto-update Envio configuration after successful deployment
      if (!options.skipEnvio) {
        await this._updateEnvioConfig(options);
      }

      // Auto-update documentation with new deployment data
      if (options.broadcast && options.network !== "localhost") {
        await this._updateDocumentation(options);
      }

      if (options.saveReport) {
        console.log("📊 Generating deployment report...");
        // Report generation would be implemented here
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\n❌ Core contract deployment failed:", errorMsg);
      process.exit(1);
    }
  }

  /**
   * Set environment flags for deployment
   * @param options - Deployment options
   */
  private _setEnvironmentFlags(options: ParsedOptions): void {
    process.env.UPDATE_SCHEMAS_ONLY = options.updateSchemasOnly.toString();
    process.env.FORCE_REDEPLOY = options.force.toString();
  }

  /**
   * Log active deployment flags
   * @param options - Deployment options
   */
  private _logActiveFlags(options: ParsedOptions): void {
    const activeFlags: string[] = [];

    if (options.updateSchemasOnly) activeFlags.push("Update Schemas Only");
    if (options.force) activeFlags.push("Force Redeploy");

    if (activeFlags.length > 0) {
      console.log(`\nFlags: ${activeFlags.join(", ")}`);
    }

    console.log("\nGovernance: 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19 (Green Goods Safe)\n");

    const allowlistAddresses: string[] = [];
    if (process.env.DEPLOYMENT_REGISTRY_ALLOWLIST) {
      allowlistAddresses.push(process.env.DEPLOYMENT_REGISTRY_ALLOWLIST);
    }
    for (let i = 0; i < 10; i++) {
      const addr = process.env[`ALLOWLIST_ADDRESS_${i}`];
      if (addr) allowlistAddresses.push(addr);
    }

    if (allowlistAddresses.length > 0) {
      console.log("   Allowlist:", allowlistAddresses.join(", "));
    }

    console.log("");
  }

  /**
   * Check if contracts should be verified
   * @param options - Deployment options
   * @returns True if should verify
   */
  private _shouldVerifyContracts(options: ParsedOptions): boolean {
    const verifierConfig = this.networkManager.getVerifierConfig(options.network);
    let shouldVerify = options.verify && verifierConfig !== null && !options.skipVerification;

    if (shouldVerify) {
      try {
        const chainId = this.networkManager.getChainIdString(options.network);
        const deploymentFile = path.join(__dirname, "../../deployments", `${chainId}-latest.json`);

        if (fs.existsSync(deploymentFile) && !options.force) {
          console.log("⏭️  Skipping verification - contracts already deployed and likely verified");
          shouldVerify = false;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ Failed to check deployment status:", errorMsg);
        // If check fails, proceed with verification
      }
    }

    return shouldVerify;
  }

  /**
   * Update Envio configuration after deployment
   * @param options - Deployment options
   */
  private async _updateEnvioConfig(options: ParsedOptions): Promise<void> {
    const chainId = this.networkManager.getChainIdString(options.network);

    try {
      console.log("\n🔄 Auto-updating Envio configuration...");

      const envioIntegration = new EnvioIntegration();
      await envioIntegration.updateEnvioConfig(chainId, options.network === "localhost");

      // Setup cleanup for local deployments
      if (options.network === "localhost") {
        console.log("🔄 Setting up cleanup for local chain config...");

        const cleanup = async (): Promise<void> => {
          console.log("\n🧹 Cleaning up local chain config...");
          try {
            await envioIntegration.disableLocalChainConfig();
            console.log("✅ Local chain config disabled successfully");
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn("⚠️  Failed to disable local chain config:", errorMsg);
          }
        };

        // Register cleanup handlers
        process.on("exit", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        process.on("uncaughtException", cleanup);
      }

      // Optionally start indexer for localhost deployments
      if (options.network === "localhost" && options.startIndexer) {
        await envioIntegration.startIndexer();
      }
    } catch (envioError) {
      const errorMsg = envioError instanceof Error ? envioError.message : String(envioError);
      console.warn("⚠️  Failed to update Envio config:", errorMsg);
      console.warn("   You can manually update it later using:");
      console.warn(`   bun script/utils/envio-integration.ts update ${chainId}`);
    }
  }

  /**
   * Update documentation with deployment data
   * @param options - Deployment options
   */
  private async _updateDocumentation(options: ParsedOptions): Promise<void> {
    const chainId = this.networkManager.getChainIdString(options.network);

    try {
      const docsUpdater = new DocsUpdater();
      await docsUpdater.updateDocs([chainId]);
    } catch (docsError) {
      const errorMsg = docsError instanceof Error ? docsError.message : String(docsError);
      console.warn("⚠️  Failed to update documentation:", errorMsg);
      console.warn("   You can manually update docs using:");
      console.warn(`   bun script/utils/docs-updater.ts ${chainId}`);
    }
  }
}
