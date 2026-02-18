import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { NetworkManager, CHAIN_ID_MAP } from "../utils/network";
import { AnvilManager } from "./anvil";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { assertSepoliaGate } from "../utils/release-gate";

/**
 * OctantFactoryDeployer - Deploys the Octant vault factory
 *
 * Deploys MultistrategyVault implementation + MultistrategyVaultFactory,
 * then merges the factory address into the main deployment JSON so
 * OctantModule can be wired automatically on the next core deploy.
 */
export class OctantFactoryDeployer {
  private networkManager: NetworkManager;
  private anvilManager: AnvilManager;

  constructor(networkManager?: NetworkManager, anvilManager?: AnvilManager) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.anvilManager = anvilManager ?? new AnvilManager(this.networkManager);
  }

  /**
   * Deploy the Octant vault factory
   * @param options - Deployment options
   */
  async deployOctantFactory(options: ParsedOptions): Promise<void> {
    console.log(`Deploying Octant vault factory to ${options.network}`);

    if (options.dryRun || options.pureSimulation) {
      this._runPureSimulation(options);
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

    const args = ["script", "script/DeployOctantFactory.s.sol:DeployOctantFactory"];
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

      console.log(`\nUsing Foundry keystore: ${keystoreName === "green-goods-deployer" ? keystoreName : "[custom]"}`);
      console.log("Password will be prompted interactively");
    }

    // Handle verification
    if (options.verify && options.network !== "localhost" && !options.skipVerification) {
      const verifierConfig = this.networkManager.getVerifierConfig(options.network);
      if (verifierConfig) {
        args.push("--verify");
        args.push("--verifier-url", verifierConfig.apiUrl);
        if (verifierConfig.apiKey) {
          args.push("--etherscan-api-key", verifierConfig.apiKey);
        }
      }
    }

    console.log("\nExecuting Octant factory deployment...");
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

      console.log("\nOctant factory deployed successfully!");

      // Merge factory address into the main deployment JSON
      if (options.broadcast) {
        this._mergeIntoDeployment(networkConfig.chainId.toString());
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\nOctant factory deployment failed:", errorMsg);
      process.exit(1);
    }
  }

  /**
   * Merge the factory result into the main deployment JSON.
   *
   * Reads the {chainId}-octant-factory.json artifact written by the Solidity
   * script and patches `octantFactory` in the main {chainId}-latest.json.
   */
  private _mergeIntoDeployment(chainId: string): void {
    const deploymentsDir = path.join(__dirname, "../../deployments");
    const factoryResultPath = path.join(deploymentsDir, `${chainId}-octant-factory.json`);
    const mainDeploymentPath = path.join(deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(factoryResultPath)) {
      console.warn("Factory result file not found — skipping deployment JSON merge");
      console.warn(`  Expected: ${factoryResultPath}`);
      return;
    }

    const factoryResult = JSON.parse(fs.readFileSync(factoryResultPath, "utf8")) as {
      factory: string;
      implementation: string;
      governance: string;
    };

    console.log(`\nMerging factory address into ${chainId}-latest.json...`);
    console.log(`  Factory:        ${factoryResult.factory}`);
    console.log(`  Implementation: ${factoryResult.implementation}`);
    console.log(`  Governance:     ${factoryResult.governance}`);

    if (fs.existsSync(mainDeploymentPath)) {
      // Patch existing deployment JSON
      const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;
      deployment.octantFactory = factoryResult.factory;
      fs.writeFileSync(mainDeploymentPath, JSON.stringify(deployment, null, 2) + "\n");
      console.log(`  Updated: ${mainDeploymentPath}`);
    } else {
      console.warn(`  Main deployment file not found: ${mainDeploymentPath}`);
      console.warn("  Deploy core contracts first, then re-run or set OCTANT_FACTORY_ADDRESS manually.");
      console.warn(`  Factory address: ${factoryResult.factory}`);
    }

    // Clean up the intermediate file
    fs.unlinkSync(factoryResultPath);
    console.log("  Cleaned up intermediate artifact");
  }

  /**
   * Pure simulation / dry-run mode
   */
  private _runPureSimulation(options: ParsedOptions): void {
    const networkConfig = this.networkManager.getNetwork(options.network);
    console.log("\nDRY RUN — Octant factory deployment preflight");
    console.log(`  Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);
    console.log(`  RPC:     ${networkConfig.rpcUrl}`);

    console.log("\nRunning forge build preflight...");
    execFileSync("forge", ["build", "--skip", "test"], {
      stdio: "inherit",
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      cwd: path.join(__dirname, "../.."),
    });

    const chainId = CHAIN_ID_MAP[options.network] || networkConfig.chainId.toString();
    const mainPath = path.join(__dirname, "../../deployments", `${chainId}-latest.json`);
    if (fs.existsSync(mainPath)) {
      const deployment = JSON.parse(fs.readFileSync(mainPath, "utf8")) as Record<string, string>;
      const current = deployment.octantFactory || "not set";
      console.log(`\n  Current octantFactory in deployment: ${current}`);
    }

    console.log("\nPure simulation preflight completed successfully");
  }
}
