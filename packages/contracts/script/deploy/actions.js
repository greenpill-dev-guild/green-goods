const fs = require("node:fs");
const path = require("node:path");
const { ConfigValidator } = require("../utils/validation");
const { DeploymentAddresses } = require("../utils/deployment-addresses");
const { GardenDeployer } = require("./gardens");

/**
 * ActionDeployer - Handles action deployment
 *
 * Extracted from deploy.js - handles deployment of actions from config
 */
class ActionDeployer extends GardenDeployer {
  constructor() {
    super();
    this.validator = new ConfigValidator();
    this.deploymentAddresses = new DeploymentAddresses();
  }

  /**
   * Deploy actions from config file
   * @param {string} configPath - Path to actions config JSON
   * @param {Object} options - Deployment options
   */
  async deployActions(configPath, options) {
    console.log(`Deploying actions from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this._setEnvironmentFlags(options);

    // Load and validate actions config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    this.validator.validateActionsConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Actions configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Actions configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
    } catch (error) {
      console.error(`❌ Failed to load contract addresses: ${error.message}`);
      console.error(`Please deploy core contracts first: node deploy.js core --network ${options.network} --broadcast`);
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
        console.log("❌ Failed to cleanup temp file:", e.message);
      }
    }
  }

  /**
   * Generate Solidity script for action deployment
   * @param {Array} actions - Array of action configurations
   * @param {string} actionRegistryAddress - ActionRegistry contract address
   * @returns {string} Solidity script code
   */
  _generateActionScript(actions, actionRegistryAddress) {
    const capitalMapping = this.validator.getCapitalMapping();

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
   * @param {Object} config - Actions configuration
   * @param {Object} options - Deployment options
   */
  _saveActionsDeploymentRecord(config, options) {
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

module.exports = { ActionDeployer };
