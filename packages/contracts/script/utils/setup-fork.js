#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Load network configuration
const networksConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../deployments/networks.json")));

// Parse command line arguments
const args = process.argv.slice(2);
const network = args[0] || process.env.FORK_NETWORK || "arbitrum";
const blockNumber = args[1] || process.env.FORK_BLOCK_NUMBER || null;

async function setupFork(network, blockNumber) {
  const networkConfig = networksConfig.networks[network];

  if (!networkConfig) {
    console.error(`Network ${network} not found in configuration`);
    console.log("Available networks:", Object.keys(networksConfig.networks).join(", "));
    process.exit(1);
  }

  console.log(`Setting up fork for ${networkConfig.name} (chainId: ${networkConfig.chainId})`);

  // Get RPC URL from environment or config
  let rpcUrl = networkConfig.rpcUrl;
  if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
    const envVar = rpcUrl.slice(2, -1);
    rpcUrl = process.env[envVar];
    if (!rpcUrl) {
      console.error(`Environment variable ${envVar} not set`);
      console.log(`Please set ${envVar} in your .env file`);
      process.exit(1);
    }
  }

  // Build anvil command
  const anvilArgs = ["--fork-url", rpcUrl, "--chain-id", networkConfig.chainId.toString()];

  if (blockNumber) {
    anvilArgs.push("--fork-block-number", blockNumber);
    console.log(`Forking at block ${blockNumber}`);
  } else {
    console.log("Forking latest block");
  }

  // Additional anvil options
  anvilArgs.push("--accounts", "10", "--balance", "10000", "--block-time", "1", "--port", "8545");

  console.log("\nStarting Anvil with command:");
  console.log("anvil", anvilArgs.join(" "));
  console.log("\nPress Ctrl+C to stop the fork\n");

  // Start anvil
  const anvil = spawn("anvil", anvilArgs, {
    stdio: "inherit",
    shell: true,
  });

  anvil.on("error", (error) => {
    console.error("Failed to start anvil:", error);
    console.log("\nMake sure anvil is installed:");
    console.log("curl -L https://foundry.paradigm.xyz | bash");
    console.log("foundryup");
    process.exit(1);
  });

  anvil.on("close", (code) => {
    console.log(`\nAnvil exited with code ${code}`);
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\nStopping fork...");
    anvil.kill();
    process.exit(0);
  });
}

// Show help if requested
if (args[0] === "--help" || args[0] === "-h") {
  console.log(`
Usage: node setup-fork.js [network] [blockNumber]

Examples:
  node setup-fork.js                    # Fork arbitrum (default)
  node setup-fork.js sepolia            # Fork sepolia
  node setup-fork.js base 12345678      # Fork base at specific block
  
Available networks: ${Object.keys(networksConfig.networks).join(", ")}

Environment variables:
  FORK_NETWORK      - Default network to fork
  FORK_BLOCK_NUMBER - Default block number to fork at
  `);
  process.exit(0);
}

// Run the fork setup
setupFork(network, blockNumber);
