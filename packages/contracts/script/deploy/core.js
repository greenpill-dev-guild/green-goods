const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { NetworkManager } = require("../utils/network");
const { AnvilManager } = require("./anvil");
const { EnvioIntegration } = require("../utils/envio-integration");

/**
 * CoreDeployer - Handles core contract deployment
 *
 * Extracted from deploy.js - handles deployment of core protocol contracts
 */
class CoreDeployer {
  constructor() {
    this.networkManager = new NetworkManager();
    this.anvilManager = new AnvilManager();
  }

  /**
   * Deploy core contracts to a network
   * @param {Object} options - Deployment options
   */
  async deployCoreContracts(options) {
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

      if (options.saveReport) {
        console.log("📊 Generating deployment report...");
        // Report generation would be implemented here
      }
    } catch (error) {
      console.error("\n❌ Core contract deployment failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Set environment flags for deployment
   * @param {Object} options - Deployment options
   */
  _setEnvironmentFlags(options) {
    process.env.UPDATE_SCHEMAS_ONLY = options.updateSchemasOnly.toString();
    process.env.FORCE_REDEPLOY = options.force.toString();
  }

  /**
   * Log active deployment flags
   * @param {Object} options - Deployment options
   */
  _logActiveFlags(options) {
    const activeFlags = [];

    if (options.updateSchemasOnly) activeFlags.push("Update Schemas Only");
    if (options.force) activeFlags.push("Force Redeploy");

    if (activeFlags.length > 0) {
      console.log(`\nFlags: ${activeFlags.join(", ")}`);
    }

    console.log("\nGovernance: 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19 (Green Goods Safe)\n");

    const allowlistAddresses = [];
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
   * @param {Object} options - Deployment options
   * @returns {boolean} True if should verify
   */
  _shouldVerifyContracts(options) {
    const verifierConfig = this.networkManager.getVerifierConfig(options.network);
    let shouldVerify = options.verify && verifierConfig && !options.skipVerification;

    if (shouldVerify) {
      try {
        const chainId = this.networkManager.getChainIdString(options.network);
        const deploymentFile = path.join(__dirname, "../../deployments", `${chainId}-latest.json`);

        if (fs.existsSync(deploymentFile) && !options.force) {
          console.log("⏭️  Skipping verification - contracts already deployed and likely verified");
          shouldVerify = false;
        }
      } catch (error) {
        console.error("❌ Failed to check deployment status:", error.message);
        // If check fails, proceed with verification
      }
    }

    return shouldVerify;
  }

  /**
   * Update Envio configuration after deployment
   * @param {Object} options - Deployment options
   */
  async _updateEnvioConfig(options) {
    const chainId = this.networkManager.getChainIdString(options.network);

    try {
      console.log("\n🔄 Auto-updating Envio configuration...");

      const envioIntegration = new EnvioIntegration();
      await envioIntegration.updateEnvioConfig(chainId, options.network === "localhost");

      // Setup cleanup for local deployments
      if (options.network === "localhost") {
        console.log("🔄 Setting up cleanup for local chain config...");

        const cleanup = async () => {
          console.log("\n🧹 Cleaning up local chain config...");
          try {
            await envioIntegration.disableLocalChainConfig();
            console.log("✅ Local chain config disabled successfully");
          } catch (error) {
            console.warn("⚠️  Failed to disable local chain config:", error.message);
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
      console.warn("⚠️  Failed to update Envio config:", envioError.message);
      console.warn("   You can manually update it later using:");
      console.warn(`   node script/utils/envio-integration.js update ${chainId}`);
    }
  }
}

module.exports = { CoreDeployer };
