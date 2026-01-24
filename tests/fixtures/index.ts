/**
 * Test Fixtures Index
 *
 * Unified exports for Anvil fork testing infrastructure.
 *
 * @example
 * ```typescript
 * import {
 *   startAnvilFork,
 *   snapshotState,
 *   revertToSnapshot,
 *   TEST_ACCOUNTS,
 *   createGarden,
 *   Capital,
 * } from '../fixtures';
 *
 * const context = await startAnvilFork();
 * const snapshot = await snapshotState(context.testClient);
 *
 * // ... run tests ...
 *
 * await revertToSnapshot(context.testClient, snapshot);
 * await context.cleanup();
 * ```
 */

// ============================================================================
// ANVIL FORK
// ============================================================================

export {
  // Main fixture function
  startAnvilFork,
  // State management
  snapshotState,
  revertToSnapshot,
  impersonateAccount,
  stopImpersonating,
  setBalance,
  mineBlocks,
  increaseTime,
  setNextBlockTimestamp,
  // Re-exports from viem
  parseEther,
  // Types
  type AnvilForkContext,
  type ForkOptions,
  type DeploymentArtifact,
  type TestAccountWithSigner,
} from "./anvil-fork";

// ============================================================================
// CONFIGURATION
// ============================================================================

export {
  // Fork configuration
  FORK_CONFIG,
  // Test accounts
  TEST_ACCOUNTS,
  // Well-known contract addresses
  BASE_SEPOLIA_CONTRACTS,
  // Timeouts
  ANVIL_TIMEOUTS,
  // Types
  type TestAccountName,
  type TestAccount,
} from "./anvil-config";

// ============================================================================
// CONTRACT HELPERS
// ============================================================================

export {
  // Contract getters
  getGardenTokenContract,
  getActionRegistryContract,
  getGardenAccountContract,
  getEASContract,
  // High-level operations
  createGarden,
  addGardener,
  isGardener,
  isOperator,
  registerAction,
  submitWork,
  approveWork,
  // Utilities
  deployMockERC20,
  getBlockTimestamp,
  createActionTimestamps,
  // Enums
  Capital,
  // Types
  type CreateGardenParams,
  type GardenResult,
  type CreateActionParams,
  type ActionResult,
  type SubmitWorkParams,
  type WorkResult,
  type ApproveWorkParams,
  type ApprovalResult,
} from "./contract-helpers";
