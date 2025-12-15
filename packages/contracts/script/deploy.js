#!/usr/bin/env node

/**
 * deploy.js - Legacy entry point for backward compatibility
 *
 * This file now delegates to the new modular CLI structure in deploy/cli.js
 * All logic has been refactored into:
 * - deploy/cli.js - Main CLI entry point
 * - deploy/core.js - Core contract deployment
 * - deploy/gardens.js - Garden deployment
 * - deploy/actions.js - Action deployment
 * - deploy/anvil.js - Anvil management
 * - utils/network.js - Network configuration
 * - utils/validation.js - Config validation
 * - utils/cli-parser.js - CLI argument parsing
 *
 * This wrapper maintains backward compatibility with existing scripts.
 */

const dotenv = require("dotenv");
const path = require("node:path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

// Delegate to new modular CLI
const { DeploymentCLI } = require("./deploy/cli");

// Main execution
if (require.main === module) {
  const cli = new DeploymentCLI();
  cli.run(process.argv).catch(console.error);
}

// Export for programmatic use
module.exports = { DeploymentCLI };
