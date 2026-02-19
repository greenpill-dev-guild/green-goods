import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { AnvilManager } from "./anvil";
import { assertSepoliaGate } from "../utils/release-gate";

/**
 * GoodsDeployer - Handles GOODS Juicebox project deployment
 *
 * Deploys the Green Goods Juicebox v5 project via DeployGoodsProject.s.sol.
 * Creates the GOODS token, configures reserved splits, seeds the treasury,
 * and mints the free staking buffer.
 *
 * Requires environment variables:
 *   GOODS_MULTISIG, JB_CONTROLLER, JB_MULTI_TERMINAL,
 *   GOODS_AIRDROP_POOL, GOODS_OPERATOR_POOL, GOODS_DEV_POOL
 */
export class GoodsDeployer {
  private networkManager: NetworkManager;
  private anvilManager: AnvilManager;

  constructor(networkManager?: NetworkManager, anvilManager?: AnvilManager) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.anvilManager = anvilManager ?? new AnvilManager(this.networkManager);
  }

  /**
   * Deploy the GOODS Juicebox project
   * @param options - Deployment options
   */
  async deployGoods(options: ParsedOptions): Promise<void> {
    console.log(`Deploying GOODS project to ${options.network}`);

    // Validate required environment variables
    const requiredEnvVars = [
      "GOODS_MULTISIG",
      "JB_CONTROLLER",
      "JB_MULTI_TERMINAL",
      "GOODS_AIRDROP_POOL",
      "GOODS_OPERATOR_POOL",
      "GOODS_DEV_POOL",
    ];

    const missing = requiredEnvVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(", ")}`);
      console.error("Set these in your .env file before deploying.");
      process.exit(1);
    }

    if (options.dryRun) {
      console.log("\nDRY RUN - GOODS project configuration:");
      for (const v of requiredEnvVars) {
        const val = process.env[v] ?? "";
        const masked = val.length > 8 ? `${val.slice(0, 6)}...${val.slice(-4)}` : "[set]";
        console.log(`  ${v}: ${masked}`);
      }
      console.log("\nConfiguration is valid!");
      return;
    }

    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    // Auto-start anvil for localhost
    if (options.network === "localhost") {
      await this.anvilManager.ensureAnvilRunning("arbitrum");
    }

    const networkConfig = this.networkManager.getNetwork(options.network);
    const rpcUrl = this.networkManager.getRpcUrl(options.network);

    const args = ["script", "script/DeployGoodsProject.s.sol:DeployGoodsProject"];
    args.push("--chain-id", networkConfig.chainId.toString());
    args.push("--rpc-url", rpcUrl);

    if (options.broadcast) {
      args.push("--broadcast");

      const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
      args.push("--account", keystoreName);

      const senderAddress = process.env.SENDER_ADDRESS;
      if (senderAddress) {
        args.push("--sender", senderAddress);
      }

      console.log(`Using Foundry keystore: ${keystoreName === "green-goods-deployer" ? keystoreName : "[custom]"}`);
      console.log("Password will be prompted interactively");
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

    console.log("\nExecuting GOODS project deployment...");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    try {
      execFileSync("forge", args, {
        stdio: "inherit",
        env: {
          ...process.env,
          FOUNDRY_PROFILE: "production",
          FORGE_BROADCAST: options.broadcast ? "true" : "false",
        },
        cwd: path.join(__dirname, "../.."),
      });

      console.log("\nGOODS project deployed successfully!");
      console.log("Artifacts saved to deployments/<chainId>-goods.json");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\nGOODS project deployment failed:", errorMsg);
      process.exit(1);
    }
  }
}
