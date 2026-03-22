import type { Address } from "./domain";

// ============================================
// Weight Schemes
// ============================================

/**
 * Configurable weight scheme for conviction voting power.
 * Selected at garden mint time and immutable thereafter.
 *
 * Values correspond to the Solidity enum WeightScheme in IGardensModule.sol.
 * Each scheme defines (community, gardener, operator) weights in basis points
 * (10_000 = 1x multiplier). Weights must be >= 10_000 so that HAT-based
 * sources (binary balance=1) produce non-zero power after integer division
 * in UnifiedPowerRegistry: (1 * weight) / 10_000 > 0.
 *
 * - Linear:      (10_000, 20_000, 30_000)     -> 1x, 2x, 3x
 * - Exponential: (20_000, 40_000, 160_000)    -> 1x, 2x, 8x
 * - Power:       (30_000, 90_000, 810_000)    -> 1x, 3x, 27x
 */
export enum WeightScheme {
  Linear = 0,
  Exponential = 1,
  Power = 2,
}

/** Weight values (in basis points) for each role under a given scheme */
export interface WeightSchemeConfig {
  community: number;
  gardener: number;
  operator: number;
}

/** Maps WeightScheme enum to its (community, gardener, operator) bps values */
export const WEIGHT_SCHEME_VALUES: Record<WeightScheme, WeightSchemeConfig> = {
  [WeightScheme.Linear]: { community: 10_000, gardener: 20_000, operator: 30_000 },
  [WeightScheme.Exponential]: { community: 20_000, gardener: 40_000, operator: 160_000 },
  [WeightScheme.Power]: { community: 30_000, gardener: 90_000, operator: 810_000 },
};

// ============================================
// Garden Community
// ============================================

/** On-chain state for a garden's Gardens V2 RegistryCommunity */
export interface GardenCommunity {
  /** Garden address this community belongs to */
  gardenAddress: Address;
  /** RegistryCommunity contract address */
  communityAddress: Address;
  /** GOODS token address used for staking */
  goodsTokenAddress: Address;
  /** Immutable weight scheme selected at mint time */
  weightScheme: WeightScheme;
  /** Minimum GOODS stake required to join (in wei) */
  stakeAmount: bigint;
  /** Number of power sources registered in the unified registry (informational) */
  powerSourceCount?: number;
}

// ============================================
// Signal Pools
// ============================================

/** Type of signal pool attached to a garden */
export enum PoolType {
  /** Hypercert curation pool -- members signal support for registered hypercerts */
  Hypercert = 0,
  /** Action signaling pool -- members signal priority on registered Actions */
  Action = 1,
}

/** On-chain state for a garden's signal pool (CV strategy) */
export interface GardenSignalPool {
  /** Pool (strategy) contract address */
  poolAddress: Address;
  /** Type of pool */
  poolType: PoolType;
  /** Garden address this pool belongs to */
  gardenAddress: Address;
  /** RegistryCommunity address this pool is associated with */
  communityAddress: Address;
}

// ============================================
// Yield Allocation
// ============================================

/** Three-way split configuration for yield allocation (in basis points, must sum to 10000) */
export interface SplitConfig {
  /** Basis points allocated to Cookie Jar (gardener compensation) */
  cookieJarBps: number;
  /** Basis points allocated to Hypercert fraction purchases */
  fractionsBps: number;
  /** Basis points allocated to Juicebox treasury (grows GOODS backing) */
  juiceboxBps: number;
}

/** Default three-way split: 48.65% Cookie Jar, 48.65% Fractions, 2.7% Juicebox */
export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  cookieJarBps: 4865,
  fractionsBps: 4865,
  juiceboxBps: 270,
};

/**
 * Default minimum yield threshold in USD.
 * Mirrors the on-chain `minYieldThreshold` in YieldSplitter.sol.
 * Yield below this amount accumulates until the threshold is met.
 */
export const MIN_YIELD_THRESHOLD_USD = 7;

/** Record of a yield allocation event (from YieldSplitter) */
export interface YieldAllocation {
  /** Garden that generated the yield */
  gardenAddress: Address;
  /** Asset that was split (e.g., WETH, DAI) */
  assetAddress: Address;
  /** Amount sent to Cookie Jar */
  cookieJarAmount: bigint;
  /** Amount used for fraction purchases */
  fractionsAmount: bigint;
  /** Amount sent to Juicebox treasury */
  juiceboxAmount: bigint;
  /** Total yield allocated (sum of all three destinations) */
  totalAmount: bigint;
  /** Block timestamp of the allocation */
  timestamp: number;
  /** Transaction hash */
  txHash: string;
}

// ============================================
// Mutation Parameters
// ============================================

/** Parameters for triggering yield allocation */
export interface AllocateYieldParams {
  /** Garden to allocate yield for */
  gardenAddress: Address;
  /** Asset to split (e.g., WETH address) */
  assetAddress: Address;
  /** Vault address holding shares for this garden+asset */
  vaultAddress: Address;
}

/** Parameters for updating a garden's split ratio */
export interface SetSplitRatioParams {
  /** Garden to update */
  gardenAddress: Address;
  /** New Cookie Jar basis points */
  cookieJarBps: number;
  /** New fractions basis points */
  fractionsBps: number;
  /** New Juicebox basis points */
  juiceboxBps: number;
}
