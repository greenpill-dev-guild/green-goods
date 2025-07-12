#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

/**
 * Verify network configuration for deployment
 */
async function verifyNetworkConfig() {
  const configPath = path.join(__dirname, "../../deployments/networks.json");

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    console.log("🔍 Verifying network configuration...\n");

    for (const [networkName, networkConfig] of Object.entries(config.networks)) {
      console.log(`📡 ${networkName} (Chain ID: ${networkConfig.chainId})`);

      // Verify required fields
      const requiredFields = ["chainId", "name", "rpcUrl", "nativeCurrency", "contracts"];
      const missingFields = requiredFields.filter((field) => !networkConfig[field]);

      if (missingFields.length > 0) {
        console.log(`  ❌ Missing required fields: ${missingFields.join(", ")}`);
        continue;
      }

      // Verify RPC URL
      if (networkConfig.rpcUrl.includes("${")) {
        console.log(`  ⚠️  RPC URL contains environment variable: ${networkConfig.rpcUrl}`);
      }

      // Verify EAS contracts
      if (!networkConfig.contracts.eas || !networkConfig.contracts.easSchemaRegistry) {
        console.log("  ❌ Missing EAS contract addresses");
        continue;
      }

      // Test RPC connectivity (if not using env vars)
      if (!networkConfig.rpcUrl.includes("${")) {
        try {
          const response = await fetch(networkConfig.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_chainId",
              params: [],
              id: 1,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const chainId = Number.parseInt(data.result, 16);

            if (chainId === networkConfig.chainId) {
              console.log("  ✅ RPC connection successful");
            } else {
              console.log(`  ❌ Chain ID mismatch: expected ${networkConfig.chainId}, got ${chainId}`);
            }
          } else {
            console.log(`  ❌ RPC connection failed: ${response.status}`);
          }
        } catch (error) {
          console.log(`  ❌ RPC connection error: ${error.message}`);
        }
      }

      console.log("");
    }

    // Verify deployment defaults
    console.log("🔧 Verifying deployment defaults...");
    const defaults = config.deploymentDefaults;

    if (!defaults.salt || !defaults.factory || !defaults.tokenboundRegistry) {
      console.log("❌ Missing deployment defaults");
    } else {
      console.log("✅ Deployment defaults configured");
    }
  } catch (error) {
    console.error("❌ Failed to verify network configuration:", error.message);
    process.exit(1);
  }
}

// Run verification
verifyNetworkConfig().catch(console.error);
