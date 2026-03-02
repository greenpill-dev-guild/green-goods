import { execSync } from "node:child_process";
import * as path from "node:path";
import type { ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";

/**
 * HatsTreeDeployer - Sets up the Green Goods Hats protocol tree
 */
export class HatsTreeDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async setupHatsTree(options: ParsedOptions): Promise<void> {
    console.log(`Setting up Hats tree on ${options.network}`);

    const networkConfig = this.networkManager.getNetwork(options.network);
    const rpcUrl = this.networkManager.getRpcUrl(options.network);

    if (!process.env.HATS_MODULE) {
      try {
        const addresses = this.deploymentAddresses.loadForChain(options.network);
        if (addresses.hatsModule) {
          process.env.HATS_MODULE = addresses.hatsModule;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn("⚠️  Unable to load deployment addresses:", errorMsg);
        console.warn("   Set HATS_MODULE manually to continue.");
      }
    }

    const args = ["script", "script/SetupHatsTree.s.sol:SetupHatsTree"];
    args.push("--chain-id", networkConfig.chainId.toString());
    args.push("--rpc-url", rpcUrl);

    if (options.broadcast) {
      args.push("--broadcast");

      const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
      args.push("--account", keystoreName);

      const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
      if (senderAddress) {
        args.push("--sender", senderAddress);
      }

      console.log("🔐 Using Foundry keystore (account configured via FOUNDRY_KEYSTORE_ACCOUNT)");
      console.log("💡 Password will be prompted interactively");
    }

    console.log("\nExecuting Hats tree setup command (see forge output for full details)...");

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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\n❌ Hats tree setup failed:", errorMsg);
      process.exit(1);
    }
  }
}
