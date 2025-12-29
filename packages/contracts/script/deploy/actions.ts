import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigValidator, type ActionsConfig, type ActionConfig } from "../utils/validation";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { GardenDeployer } from "./gardens";
import type { ParsedOptions } from "../utils/cli-parser";

/**
 * ActionDeployer - Handles action deployment
 *
 * Extracted from deploy.js - handles deployment of actions from config
 */
export class ActionDeployer extends GardenDeployer {
  constructor() {
    super();
    this.validator = new ConfigValidator();
    this.deploymentAddresses = new DeploymentAddresses();
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

    // Generate and execute actions deployment script
    const solidity = this._generateActionScript(config.actions, contractAddresses.actionRegistry);
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
  private _generateActionScript(actions: ActionConfig[], actionRegistryAddress: string): string {
    // Log action deployment details for verification
    console.log("\n📋 Actions to be deployed:");
    console.log("─".repeat(60));
    actions.forEach((action, index) => {
      const startTime = Math.floor(new Date(action.startTime).getTime() / 1000);
      const endTime = Math.floor(new Date(action.endTime).getTime() / 1000);
      console.log(`  ${index}: ${action.title}`);
      console.log(`     Start: ${action.startTime} → ${startTime}`);
      console.log(`     End:   ${action.endTime} → ${endTime}`);
      console.log(`     End (verified): ${new Date(endTime * 1000).toISOString()}`);
    });
    console.log("─".repeat(60));

    const actionsCode = actions
      .map((action, index) => {
        const startTime = Math.floor(new Date(action.startTime).getTime() / 1000);
        const endTime = Math.floor(new Date(action.endTime).getTime() / 1000);

        return `
        // Action ${index + 1}: ${action.title}
        {
            Capital[] memory capitals${index} = new Capital[](${action.capitals.length});
            ${action.capitals.map((capital, i) => `capitals${index}[${i}] = Capital.${capital};`).join("\n            ")}
            
            string[] memory media${index} = new string[](${action.media.length});
            ${action.media.map((m, i) => `media${index}[${i}] = "${m}";`).join("\n            ")}
            
            registry.registerAction(
                ${startTime},
                ${endTime},
                "${action.title}",
                "${action.instructions}",
                capitals${index},
                media${index}
            );
            
            console.log("Registered action: ${action.title}");
        }`;
      })
      .join("\n");

    return `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ActionRegistry, Capital } from "../../src/registries/Action.sol";

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
