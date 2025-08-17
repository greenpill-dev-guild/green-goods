#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");

// Garden ABI - only the functions we need
const GARDEN_ABI = [
  "function addGardener(address gardener) external",
  "function addGardenOperator(address operator) external",
  "function gardeners(address) external view returns (bool)",
  "function gardenOperators(address) external view returns (bool)",
  "function name() external view returns (string)",
];

// Network configurations
const NETWORK_CONFIG = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
  },
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
    chainId: 11155111,
  },
  celo: {
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    chainId: 42220,
  },
  "celo-testnet": {
    rpcUrl: process.env.CELO_TESTNET_RPC_URL || "https://alfajores-forno.celo-testnet.org",
    chainId: 44787,
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
  },
  "arbitrum-sepolia": {
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
  },
};

class GardenMemberManager {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      ...options,
    };
  }

  async validateEnvironment() {
    // Check for operator private key (accept multiple env var names for flexibility)
    const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!privateKey) {
      throw new Error(
        "Missing required environment variable: OPERATOR_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY/PRIVATE_KEY)",
      );
    }

    this.privateKey = privateKey;
  }

  async setupProvider() {
    const networkConfig = NETWORK_CONFIG[this.options.network];
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${this.options.network}`);
    }

    console.log(`Connecting to ${this.options.network} (chainId: ${networkConfig.chainId})`);

    // Create provider
    this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

    // Create signer
    this.signer = new ethers.Wallet(this.privateKey, this.provider);
    console.log(`Using operator address: ${this.signer.address}`);
  }

  async checkMemberStatus(gardenContract, addresses) {
    const status = {
      gardeners: {},
      operators: {},
    };

    for (const address of addresses) {
      status.gardeners[address] = await gardenContract.gardeners(address);
      status.operators[address] = await gardenContract.gardenOperators(address);
    }

    return status;
  }

  async addMembers(gardenAddress, addresses, options = {}) {
    const { addAsGardeners = true, addAsOperators = false } = options;

    console.log(`\nAdding members to garden at: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Add as gardeners: ${addAsGardeners}`);
    console.log(`Add as operators: ${addAsOperators}`);
    console.log(`Addresses to add: ${addresses.length}`);

    // Connect to the garden contract
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, this.signer);

    // Try to get the garden name to verify the contract
    try {
      const gardenName = await gardenContract.name();
      console.log(`Garden name: ${gardenName}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden contract at ${gardenAddress}: ${error.message}`);
    }

    // Check current member status
    console.log("\nChecking current member status...");
    const currentStatus = await this.checkMemberStatus(gardenContract, addresses);

    // Process each address
    for (const address of addresses) {
      console.log(`\n📋 Processing: ${address}`);

      // Check if already a gardener
      if (addAsGardeners) {
        if (currentStatus.gardeners[address]) {
          console.log("  ✅ Already a gardener");
        } else {
          if (this.options.dryRun) {
            console.log("  [DRY RUN] Would add as gardener");
          } else {
            try {
              console.log("  ⏳ Adding as gardener...");
              const tx = await gardenContract.addGardener(address);
              console.log(`  📝 Transaction sent: ${tx.hash}`);
              const receipt = await tx.wait();
              console.log(`  ✅ Added as gardener (block: ${receipt.blockNumber})`);
            } catch (error) {
              console.error(`  ❌ Failed to add as gardener: ${error.message}`);
              if (!this.options.force) throw error;
            }
          }
        }
      }

      // Check if already an operator
      if (addAsOperators) {
        if (currentStatus.operators[address]) {
          console.log("  ✅ Already an operator");
        } else {
          if (this.options.dryRun) {
            console.log("  [DRY RUN] Would add as operator");
          } else {
            try {
              console.log("  ⏳ Adding as operator...");
              const tx = await gardenContract.addGardenOperator(address);
              console.log(`  📝 Transaction sent: ${tx.hash}`);
              const receipt = await tx.wait();
              console.log(`  ✅ Added as operator (block: ${receipt.blockNumber})`);
            } catch (error) {
              console.error(`  ❌ Failed to add as operator: ${error.message}`);
              if (!this.options.force) throw error;
            }
          }
        }
      }
    }

    // Verify final status
    if (!this.options.dryRun) {
      console.log("\n✨ Verifying final member status...");
      const finalStatus = await this.checkMemberStatus(gardenContract, addresses);

      for (const address of addresses) {
        console.log(`\n${address}:`);
        console.log(`  Gardener: ${finalStatus.gardeners[address] ? "✅" : "❌"}`);
        console.log(`  Operator: ${finalStatus.operators[address] ? "✅" : "❌"}`);
      }
    }

    console.log("\n✅ Garden member management completed!");
  }

  async execute(gardenAddress, addresses, roles) {
    await this.validateEnvironment();
    await this.setupProvider();

    const options = {
      addAsGardeners: roles.includes("gardener"),
      addAsOperators: roles.includes("operator"),
    };

    await this.addMembers(gardenAddress, addresses, options);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Garden Member Management Tool

Usage: node add-garden-members.js --chain <network> --garden <address> --addresses <addresses> [options]

Required Arguments:
  --chain <network>      Network to use (localhost, sepolia, celo, celo-testnet, arbitrum, arbitrum-sepolia)
  --garden <address>     Address of the Garden contract
  --addresses <list>     Comma-separated list of addresses to add

Options:
  --roles <roles>        Roles to assign: gardener, operator, or both (default: gardener)
  --dry-run              Simulate without executing transactions
  --force                Continue even if some transactions fail
  --help, -h             Show this help

Examples:
  # Add single address as gardener
  node add-garden-members.js --chain arbitrum --garden 0x123... --addresses 0x456...

  # Add multiple addresses as both gardeners and operators
  node add-garden-members.js --chain arbitrum --garden 0x123... --addresses 0x456...,0x789... --roles gardener,operator

  # Dry run to see what would happen
  node add-garden-members.js --chain arbitrum --garden 0x123... --addresses 0x456... --dry-run

Required Environment Variables:
  OPERATOR_PRIVATE_KEY   - Private key of a current garden operator
                          (Can also use DEPLOYER_PRIVATE_KEY or PRIVATE_KEY)
  ARBITRUM_RPC_URL      - RPC URL for Arbitrum (optional, uses default if not set)
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    dryRun: false,
    force: false,
  };

  let gardenAddress;
  let addresses = [];
  let roles = ["gardener"]; // Default role

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--addresses") {
      addresses = args[++i].split(",").map((addr) => addr.trim());
    } else if (arg === "--roles") {
      roles = args[++i].split(",").map((role) => role.trim());
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    }
  }

  // Validate required arguments
  if (!gardenAddress) {
    console.error("❌ Error: --garden address is required");
    process.exit(1);
  }

  if (addresses.length === 0) {
    console.error("❌ Error: --addresses is required");
    process.exit(1);
  }

  // Validate addresses
  for (const address of addresses) {
    if (!ethers.isAddress(address)) {
      console.error(`❌ Error: Invalid address: ${address}`);
      process.exit(1);
    }
  }

  if (!ethers.isAddress(gardenAddress)) {
    console.error(`❌ Error: Invalid garden address: ${gardenAddress}`);
    process.exit(1);
  }

  // Validate roles
  const validRoles = ["gardener", "operator"];
  for (const role of roles) {
    if (!validRoles.includes(role)) {
      console.error(`❌ Error: Invalid role: ${role}. Must be one of: ${validRoles.join(", ")}`);
      process.exit(1);
    }
  }

  try {
    const manager = new GardenMemberManager(options);
    await manager.execute(gardenAddress, addresses, roles);
  } catch (error) {
    console.error("❌ Error in garden member management:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenMemberManager };
