import { spawn } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface TestContractAddresses {
  deploymentRegistry: string;
  gardenToken: string;
  gardenAccount: string;
  eas: string;
}

/**
 * Deploy test contracts using Foundry for integration testing
 */
export async function deployTestContracts(): Promise<TestContractAddresses> {
  const contractsDir = join(process.cwd(), "../contracts");

  if (!existsSync(contractsDir)) {
    throw new Error(
      "Contracts directory not found. Make sure you're running from the admin package."
    );
  }

  // Create a test deployment script
  const deployScript = `
#!/bin/bash
set -e

cd ${contractsDir}

# Deploy to Base Sepolia
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --private-key $TEST_PRIVATE_KEY --broadcast --verify

# Extract contract addresses from broadcast artifacts
DEPLOYMENT_REGISTRY=$(jq -r '.transactions[] | select(.contractName == "DeploymentRegistry") | .contractAddress' broadcast/Deploy.s.sol/84532/run-latest.json)
GARDEN_TOKEN=$(jq -r '.transactions[] | select(.contractName == "GardenToken") | .contractAddress' broadcast/Deploy.s.sol/84532/run-latest.json)
GARDEN_ACCOUNT=$(jq -r '.transactions[] | select(.contractName == "GardenAccount") | .contractAddress' broadcast/Deploy.s.sol/84532/run-latest.json)
EAS=$(jq -r '.transactions[] | select(.contractName == "EAS") | .contractAddress' broadcast/Deploy.s.sol/84532/run-latest.json)

echo "{\\"deploymentRegistry\\": \\"$DEPLOYMENT_REGISTRY\\", \\"gardenToken\\": \\"$GARDEN_TOKEN\\", \\"gardenAccount\\": \\"$GARDEN_ACCOUNT\\", \\"eas\\": \\"$EAS\\"}"
  `;

  writeFileSync("/tmp/deploy-test-contracts.sh", deployScript);

  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["/tmp/deploy-test-contracts.sh"], {
      env: {
        ...process.env,
        BASE_SEPOLIA_RPC: process.env.VITE_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
        TEST_PRIVATE_KEY:
          process.env.TEST_PRIVATE_KEY ||
          "0x1234567890123456789012345678901234567890123456789012345678901234",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        try {
          // Extract JSON from the last line of output
          const lines = output.trim().split("\n");
          const contractAddresses = JSON.parse(lines[lines.length - 1]);
          resolve(contractAddresses);
        } catch (error) {
          reject(new Error(`Failed to parse contract addresses: ${error}`));
        }
      } else {
        reject(new Error(`Contract deployment failed: ${errorOutput}`));
      }
    });
  });
}

/**
 * Setup test environment for integration tests
 */
export async function setupIntegrationTest(): Promise<TestContractAddresses> {
  // Check if we're in integration test mode
  if (process.env.VITEST_INTEGRATION !== "true") {
    // Return mock addresses for unit tests
    return {
      deploymentRegistry: "0x1234567890123456789012345678901234567890",
      gardenToken: "0x2345678901234567890123456789012345678901",
      gardenAccount: "0x3456789012345678901234567890123456789012",
      eas: "0x4567890123456789012345678901234567890123",
    };
  }

  // Deploy actual contracts for integration tests
  return await deployTestContracts();
}

/**
 * Cleanup test contracts (optional - they'll be cleaned up when testnet resets)
 */
export async function cleanupTestContracts(addresses: TestContractAddresses): Promise<void> {
  // For Base Sepolia, we don't need to cleanup as test contracts are ephemeral
  // In a real scenario, you might want to call self-destruct functions if available
  // Test contracts deployed at: addresses (logged in development only)
}
