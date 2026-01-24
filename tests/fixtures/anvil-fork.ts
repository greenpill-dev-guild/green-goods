/**
 * Anvil Fork Test Fixture
 *
 * Provides utilities for starting an Anvil fork, creating viem clients,
 * and managing blockchain state for integration testing.
 *
 * @example
 * ```typescript
 * const context = await startAnvilFork();
 * try {
 *   // Use context.testClient for Anvil manipulation (mine, setBalance, etc.)
 *   // Use context.publicClient for read operations
 *   // Use context.walletClient for write operations
 *   await context.testClient.setBalance({
 *     address: TEST_ACCOUNTS.gardener1.address,
 *     value: parseEther('100'),
 *   });
 * } finally {
 *   await context.cleanup();
 * }
 * ```
 */

import { spawn, type ChildProcess } from "node:child_process";
import {
  createTestClient,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type TestClient,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FORK_CONFIG, TEST_ACCOUNTS, ANVIL_TIMEOUTS } from "./anvil-config";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Deployment artifact structure from packages/contracts/deployments/
 */
export interface DeploymentArtifact {
  accountProxy: `0x${string}`;
  actionRegistry: `0x${string}`;
  assessmentResolver: `0x${string}`;
  deploymentRegistry: `0x${string}`;
  eas: {
    address: `0x${string}`;
    schemaRegistry: `0x${string}`;
  };
  gardenAccountImpl: `0x${string}`;
  gardenToken: `0x${string}`;
  guardian: `0x${string}`;
  rootGarden: {
    address: `0x${string}`;
    tokenId: number;
  };
  schemas: {
    assessmentSchemaUID: `0x${string}`;
    workApprovalSchemaUID: `0x${string}`;
    workSchemaUID: `0x${string}`;
    [key: string]: string;
  };
  workApprovalResolver: `0x${string}`;
  workResolver: `0x${string}`;
}

/**
 * Test account with address and account object
 */
export interface TestAccountWithSigner {
  address: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
}

/**
 * Full context for Anvil fork testing
 */
export interface AnvilForkContext {
  /** Test client for Anvil manipulation (mine, setBalance, snapshot, etc.) */
  testClient: TestClient;

  /** Public client for read operations */
  publicClient: PublicClient;

  /** Wallet client for write operations */
  walletClient: WalletClient;

  /** Pre-configured test accounts with signers */
  accounts: {
    deployer: TestAccountWithSigner;
    operator: TestAccountWithSigner;
    gardener1: TestAccountWithSigner;
    gardener2: TestAccountWithSigner;
    assessor: TestAccountWithSigner;
  };

  /** Deployment artifact with contract addresses */
  deployment: DeploymentArtifact;

  /** The chain configuration */
  chain: Chain;

  /** Cleanup function to kill Anvil process */
  cleanup: () => Promise<void>;

  /** Anvil process reference (for debugging) */
  process: ChildProcess | null;
}

/**
 * Options for starting Anvil fork
 */
export interface ForkOptions {
  /** Override fork block number */
  forkBlockNumber?: bigint;

  /** Override chain ID */
  chainId?: number;

  /** Override port */
  port?: number;

  /** Automatically fund test accounts */
  fundAccounts?: boolean;

  /** Amount to fund each account (default: 100 ETH) */
  fundAmount?: bigint;

  /** Skip actually starting Anvil (use existing instance) */
  useExistingAnvil?: boolean;
}

// ============================================================================
// ANVIL CHAIN DEFINITION
// ============================================================================

/**
 * Create a chain definition for Anvil fork
 */
function createAnvilChain(port: number, chainId: number): Chain {
  return {
    id: chainId,
    name: "Anvil Fork",
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH",
    },
    rpcUrls: {
      default: {
        http: [`http://127.0.0.1:${port}`],
      },
    },
  };
}

// ============================================================================
// ANVIL PROCESS MANAGEMENT
// ============================================================================

/**
 * Start Anvil process with fork configuration
 */
async function spawnAnvil(options: ForkOptions): Promise<ChildProcess> {
  const port = options.port ?? FORK_CONFIG.port;
  const args = [
    "--fork-url",
    FORK_CONFIG.rpcUrl,
    "--port",
    String(port),
    "--chain-id",
    String(options.chainId ?? FORK_CONFIG.chainId),
  ];

  // Add block number if specified
  if (options.forkBlockNumber ?? FORK_CONFIG.blockNumber) {
    args.push("--fork-block-number", String(options.forkBlockNumber ?? FORK_CONFIG.blockNumber));
  }

  // Silent mode for cleaner output
  args.push("--silent");

  console.log(`🔨 Starting Anvil: anvil ${args.join(" ")}`);

  const anvilProcess = spawn("anvil", args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Log any errors
  anvilProcess.stderr?.on("data", (data) => {
    const message = data.toString().trim();
    if (message && !message.includes("Listening on")) {
      console.error(`Anvil stderr: ${message}`);
    }
  });

  return anvilProcess;
}

/**
 * Wait for Anvil to be ready by polling the RPC endpoint
 */
async function waitForAnvil(port: number, timeout: number = ANVIL_TIMEOUTS.startup): Promise<void> {
  const endpoint = `http://127.0.0.1:${port}`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(endpoint, {
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
        const json = await response.json();
        if (json.result) {
          console.log(`✓ Anvil ready on port ${port} (chainId: ${json.result})`);
          return;
        }
      }
    } catch {
      // Connection refused - Anvil not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, ANVIL_TIMEOUTS.pollInterval));
  }

  throw new Error(`Anvil failed to start within ${timeout}ms`);
}

// ============================================================================
// DEPLOYMENT LOADING
// ============================================================================

/**
 * Load deployment artifact for the forked chain
 */
async function loadDeployment(): Promise<DeploymentArtifact> {
  try {
    // Use dynamic import with assertion for JSON module
    // Note: Requires Node.js 18+ with JSON module support
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // Resolve path relative to this file
    const deploymentPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../packages/contracts/deployments/84532-latest.json"
    );

    const content = await fs.readFile(deploymentPath, "utf-8");
    return JSON.parse(content) as DeploymentArtifact;
  } catch (error) {
    throw new Error(
      `Failed to load deployment artifact: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// MAIN FIXTURE
// ============================================================================

/**
 * Start an Anvil fork and create viem clients for testing
 *
 * @param options - Fork options
 * @returns Anvil fork context with clients and cleanup function
 *
 * @example
 * ```typescript
 * const context = await startAnvilFork();
 *
 * // Create a snapshot
 * const snapshotId = await snapshotState(context.testClient);
 *
 * // Make some changes...
 * await context.walletClient.sendTransaction({...});
 *
 * // Revert to snapshot
 * await revertToSnapshot(context.testClient, snapshotId);
 *
 * // Cleanup
 * await context.cleanup();
 * ```
 */
export async function startAnvilFork(options: ForkOptions = {}): Promise<AnvilForkContext> {
  const port = options.port ?? FORK_CONFIG.port;
  const chainId = options.chainId ?? FORK_CONFIG.chainId;
  const chain = createAnvilChain(port, chainId);
  const transport = http(`http://127.0.0.1:${port}`);

  let anvilProcess: ChildProcess | null = null;

  // Start Anvil unless using existing instance
  if (!options.useExistingAnvil) {
    anvilProcess = await spawnAnvil(options);
    await waitForAnvil(port);
  } else {
    // Verify existing Anvil is accessible
    await waitForAnvil(port, 5000).catch(() => {
      throw new Error(`No existing Anvil instance found on port ${port}`);
    });
  }

  // Create clients
  const testClient = createTestClient({
    chain,
    mode: "anvil",
    transport,
  });

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const walletClient = createWalletClient({
    chain,
    transport,
  });

  // Create account signers
  const accounts = {
    deployer: {
      address: TEST_ACCOUNTS.deployer.address,
      account: privateKeyToAccount(TEST_ACCOUNTS.deployer.privateKey),
    },
    operator: {
      address: TEST_ACCOUNTS.operator.address,
      account: privateKeyToAccount(TEST_ACCOUNTS.operator.privateKey),
    },
    gardener1: {
      address: TEST_ACCOUNTS.gardener1.address,
      account: privateKeyToAccount(TEST_ACCOUNTS.gardener1.privateKey),
    },
    gardener2: {
      address: TEST_ACCOUNTS.gardener2.address,
      account: privateKeyToAccount(TEST_ACCOUNTS.gardener2.privateKey),
    },
    assessor: {
      address: TEST_ACCOUNTS.assessor.address,
      account: privateKeyToAccount(TEST_ACCOUNTS.assessor.privateKey),
    },
  };

  // Fund accounts if requested
  if (options.fundAccounts !== false) {
    const fundAmount = options.fundAmount ?? parseEther("100");
    for (const [name, account] of Object.entries(accounts)) {
      await testClient.setBalance({
        address: account.address,
        value: fundAmount,
      });
      console.log(`  💰 Funded ${name}: ${account.address}`);
    }
  }

  // Load deployment
  const deployment = await loadDeployment();
  console.log(`  📜 Loaded deployment: gardenToken=${deployment.gardenToken}`);

  // Cleanup function
  const cleanup = async () => {
    if (anvilProcess) {
      console.log("🛑 Stopping Anvil...");
      anvilProcess.kill("SIGTERM");

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          anvilProcess?.kill("SIGKILL");
          resolve();
        }, 5000);

        anvilProcess?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };

  return {
    testClient,
    publicClient,
    walletClient,
    accounts,
    deployment,
    chain,
    cleanup,
    process: anvilProcess,
  };
}

// ============================================================================
// STATE MANAGEMENT UTILITIES
// ============================================================================

/**
 * Create a snapshot of the current blockchain state
 *
 * @param testClient - The test client from AnvilForkContext
 * @returns Snapshot ID that can be used with revertToSnapshot
 */
export async function snapshotState(testClient: TestClient): Promise<`0x${string}`> {
  const snapshotId = await testClient.snapshot();
  console.log(`📸 Snapshot created: ${snapshotId}`);
  return snapshotId;
}

/**
 * Revert to a previously created snapshot
 *
 * @param testClient - The test client from AnvilForkContext
 * @param snapshotId - The snapshot ID returned from snapshotState
 */
export async function revertToSnapshot(
  testClient: TestClient,
  snapshotId: `0x${string}`
): Promise<void> {
  await testClient.revert({ id: snapshotId });
  console.log(`⏪ Reverted to snapshot: ${snapshotId}`);
}

/**
 * Impersonate an account (allows sending transactions as that address)
 *
 * @param testClient - The test client from AnvilForkContext
 * @param address - The address to impersonate
 */
export async function impersonateAccount(
  testClient: TestClient,
  address: `0x${string}`
): Promise<void> {
  await testClient.impersonateAccount({ address });
  console.log(`🎭 Impersonating: ${address}`);
}

/**
 * Stop impersonating an account
 *
 * @param testClient - The test client from AnvilForkContext
 * @param address - The address to stop impersonating
 */
export async function stopImpersonating(
  testClient: TestClient,
  address: `0x${string}`
): Promise<void> {
  await testClient.stopImpersonatingAccount({ address });
}

/**
 * Set the balance of an address
 *
 * @param testClient - The test client from AnvilForkContext
 * @param address - The address to set balance for
 * @param value - The balance in wei
 */
export async function setBalance(
  testClient: TestClient,
  address: `0x${string}`,
  value: bigint
): Promise<void> {
  await testClient.setBalance({ address, value });
}

/**
 * Mine a specified number of blocks
 *
 * @param testClient - The test client from AnvilForkContext
 * @param count - Number of blocks to mine (default: 1)
 */
export async function mineBlocks(testClient: TestClient, count: number = 1): Promise<void> {
  await testClient.mine({ blocks: count });
}

/**
 * Increase the block timestamp
 *
 * @param testClient - The test client from AnvilForkContext
 * @param seconds - Number of seconds to increase by
 */
export async function increaseTime(testClient: TestClient, seconds: number): Promise<void> {
  await testClient.increaseTime({ seconds });
  // Mine a block to apply the time change
  await testClient.mine({ blocks: 1 });
}

/**
 * Set the next block's timestamp
 *
 * @param testClient - The test client from AnvilForkContext
 * @param timestamp - Unix timestamp for next block
 */
export async function setNextBlockTimestamp(
  testClient: TestClient,
  timestamp: bigint
): Promise<void> {
  await testClient.setNextBlockTimestamp({ timestamp });
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { TEST_ACCOUNTS, FORK_CONFIG, ANVIL_TIMEOUTS } from "./anvil-config";
export { parseEther } from "viem";
