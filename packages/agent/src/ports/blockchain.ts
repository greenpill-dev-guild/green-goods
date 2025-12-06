/**
 * Blockchain Port - Interface for on-chain interactions
 *
 * This port defines the contract for blockchain operations including
 * work submission, approvals, and verification.
 */

import type { Hex } from "viem";

/**
 * Garden information from on-chain
 */
export interface GardenInfo {
  exists: boolean;
  name?: string;
  address: string;
}

/**
 * Work submission parameters
 */
export interface SubmitWorkParams {
  /** Private key for the custodial wallet */
  privateKey: Hex;
  /** Garden contract address */
  gardenAddress: string;
  /** Action UID from the registry */
  actionUID: number;
  /** Action title for the attestation */
  actionTitle: string;
  /** Work data to submit */
  workData: {
    title: string;
    plantSelection: string[];
    plantCount: number;
    feedback: string;
  };
  /** Media files (Buffer for server-side) */
  media?: Buffer[];
}

/**
 * Work approval parameters
 */
export interface SubmitApprovalParams {
  /** Private key for the operator wallet */
  privateKey: Hex;
  /** Gardener's wallet address */
  gardenerAddress: string;
  /** Work attestation UID to approve */
  workUID: string;
  /** Whether to approve (true) or reject (false) */
  approved: boolean;
  /** Feedback message */
  feedback?: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  verified: boolean;
  reason?: string;
  cachedAt?: number;
}

/**
 * Blockchain port interface
 */
export interface BlockchainPort {
  // ============================================================================
  // SUBMISSIONS
  // ============================================================================

  /**
   * Submit work attestation to EAS.
   *
   * @param params - Work submission parameters
   * @returns Transaction hash
   */
  submitWork(params: SubmitWorkParams): Promise<Hex>;

  /**
   * Submit work approval/rejection attestation to EAS.
   *
   * @param params - Approval parameters
   * @returns Transaction hash
   */
  submitApproval(params: SubmitApprovalParams): Promise<Hex>;

  // ============================================================================
  // VERIFICATION
  // ============================================================================

  /**
   * Check if an address is an operator for a garden.
   *
   * @param gardenAddress - Garden contract address
   * @param userAddress - Address to check
   * @returns Verification result
   */
  isOperator(
    gardenAddress: string,
    userAddress: string
  ): Promise<VerificationResult>;

  /**
   * Check if an address is a gardener in a garden.
   *
   * @param gardenAddress - Garden contract address
   * @param userAddress - Address to check
   * @returns Verification result
   */
  isGardener(
    gardenAddress: string,
    userAddress: string
  ): Promise<VerificationResult>;

  /**
   * Get garden information from on-chain.
   *
   * @param gardenAddress - Garden contract address
   * @returns Garden info or undefined if not found
   */
  getGardenInfo(gardenAddress: string): Promise<GardenInfo | undefined>;

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Get the current chain ID.
   */
  getChainId(): number;

  /**
   * Clear verification caches.
   */
  clearCache(): void;
}

