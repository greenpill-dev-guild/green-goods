/**
 * Common utilities for garden management scripts
 */

const { ethers } = require("ethers");
const fs = require("node:fs");
const { parse } = require("csv-parse");
const path = require("node:path");

// Garden ABI - comprehensive list of functions
const GARDEN_ABI = [
  // Read functions
  "function name() external view returns (string)",
  "function description() external view returns (string)",
  "function location() external view returns (string)",
  "function bannerImage() external view returns (string)",
  "function communityToken() external view returns (address)",
  "function gardeners(address) external view returns (bool)",
  "function gardenOperators(address) external view returns (bool)",
  // Write functions
  "function updateName(string memory _name) external",
  "function updateDescription(string memory _description) external",
  "function addGardener(address gardener) external",
  "function removeGardener(address gardener) external",
  "function addGardenOperator(address operator) external",
  "function removeGardenOperator(address operator) external",
];

// Action Registry ABI
const ACTION_REGISTRY_ABI = [
  "function registerAction(uint256 startTime, uint256 endTime, string memory title, string memory instructions, uint8[] memory capitals, string[] memory media) external returns (uint256)",
  "function updateActionStartTime(uint256 actionUID, uint256 startTime) external",
  "function updateActionEndTime(uint256 actionUID, uint256 endTime) external",
  "function updateActionTitle(uint256 actionUID, string memory title) external",
  "function updateActionInstructions(uint256 actionUID, string memory instructions) external",
  "function updateActionCapitals(uint256 actionUID, uint8[] memory capitals) external",
  "function updateActionMedia(uint256 actionUID, string[] memory media) external",
  "function getAction(uint256 actionUID) external view returns (tuple(uint256 startTime, uint256 endTime, string title, string instructions, uint8[] capitals, string[] media))",
  "function actionCounter() external view returns (uint256)",
];

// Network configurations
const NETWORK_CONFIG = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    blockTime: 1,
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    blockTime: 0.25,
  },
  "base-sepolia": {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
    blockTime: 2,
  },
  celo: {
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    chainId: 42220,
    blockTime: 5,
  },
};

// Capital types enum
const CAPITAL_TYPES = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get private key from environment variables
 */
function getPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "Missing required environment variable: PRIVATE_KEY\n" +
        "Please set PRIVATE_KEY in your .env file\n" +
        "For production deployments, use Foundry keystore instead:\n" +
        "  1. Import your key: cast wallet import <account-name> --interactive\n" +
        "  2. Use --account flag: forge script --account <account-name>",
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
 * Execute function with retry logic
 */
async function executeWithRetry(fn, retries = 3, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")) {
      console.log(`  ⚠️  Network error, retrying... (${retries} attempts left)`);
      await sleep(delay);
      return executeWithRetry(fn, retries - 1, delay);
    }
    throw error;
  }
}

/**
 * Estimate gas and cost for a transaction
 */
async function estimateTransactionCost(contract, method, args, provider) {
  try {
    const gasEstimate = await contract[method].estimateGas(...args);
    const feeData = await provider.getFeeData();
    const estimatedCost = gasEstimate * feeData.gasPrice;

    return {
      gasLimit: gasEstimate,
      gasPrice: feeData.gasPrice,
      estimatedCost: ethers.formatEther(estimatedCost),
      estimatedCostGwei: ethers.formatUnits(feeData.gasPrice, "gwei"),
    };
  } catch (error) {
    console.warn("  ⚠️  Could not estimate gas:", error.message);
    return null;
  }
}

/**
 * Load addresses from CSV file
 */
async function loadAddressesFromCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const addresses = [];
    fs.createReadStream(csvPath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }),
      )
      .on("data", (row) => {
        // Support multiple column names
        const address = row.address || row.Address || row.wallet || row.Wallet || row.member || row.Member;
        if (address && ethers.isAddress(address)) {
          addresses.push(address);
        }
      })
      .on("end", () => resolve(addresses))
      .on("error", reject);
  });
}

/**
 * Export data to JSON file
 */
function exportToJSON(data, filename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalFilename = filename || `export-${timestamp}.json`;
  fs.writeFileSync(finalFilename, JSON.stringify(data, null, 2));
  console.log(`💾 Data exported to ${finalFilename}`);
  return finalFilename;
}

/**
 * Export data to CSV file
 */
function exportToCSV(data, headers, filename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalFilename = filename || `export-${timestamp}.csv`;

  const csvContent = [headers.join(","), ...data.map((row) => headers.map((h) => row[h] || "").join(","))].join("\n");

  fs.writeFileSync(finalFilename, csvContent);
  console.log(`💾 Data exported to ${finalFilename}`);
  return finalFilename;
}

/**
 * Format address for display
 */
function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get block explorer URL for transaction
 */
function getExplorerUrl(network, txHash) {
  const urls = {
    sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    "arbitrum-sepolia": `https://sepolia.arbiscan.io/tx/${txHash}`,
    celo: `https://celoscan.io/tx/${txHash}`,
    "celo-testnet": `https://alfajores.celoscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    "base-sepolia": `https://sepolia.basescan.org/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
  };

  return urls[network] || `Transaction: ${txHash}`;
}

/**
 * Load deployment addresses for a network
 */
function loadDeploymentAddresses(network) {
  const deploymentFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    `${NETWORK_CONFIG[network]?.chainId || network}-latest.json`,
  );

  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return deployment.contracts || {};
  }

  return {};
}

/**
 * Progress bar for batch operations
 */
class ProgressBar {
  constructor(total, label = "Processing") {
    this.total = total;
    this.current = 0;
    this.label = label;
  }

  increment() {
    this.current++;
    this.render();
  }

  render() {
    const percent = Math.floor((this.current / this.total) * 100);
    const filled = Math.floor(percent / 2);
    const empty = 50 - filled;

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${this.label}: [${"█".repeat(filled)}${" ".repeat(empty)}] ${percent}% (${this.current}/${this.total})`,
    );

    if (this.current === this.total) {
      console.log(); // New line when complete
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args, schema) {
  const result = { ...schema.defaults };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const config = schema.options[key];

      if (config) {
        if (config.type === "boolean") {
          result[config.name || key] = true;
        } else if (config.type === "array") {
          result[config.name || key] = args[++i].split(",").map((v) => v.trim());
        } else {
          result[config.name || key] = config.type === "number" ? Number.parseInt(args[++i]) : args[++i];
        }
      }
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  // Map positional arguments
  if (schema.positional) {
    schema.positional.forEach((name, index) => {
      if (positional[index] !== undefined) {
        result[name] = positional[index];
      }
    });
  }

  return result;
}

/**
 * Validate Ethereum address
 */
function validateAddress(address) {
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return address;
}

/**
 * Batch array into chunks
 */
function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

module.exports = {
  GARDEN_ABI,
  ACTION_REGISTRY_ABI,
  NETWORK_CONFIG,
  CAPITAL_TYPES,
  sleep,
  getPrivateKey,
  setupProvider,
  executeWithRetry,
  estimateTransactionCost,
  loadAddressesFromCSV,
  exportToJSON,
  exportToCSV,
  formatAddress,
  getExplorerUrl,
  loadDeploymentAddresses,
  ProgressBar,
  parseArgs,
  validateAddress,
  batchArray,
};
