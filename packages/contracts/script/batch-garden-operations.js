#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("node:fs");
const {
  GARDEN_ABI,
  setupProvider,
  executeWithRetry,
  estimateTransactionCost,
  exportToJSON,
  formatAddress,
  ProgressBar,
} = require("./utils/garden-utils");

class BatchGardenOperations {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      estimateGas: true,
      continueOnError: true,
      exportResults: false,
      ...options,
    };
  }

  async loadOperationsConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    // Validate config structure
    if (!config.gardens || !Array.isArray(config.gardens)) {
      throw new Error("Invalid config: 'gardens' array required");
    }

    return config;
  }

  async executeOperations(config) {
    console.log("\n🏡 Batch Garden Operations");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Network: ${this.options.network}`);
    console.log(`Total gardens: ${config.gardens.length}`);

    const { signer } = await setupProvider(this.options.network);
    console.log(`👤 Operator address: ${signer.address}`);

    const results = {
      successful: [],
      failed: [],
    };

    // Calculate total operations
    let totalOps = 0;
    config.gardens.forEach((garden) => {
      if (garden.addGardeners) totalOps += garden.addGardeners.length;
      if (garden.removeGardeners) totalOps += garden.removeGardeners.length;
      if (garden.addOperators) totalOps += garden.addOperators.length;
      if (garden.removeOperators) totalOps += garden.removeOperators.length;
      if (garden.updateName) totalOps++;
      if (garden.updateDescription) totalOps++;
    });

    const progress = new ProgressBar(totalOps, "Processing operations");

    for (const gardenConfig of config.gardens) {
      const { address } = gardenConfig;

      if (!ethers.isAddress(address)) {
        console.error(`\n❌ Invalid garden address: ${address}`);
        results.failed.push({ garden: address, error: "Invalid address" });
        continue;
      }

      console.log(`\n\n🌱 Processing garden: ${formatAddress(address)}`);

      const gardenContract = new ethers.Contract(address, GARDEN_ABI, signer);

      // Verify connection
      try {
        const name = await gardenContract.name();
        console.log(`  Garden name: ${name}`);
      } catch (error) {
        console.error(`  ❌ Failed to connect: ${error.message}`);
        results.failed.push({ garden: address, error: error.message });
        if (!this.options.continueOnError) break;
        continue;
      }

      const gardenResults = {
        garden: address,
        operations: [],
      };

      // Process add gardeners
      if (gardenConfig.addGardeners && gardenConfig.addGardeners.length > 0) {
        console.log(`\n  Adding ${gardenConfig.addGardeners.length} gardener(s)...`);
        for (const gardener of gardenConfig.addGardeners) {
          try {
            if (this.options.dryRun) {
              console.log(`    [DRY RUN] Would add gardener: ${formatAddress(gardener)}`);
            } else {
              if (this.options.estimateGas) {
                const gasInfo = await estimateTransactionCost(gardenContract, "addGardener", [gardener], provider);
                if (gasInfo) {
                  console.log(`    ⛽ Est. cost: ${gasInfo.estimatedCost} ETH`);
                }
              }

              await executeWithRetry(async () => {
                const tx = await gardenContract.addGardener(gardener);
                console.log(`    ✅ Added gardener ${formatAddress(gardener)}`);
                gardenResults.operations.push({
                  type: "addGardener",
                  address: gardener,
                  txHash: tx.hash,
                });
              });
            }
          } catch (error) {
            console.error(`    ❌ Failed to add gardener ${gardener}: ${error.message}`);
            gardenResults.operations.push({
              type: "addGardener",
              address: gardener,
              error: error.message,
            });
            if (!this.options.continueOnError) throw error;
          }
          progress.increment();
        }
      }

      // Process remove gardeners
      if (gardenConfig.removeGardeners && gardenConfig.removeGardeners.length > 0) {
        console.log(`\n  Removing ${gardenConfig.removeGardeners.length} gardener(s)...`);
        for (const gardener of gardenConfig.removeGardeners) {
          try {
            if (this.options.dryRun) {
              console.log(`    [DRY RUN] Would remove gardener: ${formatAddress(gardener)}`);
            } else {
              await executeWithRetry(async () => {
                const tx = await gardenContract.removeGardener(gardener);
                console.log(`    ✅ Removed gardener ${formatAddress(gardener)}`);
                gardenResults.operations.push({
                  type: "removeGardener",
                  address: gardener,
                  txHash: tx.hash,
                });
              });
            }
          } catch (error) {
            console.error(`    ❌ Failed to remove gardener ${gardener}: ${error.message}`);
            gardenResults.operations.push({
              type: "removeGardener",
              address: gardener,
              error: error.message,
            });
            if (!this.options.continueOnError) throw error;
          }
          progress.increment();
        }
      }

      // Process add operators
      if (gardenConfig.addOperators && gardenConfig.addOperators.length > 0) {
        console.log(`\n  Adding ${gardenConfig.addOperators.length} operator(s)...`);
        for (const operator of gardenConfig.addOperators) {
          try {
            if (this.options.dryRun) {
              console.log(`    [DRY RUN] Would add operator: ${formatAddress(operator)}`);
            } else {
              await executeWithRetry(async () => {
                const tx = await gardenContract.addGardenOperator(operator);
                console.log(`    ✅ Added operator ${formatAddress(operator)}`);
                gardenResults.operations.push({
                  type: "addOperator",
                  address: operator,
                  txHash: tx.hash,
                });
              });
            }
          } catch (error) {
            console.error(`    ❌ Failed to add operator ${operator}: ${error.message}`);
            gardenResults.operations.push({
              type: "addOperator",
              address: operator,
              error: error.message,
            });
            if (!this.options.continueOnError) throw error;
          }
          progress.increment();
        }
      }

      // Process remove operators
      if (gardenConfig.removeOperators && gardenConfig.removeOperators.length > 0) {
        console.log(`\n  Removing ${gardenConfig.removeOperators.length} operator(s)...`);
        for (const operator of gardenConfig.removeOperators) {
          try {
            if (this.options.dryRun) {
              console.log(`    [DRY RUN] Would remove operator: ${formatAddress(operator)}`);
            } else {
              await executeWithRetry(async () => {
                const tx = await gardenContract.removeGardenOperator(operator);
                console.log(`    ✅ Removed operator ${formatAddress(operator)}`);
                gardenResults.operations.push({
                  type: "removeOperator",
                  address: operator,
                  txHash: tx.hash,
                });
              });
            }
          } catch (error) {
            console.error(`    ❌ Failed to remove operator ${operator}: ${error.message}`);
            gardenResults.operations.push({
              type: "removeOperator",
              address: operator,
              error: error.message,
            });
            if (!this.options.continueOnError) throw error;
          }
          progress.increment();
        }
      }

      // Process name update
      if (gardenConfig.updateName) {
        try {
          console.log('\n  Updating name to: "' + gardenConfig.updateName + '"');
          if (this.options.dryRun) {
            console.log("    [DRY RUN] Would update name");
          } else {
            await executeWithRetry(async () => {
              const tx = await gardenContract.updateName(gardenConfig.updateName);
              console.log("    ✅ Name updated");
              gardenResults.operations.push({
                type: "updateName",
                value: gardenConfig.updateName,
                txHash: tx.hash,
              });
            });
          }
        } catch (error) {
          console.error(`    ❌ Failed to update name: ${error.message}`);
          gardenResults.operations.push({
            type: "updateName",
            error: error.message,
          });
          if (!this.options.continueOnError) throw error;
        }
        progress.increment();
      }

      // Process description update
      if (gardenConfig.updateDescription) {
        try {
          console.log("\n  Updating description");
          if (this.options.dryRun) {
            console.log("    [DRY RUN] Would update description");
          } else {
            await executeWithRetry(async () => {
              const tx = await gardenContract.updateDescription(gardenConfig.updateDescription);
              console.log("    ✅ Description updated");
              gardenResults.operations.push({
                type: "updateDescription",
                value: gardenConfig.updateDescription,
                txHash: tx.hash,
              });
            });
          }
        } catch (error) {
          console.error(`    ❌ Failed to update description: ${error.message}`);
          gardenResults.operations.push({
            type: "updateDescription",
            error: error.message,
          });
          if (!this.options.continueOnError) throw error;
        }
        progress.increment();
      }

      results.successful.push(gardenResults);
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Gardens processed: ${results.successful.length}`);
    console.log(`❌ Gardens failed: ${results.failed.length}`);

    if (this.options.exportResults && !this.options.dryRun) {
      exportToJSON(
        {
          network: this.options.network,
          timestamp: new Date().toISOString(),
          results,
        },
        `batch-operations-${Date.now()}.json`,
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
🏡 Batch Garden Operations Tool

Usage: node batch-garden-operations.js --chain <network> --config <file> [options]

Required:
  --chain <network>      Network to use
  --config <file>        JSON configuration file

Options:
  --estimate-gas         Show gas estimates (default: true)
  --continue-on-error    Continue if operation fails (default: true)
  --export-results       Export results to JSON
  --dry-run             Simulate only

Configuration File Format:
{
  "gardens": [
    {
      "address": "0x123...",
      "addGardeners": ["0x456...", "0x789..."],
      "removeGardeners": ["0xabc..."],
      "addOperators": ["0xdef..."],
      "removeOperators": ["0xghi..."],
      "updateName": "New Garden Name",
      "updateDescription": "New description"
    }
  ]
}

Example:
  node batch-garden-operations.js --chain arbitrum --config operations.json
  node batch-garden-operations.js --chain arbitrum --config ops.json --dry-run
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    dryRun: false,
    estimateGas: true,
    continueOnError: true,
    exportResults: false,
  };

  let configPath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--config") {
      configPath = args[++i];
    } else if (arg === "--estimate-gas") {
      options.estimateGas = args[++i] === "true";
    } else if (arg === "--continue-on-error") {
      options.continueOnError = args[++i] === "true";
    } else if (arg === "--export-results") {
      options.exportResults = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!configPath) {
    console.error("❌ --config file required");
    process.exit(1);
  }

  try {
    const batch = new BatchGardenOperations(options);
    const config = await batch.loadOperationsConfig(configPath);
    await batch.executeOperations(config);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BatchGardenOperations };
