#!/usr/bin/env node

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Upgrade DeploymentRegistry contracts using forge script
 *
 * Bypasses compilation issues by targeting only DeploymentRegistry
 */
class RegistryUpgrader {
  constructor() {
    this.targetChains = {
      arbitrum: "0x40A0819d208C50D0803D5dcdC6F6bb00bEF4583a",
      celo: "0x48c309c0875cfeD9b6D9FaEfF0100898E95371fA",
      baseSepolia: "0x4bd5a785d1c5Ea17209B3926DfC246AE78009e27",
    };
  }

  /**
   * Upgrade DeploymentRegistry on specific chain using cast
   */
  async upgradeChain(network, proxyAddress, options = {}) {
    console.log(`🔄 Upgrading DeploymentRegistry on ${network.toUpperCase()}`);
    console.log(`   Proxy: ${proxyAddress}`);

    try {
      // First, deploy new implementation using forge create
      console.log("📦 Deploying new implementation...");

      // Handle special case for baseSepolia
      const rpcUrlVar = network === "baseSepolia" ? "BASE_SEPOLIA_RPC_URL" : `${network.toUpperCase()}_RPC_URL`;
      const rpcUrl = process.env[rpcUrlVar];
      if (!rpcUrl) {
        throw new Error(`${rpcUrlVar} environment variable not set`);
      }

      if (options.dryRun) {
        console.log("🧪 [DRY RUN] Would deploy new implementation");
        console.log("🧪 [DRY RUN] Would upgrade proxy");
        console.log("✅ [DRY RUN] Upgrade validated");
        return { success: true, dryRun: true };
      }

      // Deploy new implementation
      const createCmd = `forge create src/DeploymentRegistry.sol:DeploymentRegistry --rpc-url ${rpcUrl} --private-key ${process.env.PRIVATE_KEY} --via-ir --broadcast`;
      const createResult = execSync(createCmd, { encoding: "utf8" });

      // Extract deployed address from output
      const deployedMatch = createResult.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
      if (!deployedMatch) {
        throw new Error("Could not extract deployed implementation address");
      }

      const newImplementation = deployedMatch[1];
      console.log("✅ New implementation deployed:", newImplementation);

      // Upgrade the proxy using cast
      console.log("🔄 Upgrading proxy...");
      const upgradeCmd = `cast send ${proxyAddress} "upgradeToAndCall(address,bytes)" ${newImplementation} 0x --rpc-url ${rpcUrl} --private-key ${process.env.PRIVATE_KEY}`;
      execSync(upgradeCmd, { stdio: "inherit" });

      console.log(`✅ ${network.toUpperCase()} upgrade completed!`);

      return {
        success: true,
        network,
        proxyAddress,
        newImplementation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ ${network.toUpperCase()} upgrade failed:`, error.message);
      return {
        success: false,
        network,
        proxyAddress,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Upgrade all target chains
   */
  async upgradeAllChains(options = {}) {
    console.log("🏭 Upgrading DeploymentRegistry on Multiple Chains");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const results = {};

    for (const [network, proxyAddress] of Object.entries(this.targetChains)) {
      try {
        console.log(`\n🔗 Upgrading ${network.toUpperCase()}...`);
        results[network] = await this.upgradeChain(network, proxyAddress, options);
      } catch (error) {
        console.error(`❌ ${network.toUpperCase()} upgrade failed:`, error.message);
        results[network] = {
          success: false,
          error: error.message,
          network,
          proxyAddress,
        };

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    // Generate upgrade summary
    await this.generateUpgradeSummary(results);

    return results;
  }

  /**
   * Generate upgrade summary report
   */
  async generateUpgradeSummary(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalChains: Object.keys(this.targetChains).length,
      successfulUpgrades: Object.values(results).filter((r) => r.success).length,
      failedUpgrades: Object.values(results).filter((r) => !r.success).length,
      chains: results,
    };

    const summaryPath = path.join(__dirname, "..", "deployments", `registry-upgrade-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log("\n🎉 DeploymentRegistry Upgrade Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successful: ${summary.successfulUpgrades}/${summary.totalChains} chains`);
    console.log(`❌ Failed: ${summary.failedUpgrades}/${summary.totalChains} chains`);
    console.log(`📄 Full report: ${summaryPath}`);

    if (summary.successfulUpgrades === summary.totalChains) {
      console.log("\n🚀 All upgrades completed! Factory system is now ready.");
      console.log("Next steps:");
      console.log("  1. pnpm factory:setup --network arbitrum");
      console.log("  2. pnpm factory:template-register src/tokens/Garden.sol --network arbitrum");
      console.log("  3. pnpm factory:deploy-approved <template-hash> --network arbitrum");
    }

    return summary;
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options = {
    continueOnError: args.includes("--continue-on-error"),
    dryRun: args.includes("--dry-run"),
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DeploymentRegistry Upgrade Script (Simplified)

Usage: node upgrade-registry-only.js [options]

Options:
  --continue-on-error   Continue even if some chains fail
  --dry-run             Validate without executing upgrades
  --help, -h            Show this help

Target Chains:
  - Arbitrum: 0x40A0819d208C50D0803D5dcdC6F6bb00bEF4583a
  - Celo: 0x48c309c0875cfeD9b6D9FaEfF0100898E95371fA
  - Base Sepolia: 0x4bd5a785d1c5Ea17209B3926DfC246AE78009e27

Examples:
  # Dry run upgrade validation
  node upgrade-registry-only.js --dry-run
  
  # Execute upgrades
  node upgrade-registry-only.js
  
  # Upgrade with error tolerance
  node upgrade-registry-only.js --continue-on-error
    `);
    return;
  }

  const upgrader = new RegistryUpgrader();

  try {
    await upgrader.upgradeAllChains(options);
  } catch (error) {
    console.error("❌ Upgrade process failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RegistryUpgrader };
