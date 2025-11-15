#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

// Action Registry ABI
const ACTION_REGISTRY_ABI = [
  "function registerAction(uint256 startTime, uint256 endTime, string memory title, string memory instructions, uint8[] memory capitals, string[] memory media) external returns (uint256)",
  "function updateActionStartTime(uint256 actionUID, uint256 startTime) external",
  "function updateActionEndTime(uint256 actionUID, uint256 endTime) external",
  "function updateActionTitle(uint256 actionUID, string memory title) external",
  "function updateActionInstructions(uint256 actionUID, string memory instructions) external",
  "function updateActionCapitals(uint256 actionUID, uint8[] memory capitals) external",
  "function updateActionMedia(uint256 actionUID, string[] memory media) external",
  "function getAction(uint256 actionUID) external view returns (tuple(uint256 startTime, uint256 endTime, string title, string instructions, uint8[] capitals, string[] media))",
  "function actionCounter() external view returns (uint256)",
];

// Capital types enum
const CAPITAL_TYPES = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

// Network configurations
const NETWORK_CONFIG = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    blockTime: 1,
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    blockTime: 0.25,
  },
  "base-sepolia": {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
    blockTime: 2,
  },
  celo: {
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    chainId: 42220,
    blockTime: 5,
  },
};

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get private key from environment variables
 */
function getPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "Missing required environment variable: PRIVATE_KEY\n" +
        "Please set PRIVATE_KEY in your .env file\n" +
        "For production deployments, use Foundry keystore instead:\n" +
        "  1. Import your key: cast wallet import <account-name> --interactive\n" +
        "  2. Use --account flag: forge script --account <account-name>",
    );
  }

  return privateKey;
}

/**
 * Setup provider and signer for a network
 */
async function setupProvider(network) {
  const networkConfig = NETWORK_CONFIG[network];
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const privateKey = getPrivateKey();
  const signer = new ethers.Wallet(privateKey, provider);

  return { provider, signer, networkConfig };
}

/**
 * Execute function with retry logic
 */
async function executeWithRetry(fn, retries = 3, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")) {
      console.log(`  ⚠️  Network error, retrying... (${retries} attempts left)`);
      await sleep(delay);
      return executeWithRetry(fn, retries - 1, delay);
    }
    throw error;
  }
}

/**
 * Estimate gas and cost for a transaction
 */
async function estimateTransactionCost(contract, method, args, provider) {
  try {
    const gasEstimate = await contract[method].estimateGas(...args);
    const feeData = await provider.getFeeData();
    const estimatedCost = gasEstimate * feeData.gasPrice;

    return {
      gasLimit: gasEstimate,
      gasPrice: feeData.gasPrice,
      estimatedCost: ethers.formatEther(estimatedCost),
      estimatedCostGwei: ethers.formatUnits(feeData.gasPrice, "gwei"),
    };
  } catch (error) {
    console.warn("  ⚠️  Could not estimate gas:", error.message);
    return null;
  }
}

/**
 * Export data to JSON file
 */
function exportToJSON(data, filename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalFilename = filename || `export-${timestamp}.json`;
  fs.writeFileSync(finalFilename, JSON.stringify(data, null, 2));
  console.log(`💾 Data exported to ${finalFilename}`);
  return finalFilename;
}

/**
 * Get block explorer URL for transaction
 */
function getExplorerUrl(network, txHash) {
  const urls = {
    sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    "arbitrum-sepolia": `https://sepolia.arbiscan.io/tx/${txHash}`,
    celo: `https://celoscan.io/tx/${txHash}`,
    "celo-testnet": `https://alfajores.celoscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    "base-sepolia": `https://sepolia.basescan.org/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
  };

  return urls[network] || `Transaction: ${txHash}`;
}

/**
 * Load deployment addresses for a network
 */
function loadDeploymentAddresses(network) {
  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${NETWORK_CONFIG[network]?.chainId || network}-latest.json`,
  );

  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return deployment.contracts || {};
  }

  return {};
}

class ActionManager {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      estimateGas: true,
      ...options,
    };
  }

  parseCapitals(capitalStrings) {
    return capitalStrings.map((capital) => {
      const upperCapital = capital.toUpperCase();
      if (CAPITAL_TYPES[upperCapital] !== undefined) {
        return CAPITAL_TYPES[upperCapital];
      }
      throw new Error(`Invalid capital type: ${capital}`);
    });
  }

  formatCapitals(capitalNumbers) {
    const capitalNames = Object.entries(CAPITAL_TYPES);
    return capitalNumbers.map((num) => {
      const found = capitalNames.find(([_, value]) => value === num);
      return found ? found[0] : `UNKNOWN(${num})`;
    });
  }

  async loadActionsFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Actions file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    if (!data.actions || !Array.isArray(data.actions)) {
      throw new Error("Invalid actions file: 'actions' array required");
    }

    return data.actions;
  }

  async registerActions(actions) {
    console.log("\n🎯 Action Registration");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Network: ${this.options.network}`);
    console.log(`Total actions: ${actions.length}`);

    const { signer } = await setupProvider(this.options.network);
    console.log(`👤 Deployer address: ${signer.address}`);

    // Get ActionRegistry address from deployments
    const deploymentAddresses = loadDeploymentAddresses(this.options.network);
    const actionRegistryAddress = deploymentAddresses.ActionRegistry;

    if (!actionRegistryAddress) {
      throw new Error(`ActionRegistry not found in deployments for ${this.options.network}`);
    }

    console.log(`📝 ActionRegistry: ${actionRegistryAddress}`);

    const actionRegistry = new ethers.Contract(actionRegistryAddress, ACTION_REGISTRY_ABI, signer);

    const results = {
      successful: [],
      failed: [],
    };

    for (const [index, action] of actions.entries()) {
      console.log(`\n📋 Action ${index + 1}/${actions.length}: ${action.title}`);

      try {
        // Parse timestamps
        const startTime = Math.floor(new Date(action.startTime).getTime() / 1000);
        const endTime = Math.floor(new Date(action.endTime).getTime() / 1000);

        // Parse capitals
        const capitals = this.parseCapitals(action.capitals);

        console.log(`  Start: ${new Date(startTime * 1000).toISOString()}`);
        console.log(`  End: ${new Date(endTime * 1000).toISOString()}`);
        console.log(`  Capitals: ${action.capitals.join(", ")}`);
        console.log(`  Media items: ${action.media.length}`);

        if (this.options.dryRun) {
          console.log("  [DRY RUN] Would register action");
        } else {
          if (this.options.estimateGas) {
            const gasInfo = await estimateTransactionCost(
              actionRegistry,
              "registerAction",
              [startTime, endTime, action.title, action.instructions, capitals, action.media],
              provider,
            );
            if (gasInfo) {
              console.log(`  ⛽ Estimated cost: ${gasInfo.estimatedCost} ETH`);
            }
          }

          await executeWithRetry(async () => {
            const tx = await actionRegistry.registerAction(
              startTime,
              endTime,
              action.title,
              action.instructions,
              capitals,
              action.media,
            );
            console.log(`  📝 TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
            const receipt = await tx.wait();

            // Get action UID from event
            const event = receipt.logs.find((log) => {
              try {
                const parsed = actionRegistry.interface.parseLog(log);
                return parsed && parsed.name === "ActionRegistered";
              } catch {
                return false;
              }
            });

            const actionUID = event ? actionRegistry.interface.parseLog(event).args.actionUID : "unknown";

            console.log(`  ✅ Registered with UID: ${actionUID}`);
            results.successful.push({ ...action, actionUID, txHash: tx.hash });
          });
        }
      } catch (error) {
        console.error(`  ❌ Failed to register: ${error.message}`);
        results.failed.push({ action, error: error.message });
      }
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successfully registered: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);

    if (results.successful.length > 0) {
      console.log("\nRegistered Actions:");
      results.successful.forEach((action) => {
        console.log("  - " + action.title + " (UID: " + action.actionUID + ")");
      });
    }

    return results;
  }

  async updateAction(actionUID, updates) {
    console.log("\n🎯 Action Update");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Action UID: ${actionUID}`);
    console.log(`Network: ${this.options.network}`);

    const { signer } = await setupProvider(this.options.network);
    const deploymentAddresses = loadDeploymentAddresses(this.options.network);
    const actionRegistryAddress = deploymentAddresses.ActionRegistry;

    if (!actionRegistryAddress) {
      throw new Error(`ActionRegistry not found in deployments for ${this.options.network}`);
    }

    const actionRegistry = new ethers.Contract(actionRegistryAddress, ACTION_REGISTRY_ABI, signer);

    // Get current action data
    console.log("\n📍 Current action data:");
    try {
      const currentAction = await actionRegistry.getAction(actionUID);
      console.log(`  Title: ${currentAction.title}`);
      console.log(`  Start: ${new Date(currentAction.startTime * 1000).toISOString()}`);
      console.log(`  End: ${new Date(currentAction.endTime * 1000).toISOString()}`);
    } catch (error) {
      throw new Error(`Failed to fetch action ${actionUID}: ${error.message}`);
    }

    const results = [];

    // Process updates
    for (const [field, value] of Object.entries(updates)) {
      try {
        console.log(`\n🔄 Updating ${field}...`);

        if (this.options.dryRun) {
          console.log(`  [DRY RUN] Would update ${field}`);
          continue;
        }

        let tx;
        switch (field) {
          case "startTime": {
            const startTime = Math.floor(new Date(value).getTime() / 1000);
            tx = await actionRegistry.updateActionStartTime(actionUID, startTime);
            break;
          }
          case "endTime": {
            const endTime = Math.floor(new Date(value).getTime() / 1000);
            tx = await actionRegistry.updateActionEndTime(actionUID, endTime);
            break;
          }
          case "title": {
            tx = await actionRegistry.updateActionTitle(actionUID, value);
            break;
          }
          case "instructions": {
            tx = await actionRegistry.updateActionInstructions(actionUID, value);
            break;
          }
          case "capitals": {
            const capitals = this.parseCapitals(value);
            tx = await actionRegistry.updateActionCapitals(actionUID, capitals);
            break;
          }
          case "media": {
            tx = await actionRegistry.updateActionMedia(actionUID, value);
            break;
          }
          default: {
            console.warn("  ⚠️  Unknown field: " + field);
            continue;
          }
        }

        if (tx) {
          console.log(`  📝 TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
          await tx.wait();
          console.log(`  ✅ ${field} updated`);
          results.push({ field, success: true });
        }
      } catch (error) {
        console.error(`  ❌ Failed to update ${field}: ${error.message}`);
        results.push({ field, success: false, error: error.message });
      }
    }

    return results;
  }

  async listActions() {
    console.log("\n🎯 Action List");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Network: ${this.options.network}`);

    const { provider } = await setupProvider(this.options.network);
    const deploymentAddresses = loadDeploymentAddresses(this.options.network);
    const actionRegistryAddress = deploymentAddresses.ActionRegistry;

    if (!actionRegistryAddress) {
      throw new Error(`ActionRegistry not found in deployments for ${this.options.network}`);
    }

    console.log(`📝 ActionRegistry: ${actionRegistryAddress}`);

    const actionRegistry = new ethers.Contract(actionRegistryAddress, ACTION_REGISTRY_ABI, provider);

    // Get action counter
    const actionCounter = await actionRegistry.actionCounter();
    console.log("\nTotal actions registered: " + actionCounter + "\n");

    const actions = [];

    // Fetch all actions
    for (let i = 1; i <= actionCounter; i++) {
      try {
        const action = await actionRegistry.getAction(i);
        const now = Date.now() / 1000;
        const status = now < action.startTime ? "upcoming" : now > action.endTime ? "ended" : "active";

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Action #" + i + ": " + action.title);
        console.log("  Status: " + String(status).toUpperCase());
        console.log("  Start: " + new Date(action.startTime * 1000).toISOString());
        console.log("  End: " + new Date(action.endTime * 1000).toISOString());
        console.log("  Capitals: " + this.formatCapitals(action.capitals).join(", "));
        console.log("  Media items: " + action.media.length);
        console.log(
          "  Instructions: " + action.instructions.substring(0, 100) + (action.instructions.length > 100 ? "..." : ""),
        );

        actions.push({
          uid: i,
          title: action.title,
          status,
          startTime: new Date(action.startTime * 1000).toISOString(),
          endTime: new Date(action.endTime * 1000).toISOString(),
          capitals: this.formatCapitals(action.capitals),
          media: action.media,
          instructions: action.instructions,
        });
      } catch (error) {
        console.error(`  ❌ Failed to fetch action ${i}: ${error.message}`);
      }
    }

    if (this.options.export) {
      exportToJSON({ actions }, `actions-list-${Date.now()}.json`);
    }

    return actions;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🎯 Action Manager Tool

Usage: node action-manager.js <command> --chain <network> [options]

Commands:
  register              Register new actions from JSON file
  update                Update existing action
  list                  List all registered actions

Register Command:
  node action-manager.js register --chain <network> --file <actions.json> [--dry-run]

Update Command:
  node action-manager.js update --chain <network> --uid <action-uid> [options]
  Options:
    --start-time <ISO>     Update start time
    --end-time <ISO>       Update end time
    --title <title>        Update title
    --instructions <text>  Update instructions
    --capitals <list>      Update capitals (comma-separated)
    --media <list>         Update media hashes (comma-separated)

List Command:
  node action-manager.js list --chain <network> [--export]

Examples:
  # Register actions from file
  node action-manager.js register --chain arbitrum --file actions.json

  # Update action end time
  node action-manager.js update --chain arbitrum --uid 1 --end-time "2024-12-31T23:59:59Z"

  # List all actions
  node action-manager.js list --chain arbitrum --export

Action File Format:
{
  "actions": [
    {
      "title": "Action Title",
      "instructions": "Detailed instructions",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-12-31T23:59:59Z",
      "capitals": ["LIVING", "INTELLECTUAL", "MATERIAL"],
      "media": ["QmHash1", "QmHash2"]
    }
  ]
}
    `);
    process.exit(0);
  }

  const command = args[0];
  const options = {
    network: "localhost",
    dryRun: false,
    estimateGas: true,
  };

  // Parse common options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--estimate-gas") {
      options.estimateGas = args[++i] === "true";
    }
  }

  try {
    const manager = new ActionManager(options);

    switch (command) {
      case "register": {
        let actionsFile;
        for (let i = 1; i < args.length; i++) {
          if (args[i] === "--file") {
            actionsFile = args[++i];
          }
        }

        if (!actionsFile) {
          console.error("❌ --file required for register command");
          process.exit(1);
        }

        const actions = await manager.loadActionsFromFile(actionsFile);
        await manager.registerActions(actions);
        break;
      }

      case "update": {
        let actionUID;
        const updates = {};

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg === "--uid") {
            actionUID = Number.parseInt(args[++i]);
          } else if (arg === "--start-time") {
            updates.startTime = args[++i];
          } else if (arg === "--end-time") {
            updates.endTime = args[++i];
          } else if (arg === "--title") {
            updates.title = args[++i];
          } else if (arg === "--instructions") {
            updates.instructions = args[++i];
          } else if (arg === "--capitals") {
            updates.capitals = args[++i].split(",").map((c) => c.trim());
          } else if (arg === "--media") {
            updates.media = args[++i].split(",").map((m) => m.trim());
          }
        }

        if (!actionUID) {
          console.error("❌ --uid required for update command");
          process.exit(1);
        }

        if (Object.keys(updates).length === 0) {
          console.error("❌ At least one update field required");
          process.exit(1);
        }

        await manager.updateAction(actionUID, updates);
        break;
      }

      case "list": {
        options.export = args.includes("--export");
        await manager.listActions();
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error("Use --help to see available commands");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ActionManager };
