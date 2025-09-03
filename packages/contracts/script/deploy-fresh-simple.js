#!/usr/bin/env node

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Deploy Fresh Factory Systems (Simplified)
 *
 * Deploys new DeploymentRegistry contracts directly (not as proxies initially)
 * with factory functionality across multiple chains using a secure account.
 */
class SimpleFreshFactoryDeployer {
  constructor() {
    this.targetChains = ["arbitrum", "celo", "baseSepolia"]; // Base not deployed yet
    this.gnosisSafe = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
    this.emergencyGuardian = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6"; // GREEN_GOODS_MANAGER address
    this.afoEthAddress = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e"; // afo.eth address
  }

  /**
   * Deploy fresh factory on specific chain
   */
  async deployChain(network, options = {}) {
    console.log(`🏭 Deploying fresh factory on ${network.toUpperCase()}`);

    try {
      // Get RPC URL
      const rpcUrlVar = network === "baseSepolia" ? "BASE_SEPOLIA_RPC_URL" : `${network.toUpperCase()}_RPC_URL`;
      const rpcUrl = process.env[rpcUrlVar];
      if (!rpcUrl) {
        throw new Error(`${rpcUrlVar} environment variable not set`);
      }

      // Use GREEN_GOODS_MANAGER_PRIVATE_KEY if available, fallback to PRIVATE_KEY
      const privateKey = process.env.GREEN_GOODS_MANAGER_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("Neither GREEN_GOODS_MANAGER_PRIVATE_KEY nor PRIVATE_KEY environment variable set");
      }

      if (options.dryRun) {
        console.log("🧪 [DRY RUN] Would deploy fresh DeploymentRegistry with factory functions");
        console.log(`   RPC: ${rpcUrl}`);
        console.log(`   Gnosis Safe: ${this.gnosisSafe}`);
        console.log(`   Emergency Guardian: ${this.emergencyGuardian}`);
        console.log("✅ [DRY RUN] Deployment validated");
        return { success: true, dryRun: true };
      }

      const result = {
        network,
        success: false,
        gnosisSafe: this.gnosisSafe,
        emergencyGuardian: this.emergencyGuardian,
        timestamp: new Date().toISOString(),
      };

      // Get deployer address
      const deployerAddress = await this.getDeployerAddress(privateKey);
      console.log("📋 Deployer address:", deployerAddress);

      // Step 1: Deploy DeploymentRegistry directly
      console.log("📦 Deploying DeploymentRegistry...");
      let createCmd = `forge create src/DeploymentRegistry.sol:DeploymentRegistry --rpc-url ${rpcUrl} --private-key ${privateKey} --via-ir --broadcast`;

      if (options.verify) {
        createCmd += " --verify";
      }

      const createResult = execSync(createCmd, { encoding: "utf8" });

      // Extract deployed address
      const deployedMatch = createResult.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
      if (!deployedMatch) {
        throw new Error("Could not extract deployed contract address");
      }

      const contractAddress = deployedMatch[1];
      console.log("✅ DeploymentRegistry deployed:", contractAddress);
      result.contractAddress = contractAddress;

      // Step 2: Initialize with factory settings
      console.log("⚙️  Initializing with factory settings...");

      // Initialize with Safe and Guardian
      const initCmd = `cast send ${contractAddress} "initializeWithSafe(address,address,address)" ${deployerAddress} ${this.gnosisSafe} ${this.emergencyGuardian} --rpc-url ${rpcUrl} --private-key ${privateKey}`;
      execSync(initCmd, { stdio: "inherit" });
      console.log("✅ Factory initialized with Gnosis Safe and Emergency Guardian");

      // Step 3: Update deployment files
      await this.updateDeploymentFiles(network, {
        deploymentRegistry: contractAddress,
      });

      console.log(`🎉 ${network.toUpperCase()} factory deployment completed!`);
      console.log(`   Contract: ${contractAddress}`);
      console.log(`   Owner: ${deployerAddress}`);
      console.log(`   Gnosis Safe: ${this.gnosisSafe}`);
      console.log(`   Emergency Guardian: ${this.emergencyGuardian}`);

      result.success = true;
      return result;
    } catch (error) {
      console.error(`❌ ${network.toUpperCase()} deployment failed:`, error.message);
      return {
        success: false,
        network,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Deploy fresh factories to all target chains
   */
  async deployAllChains(options = {}) {
    console.log("🏭 Deploying Fresh Factory Systems to Multiple Chains");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  WARNING: This will deploy completely new factory systems!");
    console.log("⚠️  The old compromised deployer account will be replaced.");
    console.log("");

    const results = {};

    for (const network of this.targetChains) {
      try {
        console.log(`\n🔗 Deploying to ${network.toUpperCase()}...`);
        results[network] = await this.deployChain(network, options);
      } catch (error) {
        console.error(`❌ ${network.toUpperCase()} deployment failed:`, error.message);
        results[network] = {
          success: false,
          error: error.message,
          network,
        };

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    // Generate deployment summary
    await this.generateDeploymentSummary(results);

    return results;
  }

  /**
   * Get deployer address from private key
   */
  async getDeployerAddress(privateKey) {
    // Use cast to get address from private key
    const addressCmd = `cast wallet address ${privateKey}`;
    const result = execSync(addressCmd, { encoding: "utf8" });
    return result.trim();
  }

  /**
   * Update deployment files with new addresses
   */
  async updateDeploymentFiles(network, addresses) {
    // Update the network-specific deployment file
    const deploymentDir = path.join(__dirname, "..", "deployments");
    const networkFile = path.join(deploymentDir, `${this.getChainId(network)}-latest.json`);

    let deploymentData = {};
    if (fs.existsSync(networkFile)) {
      deploymentData = JSON.parse(fs.readFileSync(networkFile, "utf8"));
    }

    // Update with new addresses
    Object.assign(deploymentData, addresses);
    deploymentData.lastUpdated = new Date().toISOString();
    deploymentData.factoryEnabled = true;
    deploymentData.deploymentType = "fresh-factory";

    // Ensure directory exists
    fs.mkdirSync(deploymentDir, { recursive: true });

    // Write updated file
    fs.writeFileSync(networkFile, JSON.stringify(deploymentData, null, 2));

    console.log(`📄 Updated deployment file: ${networkFile}`);
  }

  /**
   * Get chain ID for network name
   */
  getChainId(network) {
    const chainIds = {
      arbitrum: "42161",
      celo: "42220",
      baseSepolia: "84532",
    };
    return chainIds[network] || network;
  }

  /**
   * Generate deployment summary report
   */
  async generateDeploymentSummary(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalChains: this.targetChains.length,
      successfulDeployments: Object.values(results).filter((r) => r.success).length,
      failedDeployments: Object.values(results).filter((r) => !r.success).length,
      gnosisSafe: this.gnosisSafe,
      emergencyGuardian: this.emergencyGuardian,
      afoEthAddress: this.afoEthAddress,
      chains: results,
    };

    const summaryPath = path.join(__dirname, "..", "deployments", `fresh-factory-simple-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log("\n🎉 Fresh Factory Deployment Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successful: ${summary.successfulDeployments}/${summary.totalChains} chains`);
    console.log(`❌ Failed: ${summary.failedDeployments}/${summary.totalChains} chains`);
    console.log(`🔐 Gnosis Safe: ${this.gnosisSafe}`);
    console.log(`🛡️  Emergency Guardian: ${this.emergencyGuardian} (GREEN_GOODS_MANAGER)`);
    console.log(`👤 afo.eth: ${this.afoEthAddress}`);
    console.log(`📄 Full report: ${summaryPath}`);

    if (summary.successfulDeployments === summary.totalChains) {
      console.log("\n🚀 All fresh factories deployed successfully!");
      console.log("Next steps:");
      console.log("  1. Test factory functionality:");
      console.log("     pnpm factory:template-register src/tokens/Garden.sol --network arbitrum");
      console.log("  2. Register initial templates:");
      console.log("     pnpm factory:template-register src/registries/Action.sol --network arbitrum");
      console.log("     pnpm factory:template-register src/resolvers/Work.sol --network arbitrum");
      console.log("     pnpm factory:template-register src/resolvers/WorkApproval.sol --network arbitrum");
      console.log("  3. Update indexer configurations with new addresses");
      console.log("  4. Update client configurations if needed");
    } else {
      console.log("\n⚠️  Some deployments failed. Check the full report for details.");
    }

    return summary;
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options = {
    broadcast: true, // Always broadcast for fresh deployments
    verify: args.includes("--verify"),
    continueOnError: args.includes("--continue-on-error"),
    dryRun: args.includes("--dry-run"),
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Fresh Factory Deployment Script (Simplified)

Usage: node deploy-fresh-simple.js [options]

Options:
  --verify              Verify contracts on Etherscan
  --continue-on-error   Continue even if some chains fail
  --dry-run             Validate without executing deployments
  --help, -h            Show this help

Target Chains:
  - Arbitrum (42161)
  - Celo (42220)
  - Base Sepolia (84532)

Configuration:
  - Gnosis Safe: 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19
  - Emergency Guardian: 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6 (GREEN_GOODS_MANAGER)
  - afo.eth: 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e

Environment Variables Required:
  - GREEN_GOODS_MANAGER_PRIVATE_KEY or PRIVATE_KEY
  - ARBITRUM_RPC_URL
  - CELO_RPC_URL  
  - BASE_SEPOLIA_RPC_URL
  - ETHERSCAN_API_KEY (optional, for verification)

Examples:
  # Dry run deployment validation
  node deploy-fresh-simple.js --dry-run
  
  # Deploy fresh factories
  node deploy-fresh-simple.js --verify
  
  # Deploy with error tolerance
  node deploy-fresh-simple.js --verify --continue-on-error
    `);
    return;
  }

  // Validate environment
  const requiredEnvVars = ["ARBITRUM_RPC_URL", "CELO_RPC_URL", "BASE_SEPOLIA_RPC_URL"];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    process.exit(1);
  }

  const privateKey = process.env.GREEN_GOODS_MANAGER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Missing private key: Set GREEN_GOODS_MANAGER_PRIVATE_KEY or PRIVATE_KEY");
    process.exit(1);
  }

  console.log("✅ Environment validation passed");

  const deployer = new SimpleFreshFactoryDeployer();

  try {
    await deployer.deployAllChains(options);
  } catch (error) {
    console.error("❌ Fresh factory deployment failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SimpleFreshFactoryDeployer };
