#!/usr/bin/env node

require("dotenv").config();
const { PrivyClient } = require("@privy-io/server-auth");
const fs = require("node:fs");

class PrivyAccountCreator {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      network: "localhost",
      outputFile: null,
      ...options,
    };
  }

  async validateEnvironment() {
    const requiredEnvVars = ["PRIVY_APP_ID", "PRIVY_APP_SECRET_ID", "PRIVY_AUTHORIZATION_PRIVATE_KEY"];

    if (!this.options.dryRun) {
      const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
      }
    }

    // Initialize Privy client
    if (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET_ID) {
      this.privyClient = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET_ID, {
        walletApi: {
          authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY,
        },
      });
    } else if (!this.options.dryRun) {
      throw new Error("Privy client not initialized. Check PRIVY_* environment variables.");
    }
  }

  async loadIdentifiersFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    let data;

    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON file: ${error.message}`);
    }

    // Support both array format and object with users array
    let identifiers = [];
    if (Array.isArray(data)) {
      identifiers = data;
    } else if (data.users && Array.isArray(data.users)) {
      identifiers = data.users;
    } else {
      throw new Error("JSON must contain an array of identifiers or a 'users' array");
    }

    if (identifiers.length === 0) {
      throw new Error("Identifiers array cannot be empty");
    }

    const validIdentifiers = [];
    const errors = [];

    for (const [index, identifier] of identifiers.entries()) {
      const lineNumber = index + 1;

      // Handle both string identifiers and objects with identifier field
      let actualIdentifier;
      if (typeof identifier === "string") {
        actualIdentifier = identifier;
      } else if (identifier && typeof identifier === "object" && identifier.identifier) {
        actualIdentifier = identifier.identifier;
      } else {
        errors.push(`Line ${lineNumber}: Invalid identifier format`);
        continue;
      }

      if (this.isValidIdentifier(actualIdentifier)) {
        validIdentifiers.push({
          identifier: actualIdentifier,
          name: `User ${lineNumber}`,
          lineNumber,
        });
      } else {
        errors.push(`Line ${lineNumber}: Invalid identifier format: ${actualIdentifier}`);
      }
    }

    if (errors.length > 0) {
      console.log("⚠️  Validation errors found:");
      errors.forEach((error) => console.log(`   ${error}`));
      console.log("");
    }

    if (validIdentifiers.length === 0) {
      throw new Error("No valid identifiers found in JSON file");
    }

    return validIdentifiers;
  }

  isValidIdentifier(identifier) {
    // Check if it's a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(identifier)) {
      return true;
    }

    // Check if it's a valid phone number (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (phoneRegex.test(identifier)) {
      return true;
    }

    return false;
  }

  async createOrGetUser(identifier) {
    if (this.options.dryRun) {
      console.log(`  [DRY RUN] Would create/get user for: ${identifier}`);
      return {
        identifier,
        walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
        status: "dry-run",
      };
    }

    try {
      let user;
      let isNewUser = false;

      // Try to get existing user first
      try {
        user = await this.privyClient.getUser(identifier);
        console.log(`  ✅ Found existing user for: ${identifier}`);
      } catch (error) {
        console.log("error", error);
        // User doesn't exist, create a new one
        console.log(`  🔄 Creating new user for: ${identifier}`);
        user = await this.privyClient.importUser({
          linkedAccounts: [
            identifier.includes("@") ? { type: "email", address: identifier } : { type: "phone", number: identifier },
          ],
          createEthereumWallet: true,
          createEthereumSmartWallet: true,
        });
        isNewUser = true;
      }

      // Check if user already has a smart wallet
      let smartWallet = user.linkedAccounts.find((account) => account.type === "smart_wallet");

      if (!smartWallet) {
        console.log(`  🔄 Creating smart wallet for: ${identifier}`);
        const updatedUser = await this.privyClient.updateUser(identifier, {
          createEthereumSmartWallet: true,
        });
        smartWallet = updatedUser.linkedAccounts.find((account) => account.type === "smart_wallet");
      }

      if (!smartWallet) {
        throw new Error(`Failed to create smart wallet for user ${identifier}`);
      }

      return {
        identifier,
        walletAddress: smartWallet.address,
        status: isNewUser ? "created" : "existing",
        isNewUser,
        hasSmartWallet: true,
      };
    } catch (error) {
      console.error(`  ❌ Error handling user ${identifier}:`, error.message);
      return {
        identifier,
        walletAddress: null,
        status: "error",
        error: error.message,
      };
    }
  }

  async createAccounts(identifiers) {
    console.log("\n🔐 Privy Smart Account Creation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total identifiers: ${identifiers.length}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Dry run: ${this.options.dryRun}`);

    const results = {
      successful: [],
      failed: [],
      summary: {
        total: identifiers.length,
        successful: 0,
        failed: 0,
        created: 0,
        existing: 0,
        network: this.options.network,
        timestamp: new Date().toISOString(),
      },
    };

    for (const [index, { identifier, name, lineNumber }] of identifiers.entries()) {
      console.log(`\n📋 Processing ${index + 1}/${identifiers.length}: ${identifier}`);
      console.log(`   Name: ${name} (Line: ${lineNumber})`);

      const result = await this.createOrGetUser(identifier);

      if (result.status === "error") {
        results.failed.push({ ...result, name, lineNumber });
        results.summary.failed++;
        console.log(`   ❌ Failed: ${result.error}`);
      } else {
        results.successful.push({ ...result, name, lineNumber });
        results.summary.successful++;

        if (result.isNewUser) {
          results.summary.created++;
          console.log(`   ✅ Created new user with smart wallet: ${result.walletAddress}`);
        } else {
          results.summary.existing++;
          console.log(`   ✅ Found existing user with smart wallet: ${result.walletAddress}`);
        }
      }
    }

    // Summary
    console.log("\n\n📊 Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successfully processed: ${results.summary.successful}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`🆕 New users created: ${results.summary.created}`);
    console.log(`👤 Existing users found: ${results.summary.existing}`);

    if (results.successful.length > 0) {
      console.log("\nSuccessful Accounts:");
      results.successful.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.name} (${account.identifier})`);
        console.log(`     Wallet: ${account.walletAddress}`);
        console.log(`     Status: ${account.status}`);
      });
    }

    if (results.failed.length > 0) {
      console.log("\nFailed Accounts:");
      results.failed.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.name} (${account.identifier})`);
        console.log(`     Error: ${account.error}`);
      });
    }

    // Export results
    if (this.options.outputFile || this.options.exportResults) {
      const filename = this.options.outputFile || `privy-accounts-${Date.now()}.json`;
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
🔐 Privy Smart Account Creator

Usage: node create-privy-accounts.js --file <input-file> [options]

Required:
  --file <path>           Input JSON file with identifiers

Options:
  --network <network>     Network context (default: localhost)
  --output <file>         Output file for results (default: auto-generated)
  --export-results        Export results to JSON file
  --dry-run              Validate without creating accounts
  --help, -h             Show this help

JSON Input Format:
Simple array of emails and phone numbers:

[
  "user@example.com",
  "+1234567890",
  "admin@company.com",
  "+9876543210"
]

Or with users wrapper:
{
  "users": [
    "user@example.com",
    "+1234567890"
  ]
}

Examples:
  # Create accounts from JSON file
  node create-privy-accounts.js --file users.json

  # Dry run to validate
  node create-privy-accounts.js --file users.json --dry-run

  # Export results
  node create-privy-accounts.js --file users.json --export-results

  # Custom output file
  node create-privy-accounts.js --file users.json --output results.json

Required Environment Variables:
  PRIVY_APP_ID                    - Privy client ID
  PRIVY_APP_SECRET_ID             - Privy app secret
  PRIVY_AUTHORIZATION_PRIVATE_KEY - Privy authorization key
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    dryRun: false,
    exportResults: false,
  };

  let inputFile;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file") {
      inputFile = args[++i];
    } else if (arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--output") {
      options.outputFile = args[++i];
    } else if (arg === "--export-results") {
      options.exportResults = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!inputFile) {
    console.error("❌ --file required");
    process.exit(1);
  }

  try {
    const creator = new PrivyAccountCreator(options);
    await creator.validateEnvironment();

    const identifiers = await creator.loadIdentifiersFromFile(inputFile);
    await creator.createAccounts(identifiers);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PrivyAccountCreator };
