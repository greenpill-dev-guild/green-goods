import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { ConfigValidator, type GardenConfig } from "../utils/validation";
import { AnvilManager } from "./anvil";

/**
 * GardenDeployer - Handles garden deployment
 *
 * Extracted from deploy.js - handles deployment of individual gardens
 */
export class GardenDeployer {
  protected networkManager: NetworkManager;
  protected validator: ConfigValidator;
  protected deploymentAddresses: DeploymentAddresses;
  protected anvilManager: AnvilManager;

  constructor() {
    this.networkManager = new NetworkManager();
    this.validator = new ConfigValidator();
    this.deploymentAddresses = new DeploymentAddresses();
    this.anvilManager = new AnvilManager();
  }

  /**
   * Deploy a garden from config file
   * @param configPath - Path to garden config JSON
   * @param options - Deployment options
   */
  async deployGarden(configPath: string, options: ParsedOptions): Promise<void> {
    console.log(`Deploying garden from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this._setEnvironmentFlags(options);

    // Load and validate garden config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as GardenConfig;
    this.validator.validateGardenConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Garden configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Garden configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses: ReturnType<typeof this.deploymentAddresses.loadForChain>;
    let communityToken: string;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
      communityToken = this.deploymentAddresses.getCommunityToken(options.network);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load contract addresses: ${errorMsg}`);
      console.error(`Please deploy core contracts first: bun deploy.ts core --network ${options.network} --broadcast`);
      process.exit(1);
    }

    // Set environment variables for the Solidity script
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
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
   * @param scriptPath - Path to Solidity script
   * @param options - Deployment options
   * @param env - Environment variables
   */
  protected async _executeForgeScript(
    scriptPath: string,
    options: ParsedOptions,
    env: Record<string, string> = {},
  ): Promise<void> {
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
    const displayArgs = this._redactSensitiveArgs(args);
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
   * @param options - Deployment options
   */
  protected _setEnvironmentFlags(options: ParsedOptions): void {
    process.env.UPDATE_SCHEMAS_ONLY = (options.updateSchemasOnly || false).toString();
    process.env.FORCE_REDEPLOY = (options.force || false).toString();
  }

  /**
   * Save garden deployment record
   * @param config - Garden configuration
   * @param options - Deployment options
   */
  private _saveGardenDeploymentRecord(config: GardenConfig, options: ParsedOptions): void {
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

  /**
   * Redact sensitive arguments from the displayed forge command.
   *
   * This keeps execution behaviour unchanged while avoiding logging
   * secrets such as private keys and API keys.
   */
  private _redactSensitiveArgs(args: string[]): string[] {
    const sensitiveFlags = new Set([
      "--private-key",
      "--etherscan-api-key",
      "--account",
      "--sender",
    ]);

    const redacted: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      redacted.push(arg);
      if (sensitiveFlags.has(arg) && i + 1 < args.length) {
        redacted.push("[REDACTED]");
        i++; // skip original sensitive value
      }
    }

    return redacted;
  }
}
