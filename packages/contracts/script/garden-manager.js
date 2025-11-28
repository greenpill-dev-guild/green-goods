#!/usr/bin/env node

const dotenv = require("dotenv");
const path = require("node:path");

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { ethers } = require("ethers");
const fs = require("node:fs");

// Garden Token and Account ABIs
const GARDEN_TOKEN_ABI = [
  "function mintGarden((address communityToken, string name, string description, string location, string bannerImage, string metadata, bool openJoining, address[] gardeners, address[] gardenOperators) config) external returns (address)",
  "function owner() external view returns (address)",
];

const GARDEN_ACCOUNT_ABI = [
  "function setOpenJoining(bool _openJoining) external",
  "function openJoining() external view returns (bool)",
  "function gardenOperators(address operator) external view returns (bool)",
];

// Network configurations
const NETWORK_CONFIG = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
  },
  "base-sepolia": {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
  },
  celo: {
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    chainId: 42220,
  },
};

/**
 * Get private key from environment variables
 */
function getPrivateKey() {
  // Try PRIVATE_KEY first, then GREEN_GOODS_MANAGER_PRIVATE_KEY
  const privateKey = process.env.PRIVATE_KEY || process.env.GREEN_GOODS_MANAGER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "Missing required environment variable: PRIVATE_KEY or GREEN_GOODS_MANAGER_PRIVATE_KEY\n" +
        "Please set one of these in your .env file (root .env)",
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
 * Load deployment addresses for a network
 */
function loadDeployment(network) {
  const networkConfig = NETWORK_CONFIG[network];
  const deploymentPath = path.join(__dirname, "../deployments", `${networkConfig.chainId}-latest.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

/**
 * Load gardens config
 */
function loadGardensConfig() {
  const configPath = path.join(__dirname, "../config/gardens.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Gardens config not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

/**
 * Deploy a garden
 */
async function deployGarden(signer, gardenTokenAddress, communityToken, gardenConfig) {
  const gardenToken = new ethers.Contract(gardenTokenAddress, GARDEN_TOKEN_ABI, signer);

  console.log(`\n--- Deploying Garden: ${gardenConfig.name} ---`);
  console.log(`Location: ${gardenConfig.location}`);
  console.log(`Gardeners: ${gardenConfig.gardeners.length}`);
  console.log(`Operators: ${gardenConfig.operators.length}`);
  console.log(`Open Joining: ${gardenConfig.openJoining || false}`);

  // Mint the garden with config struct (openJoining is set during initialization)
  const config = {
    communityToken: communityToken,
    name: gardenConfig.name,
    description: gardenConfig.description,
    location: gardenConfig.location,
    bannerImage: gardenConfig.bannerImage,
    metadata: gardenConfig.metadata || "",
    openJoining: gardenConfig.openJoining || false,
    gardeners: gardenConfig.gardeners,
    gardenOperators: gardenConfig.operators,
  };

  const tx = await gardenToken.mintGarden(config);

  console.log(`Transaction hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  // Extract garden address from GardenMinted event
  const gardenMintedEvent = receipt.logs.find((log) => {
    try {
      const parsed = gardenToken.interface.parseLog(log);
      return parsed.name === "GardenMinted";
    } catch {
      return false;
    }
  });

  if (!gardenMintedEvent) {
    throw new Error("GardenMinted event not found");
  }

  const parsedEvent = gardenToken.interface.parseLog(gardenMintedEvent);
  const gardenAddress = parsedEvent.args.account;
  console.log(`Garden deployed at: ${gardenAddress}`);

  if (gardenConfig.openJoining) {
    console.log("Open joining: enabled (set during initialization)");
  }

  return gardenAddress;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help") {
    console.log(`
Garden Manager - Deploy and manage Green Goods gardens

Usage:
  bun run garden:deploy <network> [start-index] [end-index]

Examples:
  bun run garden:deploy arbitrum 2           # Deploy garden at index 2
  bun run garden:deploy arbitrum 2 3         # Deploy gardens 2-3
  bun run garden:deploy base-sepolia 1       # Deploy second garden (index 1)

Networks:
  - localhost (local anvil)
  - arbitrum (Arbitrum One)
  - base-sepolia (Base Sepolia testnet)
  - celo (Celo mainnet)
`);
    process.exit(0);
  }

  const network = args[0];
  const startIndex = args[1] ? Number.parseInt(args[1], 10) : 0;
  const endIndex = args[2] ? Number.parseInt(args[2], 10) : startIndex;

  console.log("=== Green Goods Garden Deployment ===");
  console.log(`Network: ${network}`);
  console.log(`Garden indices: ${startIndex}-${endIndex}`);

  const { signer } = await setupProvider(network);
  const signerAddress = await signer.getAddress();
  console.log(`Deployer: ${signerAddress}`);

  const deployment = loadDeployment(network);
  const gardensConfig = loadGardensConfig();

  console.log(`GardenToken: ${deployment.gardenToken}`);
  console.log(`CommunityToken: ${deployment.communityToken}`);

  // Deploy gardens
  const deployedGardens = [];

  for (let i = startIndex; i <= endIndex; i++) {
    if (i >= gardensConfig.gardens.length) {
      console.log(`\nNo garden found at index ${i}`);
      break;
    }

    const gardenConfig = gardensConfig.gardens[i];

    try {
      const gardenAddress = await deployGarden(signer, deployment.gardenToken, deployment.communityToken, gardenConfig);
      deployedGardens.push({ index: i, name: gardenConfig.name, address: gardenAddress });
    } catch (error) {
      console.error(`Error deploying garden at index ${i}:`, error.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  deployedGardens.forEach((garden) => {
    console.log(`${garden.index}. ${garden.name}: ${garden.address}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
