import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ActionsConfig, ActionConfig } from "../utils/validation";
import type { DeploymentAddresses } from "../utils/deployment-addresses";
import type { NetworkManager } from "../utils/network";
import { GardenDeployer } from "./gardens";
import type { AnvilManager } from "./anvil";
import type { ParsedOptions } from "../utils/cli-parser";

interface IpfsCacheEntry {
  hash: string;
  title: string;
  uploadedAt: string;
}

/**
 * ActionDeployer - Handles action deployment
 *
 * Extracted from deploy.js - handles deployment of actions from config
 */
export class ActionDeployer extends GardenDeployer {
  constructor(networkManager?: NetworkManager, anvilManager?: AnvilManager, deploymentAddresses?: DeploymentAddresses) {
    super(networkManager, anvilManager, deploymentAddresses);
  }

  /**
   * Deploy actions from config file
   * @param configPath - Path to actions config JSON
   * @param options - Deployment options
   */
  async deployActions(configPath: string, options: ParsedOptions): Promise<void> {
    console.log(`Deploying actions from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this._setEnvironmentFlags(options);

    // Load and validate actions config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as ActionsConfig;
    this.validator.validateActionsConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Actions configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Actions configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses: ReturnType<typeof this.deploymentAddresses.loadForChain>;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load contract addresses: ${errorMsg}`);
      console.error(`Please deploy core contracts first: bun deploy.ts core --network ${options.network} --broadcast`);
      process.exit(1);
    }

    // Upload instructions to IPFS (same as Deploy.s.sol FFI path)
    const ipfsHashes = this._uploadActionsToIPFS(config.actions);

    // Generate and execute actions deployment script
    const solidity = this._generateActionScript(config.actions, contractAddresses.actionRegistry, ipfsHashes);
    const scriptPath = path.join(__dirname, "../temp", "DeployActionsGenerated.s.sol");

    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, solidity);

    try {
      await this._executeForgeScript(`${scriptPath}:DeployActionsGenerated`, options);

      // Save deployment record
      this._saveActionsDeploymentRecord(config, options);
      console.log("\n✅ Actions deployed successfully!");
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log("❌ Failed to cleanup temp file:", errorMsg);
      }
    }
  }

  /**
   * Generate Solidity script for action deployment
   * @param actions - Array of action configurations
   * @param actionRegistryAddress - ActionRegistry contract address
   * @returns Solidity script code
   */
  private _generateActionScript(actions: ActionConfig[], actionRegistryAddress: string, ipfsHashes: string[]): string {
    // Calculate dynamic timestamps: start = now, end = now + 3 months
    const now = new Date();
    const startTime = Math.floor(now.getTime() / 1000);
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const endTime = Math.floor(threeMonthsLater.getTime() / 1000);

    // Log action deployment details for verification
    console.log("\n📋 Actions to be deployed:");
    console.log("─".repeat(60));
    console.log(`  Using dynamic timestamps (ignoring config values):`);
    console.log(`  Start: ${now.toISOString()} → ${startTime}`);
    console.log(`  End:   ${threeMonthsLater.toISOString()} → ${endTime}`);
    console.log("─".repeat(60));
    actions.forEach((action, index) => {
      console.log(`  ${index}: [${action.domain}] ${action.slug} - ${action.title}`);
    });
    console.log("─".repeat(60));

    const actionsCode = actions
      .map((action, index) => {
        // Use dynamic timestamps instead of config values
        const mediaEntries = action.media.map((m, i) => `media${index}[${i}] = "${m}";`).join("\n            ");

        return `
        // Action ${index + 1}: [${action.domain}] ${action.slug} - ${action.title}
        {
            Capital[] memory capitals${index} = new Capital[](${action.capitals.length});
            ${action.capitals.map((capital, i) => `capitals${index}[${i}] = Capital.${capital};`).join("\n            ")}

            string[] memory media${index} = new string[](${action.media.length});
            ${mediaEntries}

            registry.registerAction(
                ${startTime},
                ${endTime},
                "${action.title}",
                "${action.slug}",
                "${ipfsHashes[index]}",
                capitals${index},
                media${index},
                Domain.${action.domain}
            );

            console.log("Registered action: ${action.slug}");
        }`;
      })
      .join("\n");

    return `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";

contract DeployActionsGenerated is Script {
    function run() external {
        vm.startBroadcast();

        ActionRegistry registry = ActionRegistry(${actionRegistryAddress});
        ${actionsCode}

        vm.stopBroadcast();
        console.log("All actions deployed successfully!");
    }
}`;
  }

  /**
   * Upload action instructions to IPFS via ipfs-uploader.ts.
   * Uses npx tsx (NOT bun) — @storacha/client has Bun compat issues.
   * Falls back to .ipfs-cache.json if uploader was run separately.
   */
  private _uploadActionsToIPFS(actions: ActionConfig[]): string[] {
    const cacheFile = path.join(process.cwd(), ".ipfs-cache.json");

    // Try running the uploader script
    try {
      console.log("\n📤 Uploading instructions to IPFS...");
      const result = execFileSync("npx", ["tsx", "script/utils/ipfs-uploader.ts"], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "inherit"], // stderr shown to user
        timeout: 120_000,
      });
      const hashes = JSON.parse(result.toString().trim()) as string[];
      if (hashes.length === actions.length) {
        console.log(`✅ IPFS upload complete: ${hashes.length} instruction documents`);
        return hashes;
      }
      console.error(`⚠️ IPFS upload returned ${hashes.length} hashes for ${actions.length} actions`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`⚠️ IPFS uploader failed: ${msg}`);
    }

    // Fallback: read from cache
    console.log("📋 Falling back to IPFS cache...");
    if (!fs.existsSync(cacheFile)) {
      console.error("❌ No IPFS cache found. Run: npx tsx script/utils/ipfs-uploader.ts");
      process.exit(1);
    }

    const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as Record<string, IpfsCacheEntry>;
    const hashes: string[] = [];

    for (let i = 0; i < actions.length; i++) {
      const serialized = JSON.stringify(actions[i]);
      const hash = createHash("sha256").update(serialized).digest("hex");
      const cacheKey = `${i}-${hash}`;
      const entry = cache[cacheKey];

      if (!entry?.hash) {
        console.error(`❌ Missing IPFS cache for action ${i} (${actions[i].title})`);
        console.error("Run: npx tsx script/utils/ipfs-uploader.ts");
        process.exit(1);
      }
      hashes.push(entry.hash);
    }

    console.log(`✅ Loaded ${hashes.length} CIDs from cache`);
    return hashes;
  }

  /**
   * Save actions deployment record
   * @param config - Actions configuration
   * @param options - Deployment options
   */
  private _saveActionsDeploymentRecord(config: ActionsConfig, options: ParsedOptions): void {
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    const deploymentRecord = {
      actions: config.actions,
      timestamp: new Date().toISOString(),
      network: options.network,
      deployer: keystoreName,
    };

    const recordPath = path.join(__dirname, "../..", "deployments", "actions", `batch-${Date.now()}.json`);

    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

    console.log(`Deployment record saved to: ${recordPath}`);
  }
}
