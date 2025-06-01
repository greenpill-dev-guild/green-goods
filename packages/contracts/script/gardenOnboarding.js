require("dotenv").config();
const { PrivyClient } = require("@privy-io/server-auth");
const { parse } = require("csv-parse");
const fs = require("fs");
const { execSync } = require("child_process");
const PinataClient = require("@pinata/sdk");
const fetch = require("node-fetch");
const path = require("path");

// Initialize Privy client
const privyClient = new PrivyClient(process.env.RIVY_CLIENT_ID, process.env.PRIVY_APP_SECRET_ID);

// Initialize Pinata client
const pinata = new PinataClient({
  pinataJWTKey: process.env.PINATA_JWT,
});

// Function to download image from URL
async function downloadImage(url) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  const filename = path.basename(url);
  const tempPath = path.join(__dirname, "temp", filename);

  // Ensure temp directory exists
  if (!fs.existsSync(path.join(__dirname, "temp"))) {
    fs.mkdirSync(path.join(__dirname, "temp"));
  }

  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

// Function to upload to IPFS using @pinata/sdk
async function uploadToIPFS(filePath) {
  try {
    const readableStream = fs.createReadStream(filePath);
    const filename = path.basename(filePath);
    const result = await pinata.pinFileToIPFS(readableStream, {
      pinataMetadata: { name: filename },
    });
    return result.IpfsHash;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw error;
  }
}

// Function to handle banner image (URL or file)
async function processBannerImage(bannerInput) {
  try {
    let filePath;

    if (bannerInput.startsWith("http")) {
      // Download image from URL
      filePath = await downloadImage(bannerInput);
    } else {
      // Assume it's a local file path
      filePath = bannerInput;
    }

    // Upload to IPFS
    const ipfsHash = await uploadToIPFS(filePath);

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
async function parseCSVRows(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: false,
          skip_empty_lines: true,
          trim: true,
        }),
      )
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Function to create embedded wallet for a user
async function createEmbeddedWallet(identifier) {
  try {
    // First try to get the existing user
    let user;
    try {
      user = await privyClient.getUser(identifier);
      console.log(`Found existing user for ${identifier}`);
    } catch (error) {
      // If user doesn't exist, create a new one
      console.log(`Creating new user for ${identifier}`);
      user = await privyClient.importUser({
        linkedAccounts: [
          {
            type: identifier.includes("@") ? "email" : "phone",
            address: identifier,
          },
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
async function deployGarden(gardenInfo, gardeners, operators) {
  try {
    // Set environment variables for the Forge script
    process.env.GARDEN_NAME = gardenInfo.name;
    process.env.GARDEN_DESCRIPTION = gardenInfo.description;
    process.env.GARDEN_LOCATION = gardenInfo.location;
    process.env.GARDEN_BANNER = gardenInfo.bannerImage;
    process.env.GARDENERS = JSON.stringify(gardeners);
    process.env.OPERATORS = JSON.stringify(operators);

    // Execute Foundry script
    const command = `forge script script/DeployGarden.s.sol:DeployGarden --private-key ${process.env.PRIVATE_KEY} --broadcast`;
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error("Error deploying garden:", error);
    throw error;
  }
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const csvPath = args.find((arg) => !arg.startsWith("--"));

    if (!csvPath) {
      console.error("Please provide a CSV file path as an argument");
      console.error("Usage: node GardenOnboarding.js [--dry-run] <path-to-csv>");
      process.exit(1);
    }

    // Read and parse the CSV file as raw rows
    const rows = await parseCSVRows(csvPath);

    // Skip the first line (instructions)
    // Next 4 lines are key-value pairs
    const name = rows[1][1] || rows[1][0]; // Handles both 'Name:' and 'Neme:'
    const description = rows[2][1];
    const location = rows[3][1];
    const bannerInput = rows[4][1];

    if (!bannerInput) {
      throw new Error("Banner image value is missing or the column header is incorrect in the CSV.");
    }

    console.log("Processing banner image...");
    const bannerImage = await processBannerImage(bannerInput);

    const gardenInfo = {
      name,
      description,
      location,
      bannerImage,
    };

    // Dynamically find the header row for operators/gardeners
    let header,
      headerRowIdx = -1;
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
        const operatorWallet = await createEmbeddedWallet(operatorId);
        console.log(`Created/found smart wallet for operator: ${operatorWallet}`);
        operators.add(operatorWallet);
        gardeners.add(operatorWallet); // Operators are also gardeners
      }

      // Process gardener
      if (row[gardenerIdx]) {
        const gardenerId = row[gardenerIdx].trim();
        console.log(`\nProcessing gardener: ${gardenerId}`);
        const gardenerWallet = await createEmbeddedWallet(gardenerId);
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

    if (dryRun) {
      console.log("\nDry run completed. Garden deployment skipped.");
      console.log("Garden info:", gardenInfo);
      console.log("Operator addresses:", operatorAddresses);
      console.log("Gardener addresses:", gardenerAddresses);
      process.exit(0);
    }

    // Deploy garden contract with separate whitelists
    console.log("\nDeploying garden contract...");
    await deployGarden(gardenInfo, gardenerAddresses, operatorAddresses);

    console.log("\nGarden onboarding completed successfully!");
  } catch (error) {
    console.error("Error in garden onboarding:", error);
    process.exit(1);
  }
}

main();
