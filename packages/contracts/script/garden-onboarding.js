#!/usr/bin/env node

require("dotenv").config();
const { PrivyClient } = require("@privy-io/server-auth");
const { parse } = require("csv-parse");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const PinataClient = require("@pinata/sdk");
const fetch = require("node-fetch");
const path = require("node:path");
const { DeploymentAddresses } = require("./utils/deployment-addresses");

// Initialize Privy client
let privyClient;
if (process.env.PRIVY_CLIENT_ID && process.env.PRIVY_APP_SECRET_ID) {
  privyClient = new PrivyClient(process.env.PRIVY_CLIENT_ID, process.env.PRIVY_APP_SECRET_ID, {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY,
    },
  });
}

// Initialize Pinata client
let pinata;
if (process.env.PINATA_JWT) {
  pinata = new PinataClient({
    pinataJWTKey: process.env.PINATA_JWT,
  });
}

const CONFIG = {
  tempDir: path.join(__dirname, "temp"),
  maxRetries: 3,
  retryDelay: 1000,
  supportedImageTypes: ["jpg", "jpeg", "png", "gif"],
};

class GardenOnboarding {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      ...options,
    };
    this.deploymentAddresses = new DeploymentAddresses();
  }

  async validateEnvironment() {
    const requiredEnvVars = ["PRIVATE_KEY"];

    if (!this.options.dryRun) {
      requiredEnvVars.push("PRIVY_CLIENT_ID", "PRIVY_APP_SECRET_ID", "PRIVY_AUTHORIZATION_PRIVATE_KEY", "PINATA_JWT");
    }

    const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    if (!privyClient && !this.options.dryRun) {
      throw new Error("Privy client not initialized. Check PRIVY_* environment variables.");
    }

    if (!pinata && !this.options.dryRun) {
      throw new Error("Pinata client not initialized. Check PINATA_JWT environment variable.");
    }
  }

  // Function to download image from URL
  async downloadImage(url) {
    const response = await fetch(url);
    const buffer = await response.buffer();
    const filename = path.basename(url);
    const tempPath = path.join(CONFIG.tempDir, filename);

    // Ensure temp directory exists
    if (!fs.existsSync(CONFIG.tempDir)) {
      fs.mkdirSync(CONFIG.tempDir, { recursive: true });
    }

    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  }

  // Function to upload to IPFS using @pinata/sdk
  async uploadToIPFS(filePath) {
    if (this.options.dryRun) {
      console.log(`[DRY RUN] Would upload ${filePath} to IPFS`);
      return "QmDryRunHash123456789";
    }

    try {
      const readableStream = fs.createReadStream(filePath);
      const filename = path.basename(filePath);
      const result = await this.uploadWithRetry(readableStream, { pinataMetadata: { name: filename } });
      return result.IpfsHash;
    } catch (error) {
      console.error("Error uploading to IPFS:", error);
      throw error;
    }
  }

  // Retry logic for IPFS upload
  async uploadWithRetry(stream, metadata, retries = CONFIG.maxRetries) {
    try {
      return await pinata.pinFileToIPFS(stream, metadata);
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.retryDelay));
        return this.uploadWithRetry(stream, metadata, retries - 1);
      }
      throw error;
    }
  }

  // Function to handle banner image (URL or file)
  async processBannerImage(bannerInput) {
    if (!bannerInput) {
      console.warn("No banner image provided, using default image");
      return "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD"; // Default image
    }

    try {
      let filePath;

      if (bannerInput.startsWith("http")) {
        // Download image from URL
        console.log(`Downloading banner image from: ${bannerInput}`);
        filePath = await this.downloadImage(bannerInput);
      } else {
        // Assume it's a local file path
        filePath = bannerInput;
        if (!fs.existsSync(filePath)) {
          throw new Error(`Banner image file not found: ${filePath}`);
        }
      }

      // Upload to IPFS
      console.log("Uploading banner image to IPFS...");
      const ipfsHash = await this.uploadToIPFS(filePath);

      // Clean up temporary file if it was downloaded
      if (bannerInput.startsWith("http")) {
        fs.unlinkSync(filePath);
      }

      return ipfsHash;
    } catch (error) {
      console.error("Error processing banner image:", error);
      throw error;
    }
  }

  // Function to read and parse CSV file as raw rows
  async parseCSVRows(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(
          parse({
            columns: false,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true, // Allow variable column counts
          }),
        )
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (error) => reject(error));
    });
  }

  // Function to create embedded wallet for a user
  async createEmbeddedWallet(identifier) {
    if (this.options.dryRun) {
      console.log(`[DRY RUN] Would create wallet for ${identifier}`);
      return `0x${Math.random().toString(16).substr(2, 40)}`;
    }

    try {
      if (typeof identifier !== "string" || !identifier) {
        throw new Error("Invalid identifier provided for wallet creation");
      }

      // First try to get the existing user
      let user;
      try {
        user = await privyClient.getUser(identifier);
        console.log(`Found existing user for ${identifier}`);
      } catch (_error) {
        // If user doesn't exist, create a new one
        console.log(`Creating new user for ${identifier}`);
        user = await privyClient.importUser({
          linkedAccounts: [
            identifier.includes("@") ? { type: "email", address: identifier } : { type: "phone", number: identifier },
          ],
          createEthereumWallet: true,
          createEthereumSmartWallet: true,
        });
      }

      // Check if user already has a smart wallet
      const smartWallet = user.linkedAccounts.find((account) => account.type === "smart_wallet");

      if (smartWallet) {
        console.log(`Found existing smart wallet for ${identifier}: ${smartWallet.address}`);
        return smartWallet.address;
      }

      // If no smart wallet exists, create one
      console.log(`Creating new smart wallet for ${identifier}`);
      const updatedUser = await privyClient.updateUser(identifier, {
        createEthereumSmartWallet: true,
      });

      const newSmartWallet = updatedUser.linkedAccounts.find((account) => account.type === "smart_wallet");

      if (!newSmartWallet) {
        throw new Error(`Failed to create smart wallet for user ${identifier}`);
      }

      console.log(`Created new smart wallet for ${identifier}: ${newSmartWallet.address}`);
      return newSmartWallet.address;
    } catch (error) {
      console.error(`Error handling wallet for ${identifier}:`, error);
      throw error;
    }
  }

  // Function to deploy garden contract using Foundry
  async deployGarden(gardenInfo, gardeners, operators) {
    try {
      // Load contract addresses for the network
      const contractAddresses = this.deploymentAddresses.loadForChain(this.options.network);
      const communityToken = this.deploymentAddresses.getCommunityToken(this.options.network);

      // Set environment variables for the Forge script
      const env = {
        ...process.env,
        GARDEN_NAME: gardenInfo.name,
        GARDEN_DESCRIPTION: gardenInfo.description,
        GARDEN_LOCATION: gardenInfo.location,
        GARDEN_BANNER: gardenInfo.bannerImage,
        GARDENERS: JSON.stringify(gardeners),
        OPERATORS: JSON.stringify(operators),
        GARDEN_TOKEN: contractAddresses.gardenToken,
        COMMUNITY_TOKEN: communityToken,
      };

      if (this.options.dryRun) {
        console.log("\n[DRY RUN] Would deploy garden contract");
        console.log("Garden Name:", gardenInfo.name);
        console.log("Garden Description:", gardenInfo.description);
        console.log("Garden Location:", gardenInfo.location);
        console.log("Garden Banner IPFS Hash:", gardenInfo.bannerImage);
        console.log("Number of Gardeners:", gardeners.length);
        console.log("Number of Operators:", operators.length);
        console.log("Target Network:", this.options.network);
        return;
      }

      // Execute Foundry script
      const args = [
        "script",
        "script/DeployGarden.s.sol:DeployGarden",
        "--private-key",
        process.env.PRIVATE_KEY,
        "--broadcast",
      ];
      console.log("\nDeploying garden contract...");
      console.log("forge", args.map((arg) => (arg === process.env.PRIVATE_KEY ? "[REDACTED]" : arg)).join(" "));
      execSync(`forge ${args.join(" ")}`, { stdio: "inherit", env, cwd: path.join(__dirname, "..") });
    } catch (error) {
      console.error("Error deploying garden:", error);
      throw error;
    }
  }

  async processCSV(csvPath) {
    console.log("Starting garden onboarding process...");
    console.log("Environment:", process.env.NODE_ENV || "development");

    await this.validateEnvironment();

    // Read and parse the CSV file as raw rows
    const rows = await this.parseCSVRows(csvPath);

    // CSV validation
    if (rows.length < 7) {
      throw new Error("CSV file must have at least 7 rows (instructions + garden info + header + data)");
    }

    // Skip the first line (instructions)
    // Next 4 lines are key-value pairs
    const name = rows[1][1] || rows[1][0]; // Handles both 'Name:' and 'Name'
    const description = rows[2][1];
    const location = rows[3][1];
    const bannerInput = rows[4][1];

    console.log(`Processing garden: ${name}`);
    console.log(`Location: ${location}`);

    // Process banner image
    console.log("Processing banner image...");
    const bannerImage = await this.processBannerImage(bannerInput);

    const gardenInfo = {
      name,
      description,
      location,
      bannerImage,
    };

    // Dynamically find the header row for operators/gardeners
    let header;
    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((col) => col.trim());
      if (row.includes("Garden Operators") && row.includes("Gardeners")) {
        header = row;
        headerRowIdx = i;
        break;
      }
    }
    if (!header || headerRowIdx === -1) {
      console.error("Could not find a header row with both 'Garden Operators' and 'Gardeners'.");
      rows.forEach((row, idx) => console.log(`Row ${idx}:`, row));
      throw new Error("Could not find 'Garden Operators' or 'Gardeners' columns in the CSV");
    }
    const operatorIdx = header.findIndex((col) => col === "Garden Operators");
    const gardenerIdx = header.findIndex((col) => col === "Gardeners");
    console.log(
      `Found columns - Operators at index ${operatorIdx}, Gardeners at index ${gardenerIdx} (header row ${headerRowIdx})`,
    );

    // The rest are the actual data
    const operators = new Set();
    const gardeners = new Set();

    console.log("\nProcessing operators and gardeners...");
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[operatorIdx] && !row[gardenerIdx]) continue; // Skip empty rows

      // Process operator
      if (row[operatorIdx]) {
        const operatorId = row[operatorIdx].trim();
        console.log(`\nProcessing operator: ${operatorId}`);
        const operatorWallet = await this.createEmbeddedWallet(operatorId);
        console.log(`Created/found smart wallet for operator: ${operatorWallet}`);
        operators.add(operatorWallet);
        gardeners.add(operatorWallet); // Operators are also gardeners
      }

      // Process gardener
      if (row[gardenerIdx]) {
        const gardenerId = row[gardenerIdx].trim();
        console.log(`\nProcessing gardener: ${gardenerId}`);
        const gardenerWallet = await this.createEmbeddedWallet(gardenerId);
        console.log(`Created/found smart wallet for gardener: ${gardenerWallet}`);
        gardeners.add(gardenerWallet);
      }
    }

    // Convert Sets to Arrays
    const operatorAddresses = Array.from(operators);
    const gardenerAddresses = Array.from(gardeners);

    console.log("\nSummary:");
    console.log(`Total operators: ${operatorAddresses.length}`);
    console.log(`Total gardeners: ${gardenerAddresses.length}`);

    if (this.options.dryRun) {
      console.log("\nDry run completed. Garden deployment skipped.");
      console.log("Garden info:", gardenInfo);
      console.log("Operator addresses:", operatorAddresses);
      console.log("Gardener addresses:", gardenerAddresses);
      return;
    }

    // Deploy garden contract with separate whitelists
    console.log(`\nDeploying garden contract to ${this.options.network}...`);
    await this.deployGarden(gardenInfo, gardenerAddresses, operatorAddresses);

    console.log("\nGarden onboarding completed successfully!");
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Garden Onboarding Tool

Usage: node garden-onboarding.js <csv-file> [options]

Options:
  --network <network>    Network to deploy to (default: localhost)
  --dry-run              Validate configuration without deploying
  --help, -h             Show this help

Examples:
  node garden-onboarding.js data/garden.csv --network sepolia
  node garden-onboarding.js data/garden.csv --dry-run

CSV Format:
  Line 1: Instructions (skipped)
  Lines 2-5: Garden info (Name, Description, Location, Banner Image)
  Line 6: Headers (must include "Garden Operators" and "Gardeners")
  Line 7+: Data rows with operator and gardener identifiers

Required Environment Variables:
  PRIVATE_KEY       - Private key for deployment
  PRIVY_CLIENT_ID           - Privy client ID
  PRIVY_APP_SECRET_ID       - Privy app secret
  PRIVY_AUTHORIZATION_PRIVATE_KEY - Privy authorization key
  PINATA_JWT                - Pinata JWT token
    `);
    process.exit(0);
  }

  const csvPath = args[0];
  const options = {
    network: "localhost",
    dryRun: false,
  };

  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!csvPath) {
    console.error("Please provide a CSV file path as an argument");
    console.error("Usage: node garden-onboarding.js <path-to-csv> [options]");
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    const onboarding = new GardenOnboarding(options);
    await onboarding.processCSV(csvPath);
  } catch (error) {
    console.error("Error in garden onboarding:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { GardenOnboarding };
