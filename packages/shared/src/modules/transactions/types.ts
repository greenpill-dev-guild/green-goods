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
  /** Account whose balance and fee quote authorize this call. */
  account?: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  /** Authoritative execution chain; omitted calls use the primary application account. */
  chainId?: number;
  value?: bigint;
}

export type BroadcastReference =
  | { kind: "transaction"; hash: Hex }
  | { kind: "user-operation"; hash: Hex; chainId?: number };

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
  /**
   * Called once, immediately before the call can reach the network. A passkey
   * sender calls it after the prompt is approved and signed, with the
   * UserOperation's hash. A wallet approves and broadcasts in one step, so its
   * sender calls it just before asking. A failure before this runs never sent.
   */
  onBeforeBroadcast?: (reference?: BroadcastReference) => Promise<void>;
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

export class TransactionReplacementError extends Error {
  readonly code: "transaction_cancelled" | "transaction_replaced";

  constructor(reason: "cancelled" | "replaced") {
    super(
      reason === "cancelled" ? "Transaction cancelled" : "Transaction replaced by a different call"
    );
    this.name = "TransactionReplacementError";
    this.code = reason === "cancelled" ? "transaction_cancelled" : "transaction_replaced";
  }
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
