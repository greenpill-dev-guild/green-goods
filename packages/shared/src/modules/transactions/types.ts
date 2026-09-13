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
  chainId?: number;
  value?: bigint;
}

export type BroadcastReference =
  | { kind: "transaction"; hash: Hex }
  | { kind: "user-operation"; hash: Hex };

export type BroadcastConfirmation =
  | { status: "confirmed"; transactionHash: Hex }
  | { status: "reverted" | "unresolved" };

/** Result of a transaction submission */
export interface TxResult {
  /** Opaque wallet identifiers have no execution receipt yet. */
  confirmation?: "pending";
  hash: Hex;
  sponsored: boolean;
}

export interface TransactionSendOptions {
  assertOwnership?: () => void | Promise<void>;
  onBroadcastReference?: (reference: BroadcastReference) => Promise<void>;
  onBroadcast?: (hash: Hex) => Promise<void>;
}

/**
 * Unified interface for sending contract transactions.
 *
 * Each auth mode implements this interface with different underlying
 * mechanisms (UserOps, EIP-5792, direct wallet tx).
 */
export interface TransactionSender {
  assertOwnership?: (address: Address, chainId: number) => void | Promise<void>;
  reconcileBroadcast?: (reference: BroadcastReference) => Promise<BroadcastConfirmation>;
  /** Send a single contract call */
  sendContractCall(call: ContractCall, options?: TransactionSendOptions): Promise<TxResult>;

  /** Send multiple calls in a batch (optional — check supportsBatching first) */
  sendBatch?(calls: ContractCall[]): Promise<TxResult>;

  /** Whether this sender supports gas sponsorship (paymaster) */
  readonly supportsSponsorship: boolean;

  /** Whether this sender supports batching multiple calls */
  readonly supportsBatching: boolean;

  /** The auth mode this sender handles */
  readonly authMode: "passkey" | "embedded" | "wallet";
}

/** A receipt proved failure; retry must be an explicit decision. */
export class TransactionRevertedError extends Error {
  constructor(
    readonly hash: Hex,
    message = "Transaction reverted on chain. The action was not recorded."
  ) {
    super(message);
    this.name = "TransactionRevertedError";
  }
}
