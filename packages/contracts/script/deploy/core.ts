import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DocsUpdater } from "../utils/docs-updater";
import { EnvioIntegration } from "../utils/envio-integration";
import { NetworkManager } from "../utils/network";
import { assertSepoliaGate } from "../utils/release-gate";
import { AnvilManager } from "./anvil";

/**
 * CoreDeployer - Handles core contract deployment
 *
 * Extracted from deploy.js - handles deployment of core protocol contracts
 */
export class CoreDeployer {
  private networkManager: NetworkManager;
  private anvilManager: AnvilManager;

  constructor(networkManager?: NetworkManager, anvilManager?: AnvilManager) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.anvilManager = anvilManager ?? new AnvilManager(this.networkManager);
  }

  /**
   * Deploy core contracts to a network
   * @param options - Deployment options
   */
  async deployCoreContracts(options: ParsedOptions): Promise<void> {
    console.log(`Deploying core contracts to ${options.network}`);

    // Set environment variables for the Solidity script
    this._setEnvironmentFlags(options);
    this._ensureArbitrumEnsReceiver(options);

    // Display active deployment flags
    this._logActiveFlags(options);

    const networkConfig = this.networkManager.getNetwork(options.network);
    const pureSimulation = options.pureSimulation;

    if (pureSimulation) {
      this._runPureSimulation(networkConfig);
      return;
    }

    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

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

      console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
      console.log("💡 Password will be prompted interactively");
    }

    // Use explicit sender for both broadcast and dry-run simulation when provided.
    // This keeps role/admin checks aligned with the real deployer identity.
    const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
    if (senderAddress) {
      args.push("--sender", senderAddress);
    }

    const shouldSaveArtifacts = options.broadcast || options.saveArtifacts;
    if (options.saveArtifacts && !options.broadcast) {
      console.log("🗂️ Saving forge artifacts without broadcasting transactions");
    }

    if (options.dryRun && !options.broadcast) {
      console.log("🧪 Dry-run execution enabled (RPC simulation, no broadcast)");
    }

    this._ensureDeploymentOutputDir();

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
    console.log("forge", redactSensitiveArgs(args).join(" "));

    try {
      execFileSync("forge", args, {
        stdio: "inherit",
        env: {
          ...process.env,
          FOUNDRY_PROFILE: "production",
          FORGE_BROADCAST: shouldSaveArtifacts ? "true" : "false",
          FORGE_DRY_RUN_CHECKS: options.dryRun ? "true" : "false",
        },
        cwd: path.join(__dirname, "../.."),
      });

      if (options.broadcast) {
        console.log("\n✅ Core contracts deployed successfully!");
      } else if (options.dryRun) {
        console.log("\n✅ Core dry-run simulation completed successfully!");
      } else {
        console.log("\n✅ Core deployment simulation completed successfully!");
      }

      // After mainnet ENS infra broadcast, sync ENS_L1_RECEIVER into root .env for Arbitrum deploys.
      this._autoPopulateEnsL1Receiver(options);

      // Auto-update Envio configuration after successful broadcast deployment
      if (options.broadcast && !options.skipEnvio) {
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
   * Pure simulation mode for dry-run workflows.
   * Performs compile + config preflight without RPC calls or side effects.
   */
  private _runPureSimulation(networkConfig: { chainId: number; name: string; rpcUrl: string }): void {
    console.log("🧪 Pure simulation mode enabled (no RPC calls, no deployments)\n");
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);
    console.log(`RPC Source: ${networkConfig.rpcUrl}`);

    console.log("\n🔨 Running forge build preflight...");
    execFileSync("forge", ["build", "--skip", "test"], {
      stdio: "inherit",
      env: {
        ...process.env,
        FOUNDRY_PROFILE: "production",
      },
      cwd: path.join(__dirname, "../.."),
    });

    const displayArgs = [
      "script",
      "script/Deploy.s.sol:Deploy",
      "--chain-id",
      networkConfig.chainId.toString(),
      "--rpc-url",
      "<resolved at runtime>",
    ];

    console.log("\nWould execute deployment command:");
    console.log("forge", displayArgs.join(" "));
    console.log("\n✅ Pure simulation preflight completed successfully");
  }

  /**
   * Set environment flags for deployment
   * @param options - Deployment options
   */
  private _setEnvironmentFlags(options: ParsedOptions): void {
    process.env.UPDATE_SCHEMAS_ONLY = options.updateSchemasOnly.toString();
    process.env.FORCE_REDEPLOY = options.force.toString();
    if (options.deploymentSalt) {
      process.env.DEPLOYMENT_SALT = options.deploymentSalt;
    }
  }

  /**
   * Ensure ENS_L1_RECEIVER is available for Arbitrum deployments.
   * If unset, attempt to load it from deployments/1-latest.json (ensReceiver)
   * after a successful mainnet ENS infra deployment.
   */
  private _ensureArbitrumEnsReceiver(options: ParsedOptions): void {
    if (options.network !== "arbitrum") {
      return;
    }

    const envReceiver = process.env.ENS_L1_RECEIVER;
    if (envReceiver && !/^0x0+$/i.test(envReceiver)) {
      return;
    }

    try {
      const deploymentPath = this._resolveDeploymentFilePath("1-latest.json");
      if (!fs.existsSync(deploymentPath)) {
        console.warn("⚠️  ENS_L1_RECEIVER is unset and mainnet deployment file was not found.");
        console.warn("   Run mainnet ENS deployment first or set ENS_L1_RECEIVER manually.");
        return;
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as { ensReceiver?: string };
      const ensReceiver = deployment.ensReceiver;
      if (!ensReceiver || /^0x0+$/i.test(ensReceiver)) {
        console.warn(`⚠️  ENS_L1_RECEIVER is unset and ${deploymentPath} has no valid ensReceiver.`);
        console.warn("   Set ENS_L1_RECEIVER manually before Arbitrum deploy.");
        return;
      }

      process.env.ENS_L1_RECEIVER = ensReceiver;
      console.log(`✅ Loaded ENS_L1_RECEIVER from ${deploymentPath}: ${ensReceiver}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to load ENS_L1_RECEIVER from mainnet deployment JSON: ${errorMsg}`);
      console.warn("   Set ENS_L1_RECEIVER manually before Arbitrum deploy.");
    }
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

    const multisig = this.networkManager.getDeploymentDefault("multisig") ?? "not configured";
    console.log(`\nGovernance: ${multisig} (Green Goods Safe)\n`);

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
    if (!options.broadcast) {
      return false;
    }
    const verifierConfig = this.networkManager.getVerifierConfig(options.network);
    return options.verify && verifierConfig !== null && !options.skipVerification;
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

        // Register cleanup handlers for graceful shutdown signals.
        // Note: "exit" is intentionally excluded — it runs synchronously
        // and cannot await the async cleanup function.
        const signalCleanup = async (): Promise<void> => {
          await cleanup();
          process.exit(0);
        };
        process.on("SIGINT", signalCleanup);
        process.on("SIGTERM", signalCleanup);
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

  /**
   * Auto-populate ENS_L1_RECEIVER in root .env after successful Ethereum mainnet deploy.
   * Uses the freshly written deployments/1-latest.json ensReceiver field.
   */
  private _autoPopulateEnsL1Receiver(options: ParsedOptions): void {
    if (!options.broadcast || options.network !== "mainnet") {
      return;
    }

    try {
      const chainId = this.networkManager.getChainIdString(options.network);
      const deploymentPath = this._resolveDeploymentFilePath(`${chainId}-latest.json`);
      if (!fs.existsSync(deploymentPath)) {
        console.warn(`⚠️  ENS sync skipped: deployment file not found at ${deploymentPath}`);
        return;
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as { ensReceiver?: string };
      const ensReceiver = deployment.ensReceiver;
      if (!ensReceiver || /^0x0+$/i.test(ensReceiver)) {
        console.warn("⚠️  ENS sync skipped: ensReceiver missing or zero in deployment JSON");
        return;
      }

      this._upsertRootEnvVar("ENS_L1_RECEIVER", ensReceiver);
      process.env.ENS_L1_RECEIVER = ensReceiver;
      console.log(`✅ ENS_L1_RECEIVER auto-populated: ${ensReceiver}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  ENS_L1_RECEIVER auto-populate failed: ${errorMsg}`);
      console.warn("   Set ENS_L1_RECEIVER manually in .env before Arbitrum deploy.");
    }
  }

  /**
   * Upsert a key/value entry in the monorepo root .env file.
   */
  private _upsertRootEnvVar(key: string, value: string): void {
    const envPath = path.join(__dirname, "../../../../.env");
    const normalizedLine = `${key}="${value}"`;

    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `${normalizedLine}\n`, "utf8");
      return;
    }

    const current = fs.readFileSync(envPath, "utf8");
    const regex = new RegExp(`^\\s*${key}\\s*=.*$`, "m");

    if (regex.test(current)) {
      const updated = current.replace(regex, normalizedLine);
      fs.writeFileSync(envPath, updated, "utf8");
      return;
    }

    const separator = current.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(envPath, `${current}${separator}${normalizedLine}\n`, "utf8");
  }

  /**
   * Resolve deployment output directory relative to contracts package root.
   */
  private _resolveDeploymentOutputDir(): string {
    const configuredDir = process.env.DEPLOYMENT_OUTPUT_DIR?.trim();
    const outputDir = configuredDir && configuredDir.length > 0 ? configuredDir : "deployments";
    return path.isAbsolute(outputDir) ? outputDir : path.join(__dirname, "../..", outputDir);
  }

  /**
   * Resolve deployment artifact path.
   */
  private _resolveDeploymentFilePath(fileName: string): string {
    return path.join(this._resolveDeploymentOutputDir(), fileName);
  }

  /**
   * Ensure deployment output directory exists before running forge script.
   */
  private _ensureDeploymentOutputDir(): void {
    fs.mkdirSync(this._resolveDeploymentOutputDir(), { recursive: true });
  }
}
