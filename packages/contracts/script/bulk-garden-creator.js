#!/usr/bin/env node

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

class BulkGardenCreator {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "arbitrum", // Default to arbitrum
      continueOnError: true,
      exportResults: false,
      delayBetweenGardens: 3000, // 3 seconds between gardens
      ...options,
    };
  }

  async loadGardensConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    // Validate config structure
    if (!config.gardens || !Array.isArray(config.gardens)) {
      throw new Error("Invalid config: 'gardens' array required");
    }

    if (config.gardens.length === 0) {
      throw new Error("No gardens specified in configuration");
    }

    // Validate each garden configuration
    for (const [index, garden] of config.gardens.entries()) {
      this.validateGardenConfig(garden, index);
    }

    return config;
  }

  validateGardenConfig(garden, index) {
    const required = ["name", "description", "location", "gardeners", "operators"];
    const missing = required.filter((field) => !garden[field]);

    if (missing.length > 0) {
      throw new Error(`Garden ${index}: Missing required fields: ${missing.join(", ")}`);
    }

    // Validate addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;

    if (!Array.isArray(garden.gardeners) || garden.gardeners.length === 0) {
      throw new Error(`Garden ${index}: Gardeners must be a non-empty array`);
    }

    if (!Array.isArray(garden.operators) || garden.operators.length === 0) {
      throw new Error(`Garden ${index}: Operators must be a non-empty array`);
    }

    const invalidGardeners = garden.gardeners.filter((addr) => !addressRegex.test(addr));
    const invalidOperators = garden.operators.filter((addr) => !addressRegex.test(addr));

    if (invalidGardeners.length > 0) {
      throw new Error(`Garden ${index}: Invalid gardener addresses: ${invalidGardeners.join(", ")}`);
    }

    if (invalidOperators.length > 0) {
      throw new Error(`Garden ${index}: Invalid operator addresses: ${invalidOperators.join(", ")}`);
    }

    // Validate banner image (optional) - support both old Qm and new bafy/bafkr IPFS formats
    if (
      garden.bannerImage &&
      !garden.bannerImage.startsWith("Qm") &&
      !garden.bannerImage.startsWith("baf") &&
      !garden.bannerImage.startsWith("http")
    ) {
      throw new Error(`Garden ${index}: Banner image must be IPFS hash (Qm..., bafy..., bafkr...) or URL`);
    }
  }

  getDeploymentAddresses(network) {
    // Map network names to chain IDs
    const networkToChainId = {
      localhost: 31337,
      sepolia: 11155111,
      arbitrum: 42161,
      celo: 42220,
      baseSepolia: 84532,
    };

    const chainId = networkToChainId[network];
    if (!chainId) {
      throw new Error(`Unsupported network: ${network}`);
    }

    // Load deployment file
    const deploymentFile = path.join(__dirname, "../deployments", `${chainId}-latest.json`);
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`Deployment file not found for network ${network}: ${deploymentFile}`);
    }

    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

    // Load networks.json for community token
    const networksFile = path.join(__dirname, "../deployments/networks.json");
    const networksData = JSON.parse(fs.readFileSync(networksFile, "utf8"));

    const networkConfig = networksData.networks[network];
    if (!networkConfig) {
      throw new Error(`Network configuration not found for ${network}`);
    }

    return {
      gardenToken: deploymentData.gardenToken,
      communityToken: networkConfig.contracts.communityToken,
      chainId: chainId,
      rpcUrl: process.env[`${network.toUpperCase()}_RPC_URL`],
    };
  }

  async createGarden(gardenConfig, index, totalGardens, addresses, signer) {
    console.log(`\n�� Creating Garden ${index + 1}/${totalGardens}: ${gardenConfig.name}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      if (this.options.dryRun) {
        console.log("  [DRY RUN] Would create garden:");
        console.log(`    Name: ${gardenConfig.name}`);
        console.log(`    Location: ${gardenConfig.location}`);
        console.log(`    Gardeners: ${gardenConfig.gardeners.length}`);
        console.log(`    Operators: ${gardenConfig.operators.length}`);
        return {
          success: true,
          dryRun: true,
          name: gardenConfig.name,
          location: gardenConfig.location,
          gardeners: gardenConfig.gardeners.length,
          operators: gardenConfig.operators.length,
        };
      }

      // GardenToken ABI - only the functions we need
      const GARDEN_TOKEN_ABI = [
        "function mintGarden(address communityToken, string name, string description, string location, string bannerImage, address[] gardeners, address[] operators) external returns (address)",
        "function owner() external view returns (address)",
      ];

      const gardenToken = new ethers.Contract(addresses.gardenToken, GARDEN_TOKEN_ABI, signer);

      // Check if we're the owner
      const owner = await gardenToken.owner();
      if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error(`Only the owner (${owner}) can create gardens. Current signer: ${signer.address}`);
      }

      console.log("  📝 Creating garden via contract call...");
      console.log(`  GardenToken: ${addresses.gardenToken}`);
      console.log(`  CommunityToken: ${addresses.communityToken}`);

      // Call mintGarden function
      console.log("  ⏳ Calling mintGarden function...");
      const tx = await gardenToken.mintGarden(
        addresses.communityToken,
        gardenConfig.name,
        gardenConfig.description,
        gardenConfig.location,
        gardenConfig.bannerImage || "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD", // Default image
        gardenConfig.gardeners,
        gardenConfig.operators,
        { gasLimit: 500000 },
      );

      console.log(`  ⏳ Transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // Try to extract garden account from logs
      let gardenAccount = "unknown";
      try {
        const event = receipt.logs.find((log) => {
          try {
            const parsed = gardenToken.interface.parseLog(log);
            return parsed && parsed.name === "GardenMinted";
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = gardenToken.interface.parseLog(event);
          gardenAccount = parsed.args.account;
        }
      } catch (error) {
        console.log(`  ⚠️  Could not extract garden account from logs: ${error.message}`);
      }

      console.log(`  ✅ Garden created successfully at: ${gardenAccount}`);

      return {
        success: true,
        gardenAccount,
        name: gardenConfig.name,
        location: gardenConfig.location,
        gardeners: gardenConfig.gardeners.length,
        operators: gardenConfig.operators.length,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`  ❌ Failed to create garden: ${error.message}`);

      if (!this.options.continueOnError) {
        throw error;
      }

      return {
        success: false,
        error: error.message,
        name: gardenConfig.name,
        location: gardenConfig.location,
      };
    }
  }

  async createGardens(config) {
    console.log("\n🏡 Bulk Garden Creation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Network: ${this.options.network}`);
    console.log(`Total gardens: ${config.gardens.length}`);
    console.log(`Continue on error: ${this.options.continueOnError}`);

    // Validate environment
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY environment variable is required");
    }

    // Get deployment addresses
    const addresses = this.getDeploymentAddresses(this.options.network);
    if (!addresses.rpcUrl) {
      throw new Error(`${this.options.network.toUpperCase()}_RPC_URL environment variable is required`);
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(addresses.rpcUrl);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log(`👤 Deployer address: ${signer.address}`);
    console.log(`🔗 Connected to: ${this.options.network} (Chain ID: ${addresses.chainId})`);

    const results = {
      successful: [],
      failed: [],
      summary: {
        total: config.gardens.length,
        successful: 0,
        failed: 0,
        network: this.options.network,
        timestamp: new Date().toISOString(),
      },
    };

    // Process gardens one by one
    for (let i = 0; i < config.gardens.length; i++) {
      const result = await this.createGarden(config.gardens[i], i, config.gardens.length, addresses, signer);

      if (result.success) {
        results.successful.push(result);
        results.summary.successful++;
      } else {
        results.failed.push(result);
        results.summary.failed++;
      }

      // Add delay between gardens if not the last one
      if (i < config.gardens.length - 1 && !this.options.dryRun) {
        console.log(`  ⏳ Waiting ${this.options.delayBetweenGardens / 1000}s before next garden...`);
        await new Promise((resolve) => setTimeout(resolve, this.options.delayBetweenGardens));
      }
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successfully created: ${results.summary.successful}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`📊 Success rate: ${((results.summary.successful / results.summary.total) * 100).toFixed(1)}%`);

    if (results.successful.length > 0) {
      console.log("\nCreated Gardens:");
      results.successful.forEach((garden, index) => {
        console.log(`  ${index + 1}. ${garden.name} (${garden.location})`);
        if (garden.dryRun) {
          console.log("     [DRY RUN] Would create garden");
        } else {
          console.log(`     Address: ${garden.gardenAccount}`);
          console.log(`     Transaction: ${garden.transactionHash}`);
        }
        console.log(`     Members: ${garden.gardeners} gardeners, ${garden.operators} operators`);
      });
    }

    if (results.failed.length > 0) {
      console.log("\nFailed Gardens:");
      results.failed.forEach((garden, index) => {
        console.log(`  ${index + 1}. ${garden.name} (${garden.location})`);
        console.log(`     Error: ${garden.error}`);
      });
    }

    // Export results if requested
    if (this.options.exportResults && !this.options.dryRun) {
      const filename = `bulk-garden-creation-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results exported to: ${filename}`);
    }

    return results;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Bulk Garden Creation Tool (Refactored)

Usage: node bulk-garden-creator.js --chain <network> --config <file> [options]

Required:
  --chain <network>      Network to use (arbitrum, sepolia, localhost, celo, baseSepolia)
  --config <file>        JSON configuration file

Options:
  --delay <ms>           Delay between gardens in milliseconds (default: 3000)
  --continue-on-error    Continue if garden creation fails (default: true)
  --export-results       Export results to JSON file
  --dry-run             Validate configuration without deploying

Configuration File Format:
{
  "gardens": [
    {
      "name": "Community Garden",
      "description": "A sustainable community garden",
      "location": "123 Main St, City, State",
      "bannerImage": "QmHash123...", // Optional: IPFS hash or URL
      "gardeners": ["0x123...", "0x456..."],
      "operators": ["0x789...", "0xabc..."]
    }
  ]
}

Examples:
  # Create gardens from config file on Arbitrum
  node bulk-garden-creator.js --chain arbitrum --config gardens.json

  # Dry run to validate config
  node bulk-garden-creator.js --chain arbitrum --config gardens.json --dry-run

Required Environment Variables:
  PRIVATE_KEY           - Private key for deployment (must be owner of GardenToken)
  ARBITRUM_RPC_URL     - RPC URL for Arbitrum (or other network RPC URL)
    `);
    process.exit(0);
  }

  const options = {
    network: "arbitrum", // Default to arbitrum
    dryRun: false,
    continueOnError: true,
    exportResults: false,
    delayBetweenGardens: 3000,
  };

  let configPath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--config") {
      configPath = args[++i];
    } else if (arg === "--delay") {
      options.delayBetweenGardens = Number.parseInt(args[++i]);
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
    const creator = new BulkGardenCreator(options);
    const config = await creator.loadGardensConfig(configPath);
    await creator.createGardens(config);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BulkGardenCreator };
