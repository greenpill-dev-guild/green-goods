#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const { GARDEN_ABI, setupProvider, exportToJSON, exportToCSV, formatAddress } = require("./utils/garden-utils");

class GardenStatusChecker {
  constructor(options = {}) {
    this.options = {
      network: "localhost",
      exportFormat: null, // json, csv, or null
      includeEvents: false,
      fromBlock: 0,
      ...options,
    };
  }

  async getGardenStatus(gardenAddress) {
    console.log("\n🏡 Garden Status Report");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const { provider } = await setupProvider(this.options.network);
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, provider);

    // Get basic info
    console.log("\n📍 Garden Information:");
    const info = {};
    try {
      [info.name, info.description, info.location, info.bannerImage, info.communityToken] = await Promise.all([
        gardenContract.name(),
        gardenContract.description(),
        gardenContract.location(),
        gardenContract.bannerImage(),
        gardenContract.communityToken(),
      ]);

      console.log(`  Name: ${info.name}`);
      console.log(`  Description: ${info.description.substring(0, 100)}${info.description.length > 100 ? "..." : ""}`);
      console.log(`  Location: ${info.location}`);
      console.log(`  Banner IPFS: ${info.bannerImage}`);
      console.log(`  Community Token: ${info.communityToken}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden: ${error.message}`);
    }

    // Get members from events
    const members = {
      gardeners: new Set(),
      operators: new Set(),
    };

    if (this.options.includeEvents) {
      console.log("\n🔍 Scanning events for members...");

      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = this.options.fromBlock === "latest" ? currentBlock - 1000 : this.options.fromBlock;

        // Get gardener events
        const [addedGardeners, removedGardeners, addedOperators, removedOperators] = await Promise.all([
          gardenContract.queryFilter("GardenerAdded", fromBlock, currentBlock),
          gardenContract.queryFilter("GardenerRemoved", fromBlock, currentBlock),
          gardenContract.queryFilter("GardenOperatorAdded", fromBlock, currentBlock),
          gardenContract.queryFilter("GardenOperatorRemoved", fromBlock, currentBlock),
        ]);

        // Process gardener events
        addedGardeners.forEach((event) => members.gardeners.add(event.args.gardener));
        removedGardeners.forEach((event) => members.gardeners.delete(event.args.gardener));

        // Process operator events
        addedOperators.forEach((event) => members.operators.add(event.args.operator));
        removedOperators.forEach((event) => members.operators.delete(event.args.operator));

        console.log(`  Scanned blocks ${fromBlock} to ${currentBlock}`);
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch events: ${error.message}`);
      }
    }

    // Sample check for known addresses (if members were found via events)
    const gardenersList = Array.from(members.gardeners);
    const operatorsList = Array.from(members.operators);

    if (gardenersList.length > 0 || operatorsList.length > 0) {
      console.log("\n👥 Members:");

      if (gardenersList.length > 0) {
        console.log(`\n  Gardeners (${gardenersList.length}):`);
        for (const gardener of gardenersList.slice(0, 10)) {
          const isActive = await gardenContract.gardeners(gardener);
          console.log(`    ${formatAddress(gardener)} - ${isActive ? "✅ Active" : "❌ Inactive"}`);
        }
        if (gardenersList.length > 10) {
          console.log(`    ... and ${gardenersList.length - 10} more`);
        }
      }

      if (operatorsList.length > 0) {
        console.log(`\n  Operators (${operatorsList.length}):`);
        for (const operator of operatorsList.slice(0, 10)) {
          const isActive = await gardenContract.gardenOperators(operator);
          console.log(`    ${formatAddress(operator)} - ${isActive ? "✅ Active" : "❌ Inactive"}`);
        }
        if (operatorsList.length > 10) {
          console.log(`    ... and ${operatorsList.length - 10} more`);
        }
      }
    }

    // Statistics
    console.log("\n📊 Statistics:");
    console.log(`  Total Gardeners: ${gardenersList.length}`);
    console.log(`  Total Operators: ${operatorsList.length}`);
    console.log(`  Network: ${this.options.network}`);
    console.log(`  Block Number: ${await provider.getBlockNumber()}`);

    // Prepare export data
    const exportData = {
      garden: {
        address: gardenAddress,
        ...info,
      },
      members: {
        gardeners: gardenersList,
        operators: operatorsList,
      },
      statistics: {
        totalGardeners: gardenersList.length,
        totalOperators: operatorsList.length,
        network: this.options.network,
        blockNumber: await provider.getBlockNumber(),
        timestamp: new Date().toISOString(),
      },
    };

    // Export if requested
    if (this.options.exportFormat === "json") {
      exportToJSON(exportData, `garden-status-${Date.now()}.json`);
    } else if (this.options.exportFormat === "csv") {
      // Export gardeners
      if (gardenersList.length > 0) {
        const gardenerData = await Promise.all(
          gardenersList.map(async (addr) => ({
            address: addr,
            role: "gardener",
            active: await gardenContract.gardeners(addr),
          })),
        );
        exportToCSV(gardenerData, ["address", "role", "active"], `garden-gardeners-${Date.now()}.csv`);
      }

      // Export operators
      if (operatorsList.length > 0) {
        const operatorData = await Promise.all(
          operatorsList.map(async (addr) => ({
            address: addr,
            role: "operator",
            active: await gardenContract.gardenOperators(addr),
          })),
        );
        exportToCSV(operatorData, ["address", "role", "active"], `garden-operators-${Date.now()}.csv`);
      }
    }

    return exportData;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Garden Status Tool

Usage: node garden-status.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Options:
  --export <format>      Export format: json or csv
  --include-events       Fetch member list from events
  --from-block <n>       Starting block for event scan (default: 0)

Examples:
  node garden-status.js --chain arbitrum --garden 0x123...
  node garden-status.js --chain arbitrum --garden 0x123... --export json
  node garden-status.js --chain arbitrum --garden 0x123... --include-events --from-block 1000000
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    exportFormat: null,
    includeEvents: false,
    fromBlock: 0,
  };

  let gardenAddress;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--export") {
      options.exportFormat = args[++i];
    } else if (arg === "--include-events") {
      options.includeEvents = true;
    } else if (arg === "--from-block") {
      const value = args[++i];
      options.fromBlock = value === "latest" ? value : Number.parseInt(value);
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  try {
    const checker = new GardenStatusChecker(options);
    await checker.getGardenStatus(gardenAddress);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenStatusChecker };
