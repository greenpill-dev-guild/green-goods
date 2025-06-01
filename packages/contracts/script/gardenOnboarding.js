require("dotenv").config();
const { PrivyClient } = require("@privy-io/server-auth");
const { parse } = require("csv-parse");
const fs = require("fs");
const { execSync } = require("child_process");
const pinataSDK = require("@pinata/sdk");
const FormData = require("form-data");
const fetch = require("node-fetch");
const path = require("path");

// Initialize Privy client
const privyClient = new PrivyClient({
  apiKey: process.env.PRIVY_API_KEY,
});

// Initialize Pinata client
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);

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

// Function to upload to IPFS
async function uploadToIPFS(filePath) {
  try {
    const stream = fs.createReadStream(filePath);
    const options = {
      pinataMetadata: {
        name: path.basename(filePath),
      },
    };

    const result = await pinata.pinFileToIPFS(stream, options);
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

// Function to read and parse CSV file
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
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
    // Create a new user with the identifier and pregenerate their wallet
    const user = await privyClient.importUser({
      linkedAccounts: [
        {
          type: identifier.includes("@") ? "email" : "phone",
          address: identifier,
        },
      ],
      createEthereumWallet: true,
    });

    // Get the wallet address from the user's linked accounts
    const walletAccount = user.linkedAccounts.find(
      (account) => account.type === "wallet" && account.chain_type === "ethereum",
    );

    if (!walletAccount) {
      throw new Error(`No Ethereum wallet found for user ${identifier}`);
    }

    return walletAccount.address;
  } catch (error) {
    console.error(`Error creating wallet for ${identifier}:`, error);
    throw error;
  }
}

// Function to deploy garden contract using Foundry
async function deployGarden(gardenInfo, gardeners, operators) {
  try {
    // Create temporary config file for garden deployment
    const configPath = "./garden-config.json";
    const config = {
      gardenInfo: {
        name: gardenInfo.name,
        description: gardenInfo.description,
        location: gardenInfo.location,
        bannerImage: gardenInfo.bannerImage,
      },
      gardeners,
      operators,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Execute Foundry script
    const command = `forge script script/DeployGarden.s.sol:DeployGarden --private-key ${process.env.PRIVATE_KEY} --broadcast`;
    execSync(command, { stdio: "inherit" });

    // Clean up config file
    fs.unlinkSync(configPath);
  } catch (error) {
    console.error("Error deploying garden:", error);
    throw error;
  }
}

async function main() {
  try {
    // Get CSV file path from command line arguments
    const csvPath = process.argv[2];
    if (!csvPath) {
      console.error("Please provide a CSV file path as an argument");
      console.error("Usage: node GardenOnboarding.js <path-to-csv>");
      process.exit(1);
    }

    // Read and parse the CSV file
    const data = await parseCSV(csvPath);

    // Extract garden info from the first few rows (key-value pairs)
    const bannerInput = data[3]["Banner Image URL or Upload:"];
    console.log("Processing banner image...");
    const bannerImage = await processBannerImage(bannerInput);

    const gardenInfo = {
      name: data[0]["Neme:"],
      description: data[1]["Description:"],
      location: data[2]["Location:"],
      bannerImage,
    };

    // Extract operators and gardeners
    const operators = new Set();
    const gardeners = new Set();

    // Process all rows after the garden info
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (row["Garden Operators"]) {
        const operatorWallet = await createEmbeddedWallet(row["Garden Operators"]);
        operators.add(operatorWallet);
        // Operators are also gardeners
        gardeners.add(operatorWallet);
      }
      if (row["Gardeners"]) {
        const gardenerWallet = await createEmbeddedWallet(row["Gardeners"]);
        gardeners.add(gardenerWallet);
      }
    }

    // Convert Sets to Arrays
    const operatorAddresses = Array.from(operators);
    const gardenerAddresses = Array.from(gardeners);

    // Deploy garden contract with separate whitelists
    console.log("Deploying garden contract...");
    await deployGarden(gardenInfo, gardenerAddresses, operatorAddresses);

    console.log("Garden onboarding completed successfully!");
  } catch (error) {
    console.error("Error in garden onboarding:", error);
    process.exit(1);
  }
}

main();
