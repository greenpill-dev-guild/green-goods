#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const {
  GARDEN_ABI,
  setupProvider,
  executeWithRetry,
  estimateTransactionCost,
  getExplorerUrl,
} = require("./utils/garden-utils");

class GardenInfoUpdater {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      estimateGas: true,
      ...options,
    };
  }

  async updateGardenInfo(gardenAddress, updates) {
    console.log("\n🏡 Garden Information Update");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);

    const { provider, signer } = await setupProvider(this.options.network);
    console.log(`👤 Operator address: ${signer.address}`);

    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, signer);

    // Get current info
    console.log("\n📍 Current Garden Information:");
    const currentInfo = {};
    try {
      [
        currentInfo.name,
        currentInfo.description,
        currentInfo.location,
        currentInfo.bannerImage,
        currentInfo.communityToken,
      ] = await Promise.all([
        gardenContract.name(),
        gardenContract.description(),
        gardenContract.location(),
        gardenContract.bannerImage(),
        gardenContract.communityToken(),
      ]);

      console.log(`  Name: ${currentInfo.name}`);
      console.log(`  Description: ${currentInfo.description.substring(0, 50)}...`);
      console.log(`  Location: ${currentInfo.location}`);
      console.log(`  Banner: ${currentInfo.bannerImage}`);
      console.log(`  Community Token: ${currentInfo.communityToken}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden: ${error.message}`);
    }

    // Process updates
    const results = {
      successful: [],
      failed: [],
    };

    console.log("\n🔄 Applying Updates:");

    // Update name
    if (updates.name && updates.name !== currentInfo.name) {
      try {
        console.log(`\n📝 Updating name: "${currentInfo.name}" → "${updates.name}"`);

        if (this.options.dryRun) {
          console.log("  [DRY RUN] Would update name");
        } else {
          if (this.options.estimateGas) {
            const gasInfo = await estimateTransactionCost(gardenContract, "updateName", [updates.name], provider);
            if (gasInfo) {
              console.log(`  ⛽ Estimated cost: ${gasInfo.estimatedCost} ETH`);
            }
          }

          await executeWithRetry(async () => {
            const tx = await gardenContract.updateName(updates.name);
            console.log(`  📝 TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
            const receipt = await tx.wait();
            console.log(`  ✅ Name updated (block: ${receipt.blockNumber})`);
          });
        }

        results.successful.push({ field: "name", value: updates.name });
      } catch (error) {
        console.error(`  ❌ Failed to update name: ${error.message}`);
        results.failed.push({ field: "name", error: error.message });
      }
    }

    // Update description
    if (updates.description && updates.description !== currentInfo.description) {
      try {
        console.log("\n📝 Updating description");
        console.log(`  From: "${currentInfo.description.substring(0, 50)}..."`);
        console.log(`  To: "${updates.description.substring(0, 50)}..."`);

        if (this.options.dryRun) {
          console.log("  [DRY RUN] Would update description");
        } else {
          if (this.options.estimateGas) {
            const gasInfo = await estimateTransactionCost(
              gardenContract,
              "updateDescription",
              [updates.description],
              provider,
            );
            if (gasInfo) {
              console.log(`  ⛽ Estimated cost: ${gasInfo.estimatedCost} ETH`);
            }
          }

          await executeWithRetry(async () => {
            const tx = await gardenContract.updateDescription(updates.description);
            console.log(`  📝 TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
            const receipt = await tx.wait();
            console.log(`  ✅ Description updated (block: ${receipt.blockNumber})`);
          });
        }

        results.successful.push({ field: "description", value: updates.description });
      } catch (error) {
        console.error(`  ❌ Failed to update description: ${error.message}`);
        results.failed.push({ field: "description", error: error.message });
      }
    }

    // Note: location and bannerImage are set during initialization and cannot be updated
    if (updates.location) {
      console.log("\n⚠️  Location cannot be updated after garden creation");
    }
    if (updates.bannerImage) {
      console.log("⚠️  Banner image cannot be updated after garden creation");
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successfully updated: ${results.successful.length} field(s)`);
    if (results.successful.length > 0) {
      results.successful.forEach(({ field, value }) => {
        console.log(`  - ${field}: ${value.substring(0, 50)}${value.length > 50 ? "..." : ""}`);
      });
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ Failed updates: ${results.failed.length}`);
      results.failed.forEach(({ field, error }) => {
        console.log(`  - ${field}: ${error}`);
      });
    }

    return results;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Garden Information Update Tool

Usage: node update-garden-info.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Updates (at least one required):
  --name <name>          New garden name
  --description <desc>   New garden description

Options:
  --estimate-gas         Show gas estimates (default: true)
  --dry-run             Simulate only

Examples:
  node update-garden-info.js --chain arbitrum --garden 0x123... --name "New Garden Name"
  node update-garden-info.js --chain arbitrum --garden 0x123... --description "Updated description" --dry-run

Note: Location and banner image cannot be updated after garden creation.
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    dryRun: false,
    estimateGas: true,
  };

  let gardenAddress;
  const updates = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--name") {
      updates.name = args[++i];
    } else if (arg === "--description") {
      updates.description = args[++i];
    } else if (arg === "--location") {
      updates.location = args[++i];
    } else if (arg === "--banner" || arg === "--bannerImage") {
      updates.bannerImage = args[++i];
    } else if (arg === "--estimate-gas") {
      options.estimateGas = args[++i] === "true";
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  if (Object.keys(updates).length === 0) {
    console.error("❌ At least one update field required (--name or --description)");
    process.exit(1);
  }

  try {
    const updater = new GardenInfoUpdater(options);
    await updater.updateGardenInfo(gardenAddress, updates);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenInfoUpdater };
