#!/usr/bin/env node

/**
 * Garden Deployer - Uses Foundry keystore to deploy gardens from config
 *
 * This script uses forge script to deploy gardens using the green-goods-deployer account
 * stored in Foundry's encrypted keystore.
 *
 * Usage:
 *   bun run garden:deploy arbitrum 1 2  # Deploy gardens at indices 1-2
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

// Network configurations matching foundry.toml
const NETWORKS = {
  localhost: "local",
  arbitrum: "arbitrum",
  "base-sepolia": "baseSepolia",
  celo: "celo",
};

function loadGardensConfig() {
  const configPath = path.join(__dirname, "../config/gardens.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Gardens config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function runForgeScript(network, startIndex, endIndex) {
  return new Promise((resolve, reject) => {
    const args = [
      "script",
      "script/DeployAdditionalGardens.s.sol:DeployAdditionalGardens",
      "--rpc-url",
      network,
      "--account",
      "green-goods-deployer",
      "--broadcast",
      "-vv",
    ];

    // Set environment variables for the script
    const env = {
      ...process.env,
      START_INDEX: startIndex.toString(),
      MAX_GARDENS: (endIndex + 1).toString(),
    };

    console.log(`\n🌱 Deploying gardens ${startIndex}-${endIndex} to ${network}...`);
    console.log(`Command: forge ${args.join(" ")}\n`);

    const forge = spawn("forge", args, {
      cwd: path.join(__dirname, ".."),
      env,
      stdio: "inherit",
    });

    forge.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Forge script exited with code ${code}`));
      }
    });

    forge.on("error", (err) => {
      reject(new Error(`Failed to start forge: ${err.message}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    console.log(`
Garden Deployer - Deploy gardens from config using Foundry keystore

Usage:
  bun run garden:deploy <network> [start-index] [end-index]

Examples:
  bun run garden:deploy arbitrum 1           # Deploy garden at index 1
  bun run garden:deploy arbitrum 1 1         # Deploy gardens 1-1 (just garden 1)
  bun run garden:deploy base-sepolia 0       # Deploy first garden (root)

Networks:
  - localhost
  - arbitrum
  - base-sepolia
  - celo

Prerequisites:
  - Foundry keystore account: green-goods-deployer
  - Network RPC URL configured in foundry.toml
  - Deployer must be in DeploymentRegistry allowlist or GardenToken owner

Notes:
  - Uses Foundry's encrypted keystore (no private keys in .env)
  - Will prompt for password when broadcasting
  - Transactions are broadcast to the network
`);
    process.exit(0);
  }

  const network = args[0];
  const startIndex = args[1] ? Number.parseInt(args[1], 10) : 0;
  const endIndex = args[2] ? Number.parseInt(args[2], 10) : startIndex;

  if (!NETWORKS[network]) {
    console.error(`❌ Unknown network: ${network}`);
    console.error(`Available networks: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
  }

  if (startIndex < 0 || endIndex < startIndex) {
    console.error("❌ Invalid index range");
    process.exit(1);
  }

  // Load config to validate indices
  const gardensConfig = loadGardensConfig();
  if (startIndex >= gardensConfig.gardens.length) {
    console.error(`❌ Start index ${startIndex} exceeds available gardens (${gardensConfig.gardens.length})`);
    process.exit(1);
  }

  console.log("=== Green Goods Garden Deployment ===");
  console.log(`Network: ${network}`);
  console.log(`Indices: ${startIndex} to ${endIndex}`);
  console.log("\nGardens to deploy:");
  for (let i = startIndex; i <= Math.min(endIndex, gardensConfig.gardens.length - 1); i++) {
    const garden = gardensConfig.gardens[i];
    console.log(`  ${i}. ${garden.name} (${garden.location})`);
  }

  try {
    await runForgeScript(network, startIndex, endIndex);
    console.log("\n✅ Gardens deployed successfully!");
  } catch (error) {
    console.error(`\n❌ Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
