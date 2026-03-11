/**
 * TransactionSender Abstraction Types
 *
 * Defines the common interface for sending contract transactions
 * across different auth modes (passkey, embedded, wallet).
 *
 * @module modules/transactions/types
 */

import type { Abi, Hex } from "viem";
import type { Address } from "../../types/domain";

/** A single contract call to execute */
export interface ContractCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

/** Result of a transaction submission */
export interface TxResult {
  hash: Hex;
  sponsored: boolean;
}

/**
 * Unified interface for sending contract transactions.
 *
 * Each auth mode implements this interface with different underlying
 * mechanisms (UserOps, EIP-5792, direct wallet tx).
 */
export interface TransactionSender {
  /** Send a single contract call */
  sendContractCall(call: ContractCall): Promise<TxResult>;

  /** Send multiple calls in a batch (optional — check supportsBatching first) */
  sendBatch?(calls: ContractCall[]): Promise<TxResult>;

  /** Whether this sender supports gas sponsorship (paymaster) */
  readonly supportsSponsorship: boolean;

  /** Whether this sender supports batching multiple calls */
  readonly supportsBatching: boolean;

  /** The auth mode this sender handles */
  readonly authMode: "passkey" | "embedded" | "wallet";
}
