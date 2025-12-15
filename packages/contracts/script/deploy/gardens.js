const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { NetworkManager } = require("../utils/network");
const { ConfigValidator } = require("../utils/validation");
const { DeploymentAddresses } = require("../utils/deployment-addresses");
const { AnvilManager } = require("./anvil");

/**
 * GardenDeployer - Handles garden deployment
 *
 * Extracted from deploy.js - handles deployment of individual gardens
 */
class GardenDeployer {
  constructor() {
    this.networkManager = new NetworkManager();
    this.validator = new ConfigValidator();
    this.deploymentAddresses = new DeploymentAddresses();
    this.anvilManager = new AnvilManager();
  }

  /**
   * Deploy a garden from config file
   * @param {string} configPath - Path to garden config JSON
   * @param {Object} options - Deployment options
   */
  async deployGarden(configPath, options) {
    console.log(`Deploying garden from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this._setEnvironmentFlags(options);

    // Load and validate garden config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    this.validator.validateGardenConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Garden configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Garden configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses;
    let communityToken;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
      communityToken = this.deploymentAddresses.getCommunityToken(options.network);
    } catch (error) {
      console.error(`❌ Failed to load contract addresses: ${error.message}`);
      console.error(`Please deploy core contracts first: node deploy.js core --network ${options.network} --broadcast`);
      process.exit(1);
    }

    // Set environment variables for the Solidity script
    const env = {
      ...process.env,
      GARDEN_NAME: config.name,
      GARDEN_DESCRIPTION: config.description,
      GARDEN_LOCATION: config.location,
      GARDEN_BANNER: config.bannerImage,
      GARDENERS: JSON.stringify(config.gardeners),
      OPERATORS: JSON.stringify(config.operators),
      GARDEN_TOKEN: contractAddresses.gardenToken,
      COMMUNITY_TOKEN: communityToken,
    };

    await this._executeForgeScript("script/DeployGarden.s.sol:DeployGarden", options, env);

    // Save deployment record
    this._saveGardenDeploymentRecord(config, options);
    console.log("\n✅ Garden deployed successfully!");
  }

  /**
   * Execute a forge script
   * @param {string} scriptPath - Path to Solidity script
   * @param {Object} options - Deployment options
   * @param {Object} env - Environment variables
   */
  async _executeForgeScript(scriptPath, options, env = {}) {
    const networkConfig = this.networkManager.getNetwork(options.network);

    // Set environment variables for deployment flags
    this._setEnvironmentFlags(options);

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost") {
      await this.anvilManager.ensureAnvilRunning("celo");
    }

    const args = ["script", scriptPath];

    if (options.network !== "localhost") {
      const rpcUrl = this.networkManager.getRpcUrl(options.network);
      args.push("--rpc-url", rpcUrl);
      args.push("--chain-id", networkConfig.chainId.toString());
    } else {
      args.push("--rpc-url", "http://localhost:8545");
    }

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

    if (options.verify) {
      const verifierConfig = this.networkManager.getVerifierConfig(options.network);
      if (verifierConfig && !options.skipVerification) {
        args.push("--verify");
        args.push("--verifier-url", verifierConfig.apiUrl);
        if (verifierConfig.apiKey) {
          args.push("--etherscan-api-key", verifierConfig.apiKey);
        }
      }
    }

    console.log("\nExecuting deployment...");
    const displayArgs = args.map((arg, idx) => (idx > 0 && args[idx - 1] === "--private-key" ? "[REDACTED]" : arg));
    console.log("forge", displayArgs.join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      env: {
        ...process.env,
        ...env,
        FOUNDRY_PROFILE: "production",
        FORGE_BROADCAST: options.broadcast ? "true" : "false",
      },
      cwd: path.join(__dirname, "../.."),
    });
  }

  /**
   * Set environment flags for deployment
   * @param {Object} options - Deployment options
   */
  _setEnvironmentFlags(options) {
    process.env.UPDATE_SCHEMAS_ONLY = (options.updateSchemasOnly || false).toString();
    process.env.FORCE_REDEPLOY = (options.force || false).toString();
  }

  /**
   * Save garden deployment record
   * @param {Object} config - Garden configuration
   * @param {Object} options - Deployment options
   */
  _saveGardenDeploymentRecord(config, options) {
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    const deploymentRecord = {
      ...config,
      timestamp: new Date().toISOString(),
      network: options.network,
      deployer: keystoreName,
    };

    const recordPath = path.join(
      __dirname,
      "../..",
      "deployments",
      "gardens",
      `${config.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`,
    );

    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

    console.log(`Deployment record saved to: ${recordPath}`);
  }
}

module.exports = { GardenDeployer };
