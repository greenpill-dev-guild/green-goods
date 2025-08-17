#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const {
  GARDEN_ABI,
  setupProvider,
  executeWithRetry,
  estimateTransactionCost,
  loadAddressesFromCSV,
  exportToJSON,
  formatAddress,
  getExplorerUrl,
  batchArray,
  ProgressBar,
} = require("./utils/garden-utils");

class GardenMemberRemover {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      batchSize: 10,
      retryAttempts: 3,
      estimateGas: true,
      exportResults: false,
      force: false,
      ...options,
    };
  }

  async checkMemberStatus(gardenContract, addresses) {
    const status = {
      gardeners: {},
      operators: {},
    };

    const gardenerChecks = addresses.map((addr) => gardenContract.gardeners(addr));
    const operatorChecks = addresses.map((addr) => gardenContract.gardenOperators(addr));

    const [gardenerResults, operatorResults] = await Promise.all([
      Promise.all(gardenerChecks),
      Promise.all(operatorChecks),
    ]);

    addresses.forEach((addr, i) => {
      status.gardeners[addr] = gardenerResults[i];
      status.operators[addr] = operatorResults[i];
    });

    return status;
  }

  async removeMembers(gardenAddress, addresses, options = {}) {
    const { removeAsGardeners = true, removeAsOperators = false } = options;

    console.log("\n🏡 Garden Member Removal");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Total addresses: ${addresses.length}`);
    console.log(`Remove as gardeners: ${removeAsGardeners ? "✅" : "❌"}`);
    console.log(`Remove as operators: ${removeAsOperators ? "✅" : "❌"}`);

    const { provider, signer } = await setupProvider(this.options.network);
    console.log(`\n👤 Operator address: ${signer.address}`);

    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, signer);

    // Verify garden connection
    try {
      const gardenName = await gardenContract.name();
      console.log(`📍 Garden name: ${gardenName}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden: ${error.message}`);
    }

    // Check current status
    console.log("\n🔍 Checking current member status...");
    const currentStatus = await this.checkMemberStatus(gardenContract, addresses);

    const results = {
      successful: [],
      failed: [],
      skipped: [],
    };

    const batches = batchArray(addresses, this.options.batchSize);
    const progress = new ProgressBar(addresses.length, "Removing members");

    for (const batch of batches) {
      for (const address of batch) {
        try {
          let removed = false;

          // Remove as gardener
          if (removeAsGardeners && currentStatus.gardeners[address]) {
            if (this.options.dryRun) {
              console.log(`\n[DRY RUN] Would remove ${formatAddress(address)} as gardener`);
            } else {
              if (this.options.estimateGas) {
                const gasInfo = await estimateTransactionCost(gardenContract, "removeGardener", [address], provider);
                if (gasInfo) {
                  console.log(`\n⛽ Estimated cost: ${gasInfo.estimatedCost} ETH`);
                }
              }

              await executeWithRetry(async () => {
                const tx = await gardenContract.removeGardener(address);
                console.log(`📝 Removing gardener - TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
                await tx.wait();
              }, this.options.retryAttempts);
              removed = true;
            }
          }

          // Remove as operator
          if (removeAsOperators && currentStatus.operators[address]) {
            if (this.options.dryRun) {
              console.log(`[DRY RUN] Would remove ${formatAddress(address)} as operator`);
            } else {
              if (this.options.estimateGas) {
                const gasInfo = await estimateTransactionCost(
                  gardenContract,
                  "removeGardenOperator",
                  [address],
                  provider,
                );
                if (gasInfo) {
                  console.log(`⛽ Estimated cost: ${gasInfo.estimatedCost} ETH`);
                }
              }

              await executeWithRetry(async () => {
                const tx = await gardenContract.removeGardenOperator(address);
                console.log(`📝 Removing operator - TX: ${getExplorerUrl(this.options.network, tx.hash)}`);
                await tx.wait();
              }, this.options.retryAttempts);
              removed = true;
            }
          }

          if (removed) {
            results.successful.push(address);
          } else {
            results.skipped.push(address);
          }
        } catch (error) {
          console.error(`\n❌ Failed to remove ${formatAddress(address)}: ${error.message}`);
          results.failed.push({ address, error: error.message });
          if (!this.options.force) throw error;
        }

        progress.increment();
      }
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successfully removed: ${results.successful.length}`);
    console.log(`⏭️  Skipped (not members): ${results.skipped.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);

    if (this.options.exportResults && !this.options.dryRun) {
      exportToJSON(
        {
          operation: "remove-members",
          garden: gardenAddress,
          network: this.options.network,
          timestamp: new Date().toISOString(),
          results,
        },
        `garden-removal-${Date.now()}.json`,
      );
    }

    return results;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Garden Member Removal Tool

Usage: node remove-garden-members.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Input (choose one):
  --addresses <list>     Comma-separated addresses
  --csv <file>          CSV file with addresses

Options:
  --roles <roles>       Roles to remove: gardener, operator, or both (default: gardener)
  --batch-size <n>      Addresses per batch (default: 10)
  --estimate-gas        Show gas estimates (default: true)
  --export-results      Export results to JSON
  --force              Continue on errors
  --dry-run            Simulate only

Examples:
  node remove-garden-members.js --chain arbitrum --garden 0x123... --addresses 0x456...
  node remove-garden-members.js --chain arbitrum --garden 0x123... --csv members.csv --roles gardener,operator
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    dryRun: false,
    force: false,
    batchSize: 10,
    estimateGas: true,
    exportResults: false,
  };

  let gardenAddress;
  let addresses = [];
  let roles = ["gardener"];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--addresses") {
      addresses = args[++i].split(",").map((a) => a.trim());
    } else if (arg === "--csv") {
      addresses = await loadAddressesFromCSV(args[++i]);
    } else if (arg === "--roles") {
      roles = args[++i].split(",").map((r) => r.trim());
    } else if (arg === "--batch-size") {
      options.batchSize = Number.parseInt(args[++i]);
    } else if (arg === "--estimate-gas") {
      options.estimateGas = args[++i] === "true";
    } else if (arg === "--export-results") {
      options.exportResults = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  if (addresses.length === 0) {
    console.error("❌ No addresses provided");
    process.exit(1);
  }

  try {
    const remover = new GardenMemberRemover(options);
    await remover.removeMembers(gardenAddress, addresses, {
      removeAsGardeners: roles.includes("gardener"),
      removeAsOperators: roles.includes("operator"),
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenMemberRemover };
