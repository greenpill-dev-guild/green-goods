import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Release Gate: Sepolia-First Deployment Order
 *
 * Ensures Sepolia is deployed before Arbitrum or Celo.
 * Checks that the Sepolia deployment JSON has core contracts at non-zero addresses.
 * Can be bypassed with --override-sepolia-gate.
 */

const SEPOLIA_CHAIN_ID = "11155111";

const REQUIRED_CORE_CONTRACTS = ["gardenToken", "actionRegistry", "workResolver"] as const;

function contractsDir(): string {
  return path.join(__dirname, "../..");
}

function isZeroHex(value: string | undefined): boolean {
  if (!value) return true;
  return /^0x0+$/i.test(value);
}

function sepoliaDeploymentPath(): string {
  return path.join(contractsDir(), "deployments", `${SEPOLIA_CHAIN_ID}-latest.json`);
}

/**
 * Assert that Sepolia has been deployed before allowing broadcast to production chains.
 * Only blocks broadcast to Arbitrum or Celo. All other scenarios pass through.
 */
export function assertSepoliaGate(options: {
  network: string;
  broadcast: boolean;
  overrideSepoliaGate?: boolean;
}): void {
  const { network, broadcast, overrideSepoliaGate = false } = options;

  // Only gate broadcast to production chains
  if (!broadcast) return;
  if (network !== "arbitrum" && network !== "celo") return;

  if (overrideSepoliaGate) {
    console.warn(`\u26A0\uFE0F  Sepolia gate overridden for ${network}`);
    return;
  }

  const deploymentFile = sepoliaDeploymentPath();
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(
      `Sepolia gate: no deployment found at ${deploymentFile}. ` +
        "Deploy to Sepolia first or pass --override-sepolia-gate.",
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as Record<string, unknown>;

  const missing = REQUIRED_CORE_CONTRACTS.filter((key) => {
    const value = deployment[key];
    return typeof value !== "string" || !value.startsWith("0x") || isZeroHex(value);
  });

  if (missing.length > 0) {
    throw new Error(
      `Sepolia gate: core contracts not deployed on Sepolia: ${missing.join(", ")}. ` +
        "Deploy to Sepolia first or pass --override-sepolia-gate.",
    );
  }
}
