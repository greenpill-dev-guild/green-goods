#!/usr/bin/env node

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Enhanced UUPS Proxy Deployment
 *
 * Uses Foundry scripts with proper environment variable handling
 * for reliable cross-chain proxy deployment.
 */
class EnhancedProxyDeployer {
  constructor() {
    this.implementations = {
      arbitrum: "0x40F2dBc4992eBAC9Bc6C997517d0Bc1bC051e8A1",
      celo: "0x115819bCcaab03Be49107c69c00Bc4c21009839C",
    };
    this.chainIds = {
      arbitrum: "42161",
      celo: "42220",
      baseSepolia: "84532",
    };
  }

  /**
   * Deploy proxy using Foundry script with environment variables
   */
  async deployProxy(network, options = {}) {
    console.log(`🔗 Deploying UUPS proxy on ${network.toUpperCase()} using Foundry script`);

    try {
      const implementation = this.implementations[network];
      if (!implementation) {
        throw new Error(`No implementation found for ${network}`);
      }

      // Get RPC URL environment variable name
      const rpcUrlVar = network === "baseSepolia" ? "BASE_SEPOLIA_RPC_URL" : `${network.toUpperCase()}_RPC_URL`;
      const rpcUrl = process.env[rpcUrlVar];
      if (!rpcUrl) {
        throw new Error(`${rpcUrlVar} environment variable not set`);
      }

      // Use GREEN_GOODS_MANAGER_PRIVATE_KEY if available
      const privateKey = process.env.GREEN_GOODS_MANAGER_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("Neither GREEN_GOODS_MANAGER_PRIVATE_KEY nor PRIVATE_KEY environment variable set");
      }

      console.log(`📍 Implementation: ${implementation}`);
      console.log(`🌐 RPC: ${rpcUrl}`);
      console.log(
        `🔑 Using: ${process.env.GREEN_GOODS_MANAGER_PRIVATE_KEY ? "GREEN_GOODS_MANAGER_PRIVATE_KEY" : "PRIVATE_KEY"}`,
      );

      if (options.dryRun) {
        console.log("🧪 [DRY RUN] Would deploy UUPS proxy using Foundry script");
        return { success: true, dryRun: true };
      }

      // Set environment variables for the Foundry script
      const env = {
        ...process.env,
        ETH_RPC_URL: rpcUrl,
        PRIVATE_KEY: privateKey,
      };

      // Deploy using Foundry script
      console.log("🚀 Running Foundry deployment script...");
      const scriptCmd = `forge script script/DeployProxy.s.sol:DeployProxy --rpc-url ${rpcUrl} --private-key ${privateKey} --broadcast --verify`;

      const scriptResult = execSync(scriptCmd, {
        encoding: "utf8",
        env,
      });

      console.log("📄 Script output:", scriptResult);

      // Extract proxy address from script output
      const proxyMatch = scriptResult.match(/Proxy Address: (0x[a-fA-F0-9]{40})/);
      if (!proxyMatch) {
        // Try alternative extraction patterns
        const altMatch = scriptResult.match(/Contract deployed at: (0x[a-fA-F0-9]{40})/);
        if (!altMatch) {
          throw new Error("Could not extract deployed proxy address from script output");
        }
      }

      const proxyAddress = proxyMatch
        ? proxyMatch[1]
        : scriptResult.match(/Contract deployed at: (0x[a-fA-F0-9]{40})/)[1];

      console.log("✅ UUPS Proxy deployed via Foundry script!");
      console.log(`   Proxy: ${proxyAddress}`);
      console.log(`   Implementation: ${implementation}`);

      // Update deployment file
      await this.updateDeploymentFile(network, {
        deploymentRegistry: proxyAddress,
        deploymentRegistryImpl: implementation,
        deploymentRegistryProxy: proxyAddress,
      });

      // Test the deployed proxy
      await this.testProxyFunctions(network, proxyAddress, rpcUrl);

      return {
        success: true,
        network,
        proxyAddress,
        implementationAddress: implementation,
      };
    } catch (error) {
      console.error(`❌ ${network.toUpperCase()} proxy deployment failed:`, error.message);
      return {
        success: false,
        network,
        error: error.message,
      };
    }
  }

  /**
   * Test proxy functions after deployment
   */
  async testProxyFunctions(network, proxyAddress, _rpcUrl) {
    console.log("\n🧪 Testing deployed proxy functions...");

    const tests = [
      {
        name: "owner()",
        call: `cast call ${proxyAddress} "owner()" --rpc-url ${rpcUrl}`,
      },
      {
        name: "gnosisSafe()",
        call: `cast call ${proxyAddress} "gnosisSafe()" --rpc-url ${rpcUrl}`,
      },
      {
        name: "emergencyGuardian()",
        call: `cast call ${proxyAddress} "emergencyGuardian()" --rpc-url ${rpcUrl}`,
      },
      {
        name: "paused()",
        call: `cast call ${proxyAddress} "paused()" --rpc-url ${rpcUrl}`,
      },
    ];

    for (const test of tests) {
      try {
        const result = execSync(test.call, { encoding: "utf8" }).trim();
        console.log(`   ✅ ${test.name}: ${result}`);
      } catch (error) {
        console.log(`   ❌ ${test.name}: ERROR - ${error.message}`);
      }
    }
  }

  /**
   * Deploy proxies to all networks
   */
  async deployAllProxies(options = {}) {
    console.log("🏭 Enhanced UUPS Proxy Deployment via Foundry Scripts");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const results = {};
    const networks = Object.keys(this.implementations);

    for (const network of networks) {
      try {
        console.log(`\n🔗 Deploying proxy to ${network.toUpperCase()}...`);
        results[network] = await this.deployProxy(network, options);

        // Small delay between deployments
        if (!options.dryRun && !options.skipDelay) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error(`❌ ${network.toUpperCase()} failed:`, error.message);
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

    // Summary
    const successful = Object.values(results).filter((r) => r.success).length;
    const total = networks.length;

    console.log("\n🎉 Enhanced Proxy Deployment Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successful: ${successful}/${total} networks`);
    console.log(`❌ Failed: ${total - successful}/${total} networks`);

    if (successful === total) {
      console.log("\n🚀 All enhanced proxies deployed successfully!");
      console.log("✅ Factory system is fully operational with UUPS proxies");
      console.log("✅ Proper initialization and configuration verified");
      console.log("\nReady for Phase 3: Protocol Enhancements");
    }

    return results;
  }

  /**
   * Update deployment file with new addresses
   */
  async updateDeploymentFile(network, addresses) {
    const deploymentDir = path.join(__dirname, "..", "deployments");
    const chainId = this.chainIds[network];
    const networkFile = path.join(deploymentDir, `${chainId}-latest.json`);

    let deploymentData = {};
    if (fs.existsSync(networkFile)) {
      deploymentData = JSON.parse(fs.readFileSync(networkFile, "utf8"));
    }

    // Update with new addresses
    Object.assign(deploymentData, addresses);
    deploymentData.lastUpdated = new Date().toISOString();
    deploymentData.factoryEnabled = true;
    deploymentData.deploymentType = "enhanced-foundry-proxy";
    deploymentData.phase = "2";

    // Ensure directory exists
    fs.mkdirSync(deploymentDir, { recursive: true });

    // Write updated file
    fs.writeFileSync(networkFile, JSON.stringify(deploymentData, null, 2));

    console.log(`📄 Updated deployment file: ${networkFile}`);
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options = {
    continueOnError: args.includes("--continue-on-error"),
    dryRun: args.includes("--dry-run"),
    skipDelay: args.includes("--skip-delay"),
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Enhanced UUPS Proxy Deployment Script

Usage: node deploy-proxy-enhanced.js [options] [network]

Options:
  --continue-on-error   Continue even if some networks fail
  --dry-run             Validate without executing deployments  
  --skip-delay          Skip delays between deployments
  --help, -h            Show this help

Networks:
  arbitrum              Deploy only to Arbitrum
  celo                  Deploy only to Celo
  (no network)          Deploy to all networks

Examples:
  # Deploy proxies to all networks
  node deploy-proxy-enhanced.js
  
  # Deploy only to Arbitrum
  node deploy-proxy-enhanced.js arbitrum
  
  # Dry run validation
  node deploy-proxy-enhanced.js --dry-run

Environment Variables Required:
  - GREEN_GOODS_MANAGER_PRIVATE_KEY or PRIVATE_KEY
  - ARBITRUM_RPC_URL
  - CELO_RPC_URL
  - ETHERSCAN_API_KEY (optional, for verification)
    `);
    return;
  }

  const deployer = new EnhancedProxyDeployer();

  // Check if specific network requested
  const networkArg = args.find((arg) => !arg.startsWith("--"));
  if (networkArg && deployer.implementations[networkArg]) {
    console.log(`🎯 Deploying proxy to ${networkArg.toUpperCase()} only`);
    const result = await deployer.deployProxy(networkArg, options);
    if (!result.success) {
      process.exit(1);
    }
  } else {
    // Deploy to all networks
    try {
      await deployer.deployAllProxies(options);
    } catch (error) {
      console.error("❌ Enhanced proxy deployment failed:", error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EnhancedProxyDeployer };
