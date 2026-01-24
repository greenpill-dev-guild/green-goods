/**
 * Anvil Fork Configuration
 *
 * Provides configuration for forking Base Sepolia and deterministic test accounts.
 * Uses Anvil default accounts which are consistent across all runs.
 */

// ============================================================================
// FORK CONFIGURATION
// ============================================================================

export const FORK_CONFIG = {
  /** RPC URL for forking (Base Sepolia by default) */
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",

  /** Optional: specific block number for deterministic tests */
  blockNumber: process.env.ANVIL_FORK_BLOCK ? BigInt(process.env.ANVIL_FORK_BLOCK) : undefined,

  /** Anvil local chain ID */
  chainId: 31337,

  /** Anvil RPC port */
  port: Number(process.env.ANVIL_PORT) || 8545,

  /** Anvil RPC URL */
  get rpcEndpoint() {
    return `http://127.0.0.1:${this.port}`;
  },
} as const;

// ============================================================================
// TEST ACCOUNTS (Anvil Defaults)
// ============================================================================

/**
 * Anvil's deterministic test accounts.
 * These are the same across every Anvil instance and are pre-funded with 10,000 ETH.
 *
 * @see https://book.getfoundry.sh/reference/anvil/#supported-transport-modes
 */
export const TEST_ACCOUNTS = {
  /** Account 0 - Used as deployer/admin */
  deployer: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const,
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const,
  },

  /** Account 1 - Used as garden operator */
  operator: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const,
  },

  /** Account 2 - Used as gardener 1 */
  gardener1: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const,
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const,
  },

  /** Account 3 - Used as gardener 2 */
  gardener2: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as const,
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const,
  },

  /** Account 4 - Used as assessor */
  assessor: {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" as const,
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as const,
  },

  /** Account 5 - Reserved for additional test roles */
  reserved1: {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" as const,
    privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as const,
  },
} as const;

// ============================================================================
// CONTRACT ADDRESSES (Base Sepolia)
// ============================================================================

/**
 * Well-known contract addresses on Base Sepolia.
 * Deployment-specific addresses are loaded dynamically from deployment artifacts.
 */
export const BASE_SEPOLIA_CONTRACTS = {
  /** EAS (Ethereum Attestation Service) on Base Sepolia */
  eas: "0x4200000000000000000000000000000000000021" as const,

  /** EAS Schema Registry on Base Sepolia */
  schemaRegistry: "0x4200000000000000000000000000000000000020" as const,
} as const;

// ============================================================================
// TIMEOUTS
// ============================================================================

/**
 * Timeouts for various operations in milliseconds.
 */
export const ANVIL_TIMEOUTS = {
  /** Time to wait for Anvil to start */
  startup: 15000,

  /** Time to wait for a transaction to be mined */
  transaction: 30000,

  /** Time to wait for RPC to respond */
  rpc: 5000,

  /** Polling interval when waiting for Anvil */
  pollInterval: 500,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TestAccountName = keyof typeof TEST_ACCOUNTS;
export type TestAccount = (typeof TEST_ACCOUNTS)[TestAccountName];
