import type { Address } from "./domain";

// ============================================
// HatsModule Strategy Configuration
// ============================================

export interface SetConvictionStrategiesParams {
  gardenAddress: Address;
  strategies: Address[];
}

// ============================================
// HypercertSignalPool Types
// ============================================

/** Support change for a hypercert in the signal pool */
export interface HypercertSignal {
  hypercertId: bigint;
  /** Can be negative to reduce support (int256 on-chain) */
  deltaSupport: bigint;
}

/** On-chain state for a registered hypercert */
export interface HypercertEntry {
  hypercertId: bigint;
  stakedAmount: bigint;
  convictionLast: bigint;
  blockLast: bigint;
  active: boolean;
}

/** Conviction weight for a single hypercert (from getConvictionWeights) */
export interface ConvictionWeight {
  hypercertId: bigint;
  weight: bigint;
}

/** A voter's power and allocation state */
export interface MemberPower {
  totalStake: bigint;
  pointsBudget: bigint;
  isEligible: boolean;
  allocations: VoterAllocation[];
}

/** A voter's support allocation for a specific hypercert */
export interface VoterAllocation {
  hypercertId: bigint;
  amount: bigint;
}

/** Parameters for allocating support via the signal pool */
export interface AllocateHypercertSupportParams {
  poolAddress: Address;
  signals: HypercertSignal[];
}

/** Parameters for registering a hypercert in the signal pool */
export interface RegisterHypercertParams {
  poolAddress: Address;
  hypercertId: bigint;
}

/** Parameters for deregistering a hypercert from the signal pool */
export interface DeregisterHypercertParams {
  poolAddress: Address;
  hypercertId: bigint;
}

/** Parameters for setting decay rate on a signal pool */
export interface SetDecayParams {
  poolAddress: Address;
  newDecay: bigint;
}

/** Parameters for setting points per voter on a signal pool */
export interface SetPointsPerVoterParams {
  poolAddress: Address;
  newPoints: bigint;
}

/** Parameters for setting role hat IDs on a signal pool */
export interface SetRoleHatIdsParams {
  poolAddress: Address;
  hatIds: bigint[];
}
