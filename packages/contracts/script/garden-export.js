#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("node:fs");
const { GARDEN_ABI, setupProvider } = require("./utils/garden-utils");

class GardenExporter {
  constructor(options = {}) {
    this.options = {
      network: "localhost",
      format: "json", // json or csv
      includeInactive: false,
      scanDepth: 10000, // blocks to scan back
      ...options,
    };
  }

  async scanForMembers(gardenContract, provider) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - this.options.scanDepth);

    console.log(`  Scanning blocks ${fromBlock} to ${currentBlock}...`);

    // Get all relevant events using event names directly
    let gardenerAddedEvents = [];
    let gardenerRemovedEvents = [];
    let operatorAddedEvents = [];
    let operatorRemovedEvents = [];

    try {
      [gardenerAddedEvents, gardenerRemovedEvents, operatorAddedEvents, operatorRemovedEvents] = await Promise.all([
        gardenContract.queryFilter("GardenerAdded", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenerRemoved", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenOperatorAdded", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenOperatorRemoved", fromBlock, currentBlock),
      ]);
    } catch (_error) {
      console.warn("  ⚠️  Could not fetch all events, trying alternative approach...");
      // Fallback: just return empty arrays if events can't be fetched
    }

    // Build member lists from events
    const gardeners = new Map();
    const operators = new Map();

    // Process gardener events chronologically
    const allGardenerEvents = [
      ...gardenerAddedEvents.map((e) => ({ ...e, type: "add" })),
      ...gardenerRemovedEvents.map((e) => ({ ...e, type: "remove" })),
    ].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

    for (const event of allGardenerEvents) {
      const address = event.args.gardener;
      if (event.type === "add") {
        gardeners.set(address, true);
      } else {
        gardeners.set(address, false);
      }
    }

    // Process operator events chronologically
    const allOperatorEvents = [
      ...operatorAddedEvents.map((e) => ({ ...e, type: "add" })),
      ...operatorRemovedEvents.map((e) => ({ ...e, type: "remove" })),
    ].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

    for (const event of allOperatorEvents) {
      const address = event.args.operator;
      if (event.type === "add") {
        operators.set(address, true);
      } else {
        operators.set(address, false);
      }
    }

    return { gardeners, operators };
  }

  async exportGardenData(gardenAddress, outputFile) {
    console.log("\n🏡 Garden Data Export");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Format: ${this.options.format.toUpperCase()}`);

    const { provider } = await setupProvider(this.options.network);
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, provider);

    // Get garden info
    console.log("\n📍 Fetching garden information...");
    const [name, description, location, bannerImage, communityToken] = await Promise.all([
      gardenContract.name(),
      gardenContract.description(),
      gardenContract.location(),
      gardenContract.bannerImage(),
      gardenContract.communityToken(),
    ]);

    console.log(`  Name: ${name}`);
    console.log(`  Location: ${location}`);

    // Scan for members
    console.log("\n🔍 Scanning for members...");
    const { gardeners, operators } = await this.scanForMembers(gardenContract, provider);

    // Verify current status for each member
    console.log("\n✅ Verifying current member status...");
    const memberData = [];
    const allAddresses = new Set([...gardeners.keys(), ...operators.keys()]);

    for (const address of allAddresses) {
      const [isGardener, isOperator] = await Promise.all([
        gardenContract.gardeners(address),
        gardenContract.gardenOperators(address),
      ]);

      const wasGardener = gardeners.get(address) || false;
      const wasOperator = operators.get(address) || false;

      // Include member if currently active or if includeInactive is true
      if (isGardener || isOperator || this.options.includeInactive) {
        memberData.push({
          address,
          isGardener,
          isOperator,
          wasGardener,
          wasOperator,
          status: isGardener || isOperator ? "active" : "inactive",
        });
      }
    }

    console.log(`  Found ${memberData.length} total members`);
    console.log(`  Active gardeners: ${memberData.filter((m) => m.isGardener).length}`);
    console.log(`  Active operators: ${memberData.filter((m) => m.isOperator).length}`);

    // Export based on format
    if (this.options.format === "json") {
      const exportData = {
        garden: {
          address: gardenAddress,
          name,
          description,
          location,
          bannerImage,
          communityToken,
        },
        members: memberData,
        metadata: {
          network: this.options.network,
          exportedAt: new Date().toISOString(),
          totalMembers: memberData.length,
          activeGardeners: memberData.filter((m) => m.isGardener).length,
          activeOperators: memberData.filter((m) => m.isOperator).length,
        },
      };

      const filename = outputFile || `garden-export-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
      console.log(`\n💾 Data exported to ${filename}`);

      return exportData;
    }
    if (this.options.format === "csv") {
      // Prepare CSV data
      const csvData = memberData.map((member) => ({
        address: member.address,
        is_gardener: member.isGardener ? "YES" : "NO",
        is_operator: member.isOperator ? "YES" : "NO",
        status: member.status,
        was_gardener: member.wasGardener ? "YES" : "NO",
        was_operator: member.wasOperator ? "YES" : "NO",
      }));

      const headers = ["address", "is_gardener", "is_operator", "status", "was_gardener", "was_operator"];
      const csvContent = [
        `# Garden: ${name}`,
        `# Address: ${gardenAddress}`,
        `# Network: ${this.options.network}`,
        `# Exported: ${new Date().toISOString()}`,
        "",
        headers.join(","),
        ...csvData.map((row) => headers.map((h) => row[h] || "").join(",")),
      ].join("\n");

      const filename = outputFile || `garden-export-${Date.now()}.csv`;
      fs.writeFileSync(filename, csvContent);
      console.log(`\n💾 Data exported to ${filename}`);

      return csvData;
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Garden Data Export Tool

Usage: node garden-export.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Options:
  --format <type>        Export format: json or csv (default: json)
  --output <file>        Output filename
  --include-inactive     Include inactive members
  --scan-depth <blocks>  Number of blocks to scan (default: 10000)

Examples:
  node garden-export.js --chain arbitrum --garden 0x123... --format json
  node garden-export.js --chain arbitrum --garden 0x123... --format csv --output members.csv
  node garden-export.js --chain arbitrum --garden 0x123... --include-inactive --scan-depth 50000
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    format: "json",
    includeInactive: false,
    scanDepth: 10000,
  };

  let gardenAddress;
  let outputFile;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--format") {
      options.format = args[++i].toLowerCase();
    } else if (arg === "--output") {
      outputFile = args[++i];
    } else if (arg === "--include-inactive") {
      options.includeInactive = true;
    } else if (arg === "--scan-depth") {
      options.scanDepth = Number.parseInt(args[++i]);
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  if (!["json", "csv"].includes(options.format)) {
    console.error("❌ Format must be 'json' or 'csv'");
    process.exit(1);
  }

  try {
    const exporter = new GardenExporter(options);
    await exporter.exportGardenData(gardenAddress, outputFile);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenExporter };
