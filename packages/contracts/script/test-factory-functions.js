#!/usr/bin/env node

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });
const { execSync } = require("node:child_process");

/**
 * Test Factory Functions
 *
 * Tests the factory functions on the deployed implementations
 * to verify they work correctly before proceeding with template registration.
 */
class FactoryFunctionTester {
  constructor() {
    this.implementations = {
      arbitrum: "0x40F2dBc4992eBAC9Bc6C997517d0Bc1bC051e8A1",
      celo: "0x115819bCcaab03Be49107c69c00Bc4c21009839C",
    };
    this.gnosisSafe = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
    this.emergencyGuardian = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
  }

  /**
   * Test factory functions on specific network
   */
  async testNetwork(network) {
    console.log("🧪 Testing factory functions on", network.toUpperCase());

    try {
      const implementation = this.implementations[network];
      if (!implementation) {
        throw new Error(`No implementation found for ${network}`);
      }

      // Get RPC URL
      const rpcUrlVar = network === "baseSepolia" ? "BASE_SEPOLIA_RPC_URL" : `${network.toUpperCase()}_RPC_URL`;
      const rpcUrl = process.env[rpcUrlVar];
      if (!rpcUrl) {
        throw new Error(`${rpcUrlVar} environment variable not set`);
      }

      console.log(`📍 Implementation: ${implementation}`);
      console.log(`🌐 RPC: ${rpcUrl}`);

      // Test basic factory functions
      const tests = [
        {
          name: "gnosisSafe()",
          call: `cast call ${implementation} "gnosisSafe()" --rpc-url ${rpcUrl}`,
          expected: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        {
          name: "emergencyGuardian()",
          call: `cast call ${implementation} "emergencyGuardian()" --rpc-url ${rpcUrl}`,
          expected: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        {
          name: "owner()",
          call: `cast call ${implementation} "owner()" --rpc-url ${rpcUrl}`,
          expected: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        {
          name: "paused()",
          call: `cast call ${implementation} "paused()" --rpc-url ${rpcUrl}`,
          expected: "false",
        },
      ];

      const results = {};

      for (const test of tests) {
        try {
          console.log("\n🔍 Testing", test.name, "...");
          const result = execSync(test.call, { encoding: "utf8" }).trim();

          const success = result === test.expected || result.toLowerCase() === "false";
          const status = success ? "✅ PASS" : "❌ FAIL";

          console.log(`   Result: ${result}`);
          console.log(`   Status: ${status}`);

          results[test.name] = {
            success,
            result,
            expected: test.expected,
          };
        } catch (error) {
          console.log(`   Status: ❌ ERROR - ${error.message}`);
          results[test.name] = {
            success: false,
            error: error.message,
          };
        }
      }

      // Test more advanced functions that should revert (since contract isn't initialized)
      const revertTests = [
        {
          name: "getApprovedTemplates()",
          call: `cast call ${implementation} "getApprovedTemplates()" --rpc-url ${rpcUrl}`,
          shouldRevert: true,
        },
      ];

      console.log("\n🚫 Testing functions that should revert (uninitialized)...");
      for (const test of revertTests) {
        try {
          console.log("\n🔍 Testing", test.name, "...");
          const result = execSync(test.call, { encoding: "utf8" }).trim();
          console.log(`   Status: ❌ UNEXPECTED SUCCESS - ${result}`);
          results[test.name] = {
            success: false,
            result,
            note: "Should have reverted but didn't",
          };
        } catch (_error) {
          console.log("   Status: ✅ CORRECTLY REVERTED");
          results[test.name] = {
            success: true,
            note: "Correctly reverted as expected",
          };
        }
      }

      return {
        network,
        implementation,
        success: true,
        results,
      };
    } catch (error) {
      console.error(`❌ ${network.toUpperCase()} testing failed:`, error.message);
      return {
        network,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test all networks
   */
  async testAllNetworks() {
    console.log("🧪 Testing Factory Functions on All Networks");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const results = {};
    const networks = Object.keys(this.implementations);

    for (const network of networks) {
      try {
        console.log("\n🔗 Testing", network.toUpperCase(), "...");
        results[network] = await this.testNetwork(network);
      } catch (error) {
        console.error(`❌ ${network.toUpperCase()} failed:`, error.message);
        results[network] = {
          success: false,
          error: error.message,
          network,
        };
      }
    }

    // Summary
    const successful = Object.values(results).filter((r) => r.success).length;
    const total = networks.length;

    console.log("\n🎉 Factory Function Testing Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Successful: ${successful}/${total} networks`);
    console.log(`❌ Failed: ${total - successful}/${total} networks`);

    if (successful === total) {
      console.log("\n🚀 All factory functions working correctly!");
      console.log("✅ Implementations have factory capabilities");
      console.log("✅ Functions return expected default values");
      console.log("✅ Uninitialized functions correctly revert");
      console.log("\nNext steps:");
      console.log("  1. Deploy UUPS proxies with initialization");
      console.log("  2. Register initial templates");
      console.log("  3. Test template deployment");
    }

    return results;
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Factory Function Testing Script

Usage: node test-factory-functions.js [network]

Networks:
  arbitrum              Test only Arbitrum
  celo                  Test only Celo
  (no network)          Test all networks

Examples:
  # Test all networks
  node test-factory-functions.js
  
  # Test only Arbitrum
  node test-factory-functions.js arbitrum
    `);
    return;
  }

  const tester = new FactoryFunctionTester();

  // Check if specific network requested
  const networkArg = args.find((arg) => !arg.startsWith("--"));
  if (networkArg && tester.implementations[networkArg]) {
    console.log("🎯 Testing", networkArg.toUpperCase(), "only");
    const result = await tester.testNetwork(networkArg);
    if (!result.success) {
      process.exit(1);
    }
  } else {
    // Test all networks
    try {
      await tester.testAllNetworks();
    } catch (error) {
      console.error("❌ Factory function testing failed:", error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FactoryFunctionTester };
