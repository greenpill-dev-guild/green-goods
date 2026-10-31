import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ContractCall, TransactionSendOptions } from "./types";

export interface BatchScope {
  account: Address;
  chainId: number;
}

/** Reviewed per-group ceilings, not guessed global limits. Integer quantities are decimal strings. */
export interface BatchBudget {
  maxCalls: number;
  maxCalldataBytes: number;
  maxGas: string;
  maxFeePerGas: string;
  maxFee: string;
  sponsorship: "required" | "wallet";
}

export interface BatchQuote {
  gas: string;
  maxFeePerGas: string;
  maxFee: string;
  sponsored: boolean;
  /** EIP-5792 leaves final transaction gas/fees to the wallet; these are simulation ceilings. */
  authority: "user-operation" | "wallet";
}

export interface BatchCapability extends BatchScope {
  atomic: "supported" | "ready" | "unsupported" | "unknown";
}

/** A wallet call identifier is opaque; it must never be queried as a transaction hash. */
export type BatchReference = BatchScope &
  (
    | { kind: "wallet-calls"; id: string }
    | { kind: "wallet-transaction"; id: string }
    | { kind: "transaction"; hash: Hex }
    | { kind: "user-operation"; hash: Hex }
  );

/** Two references name the same submission when these match; a wallet's ID is compared exactly. */
export function batchReferenceKey(reference: BatchReference): string {
  return `${reference.kind}:${"id" in reference ? reference.id : reference.hash.toLowerCase()}`;
}

export interface BatchReceipt {
  transactionHash: Hex;
  status: "success" | "reverted";
}

export interface BatchExecution {
  status: "confirmed" | "reverted" | "unresolved";
  reference?: BatchReference;
  receipts: readonly BatchReceipt[];
  sponsored: boolean;
}

export type BatchSendOptions = TransactionSendOptions;

export type BatchItemState =
  | "prepared"
  | "awaiting-approval"
  | "submitted"
  | "confirmed"
  | "reverted"
  | "unresolved"
  | "declined"
  | "released";

export interface PreparedBatch {
  /** Minted per attempt and unique in this browser; a retry gets a new one. */
  id: string;
  account: Address;
  chainId: number;
  domain: string;
  mode: "atomic" | "sequential" | "single-call";
  fingerprint: Hex;
  budget?: BatchBudget;
  items: readonly {
    id: string;
    /** Structured-clone-safe call; calldata is also fingerprinted independently of the ABI. */
    call: Omit<ContractCall, "value"> & { value: string; data: Hex };
  }[];
}

export interface BatchGroup {
  quote?: BatchQuote;
  confirmedItemIds?: string[];
  itemIds: string[];
  status: BatchItemState;
  reference?: BatchReference;
  receipts: BatchReceipt[];
}

export interface BatchRecord {
  version: 1;
  id: string;
  scope: string;
  prepared: PreparedBatch;
  status: BatchItemState;
  itemStates: Record<string, BatchItemState>;
  groups: BatchGroup[];
  reference?: BatchReference;
  receipts: BatchReceipt[];
  updatedAt: number;
}

export interface BatchVerification extends BatchScope {
  itemIds: readonly string[];
  receipts: readonly BatchReceipt[];
}

/** The domain confirms which individual effects the execution receipts establish. */
export type VerifyBatchItems = (execution: BatchVerification) => Promise<readonly string[]>;

/** Kept for legacy hash-returning callers without inventing a hash for an accepted batch. */
export class BatchConfirmationPendingError extends Error {
  constructor(readonly execution: BatchExecution) {
    super("The batch outcome is unknown. Check its saved submission before sending again.");
    this.name = "BatchConfirmationPendingError";
  }
}

export interface BatchOperations {
  execute(
    prepared: PreparedBatch,
    options: {
      preflight: (prepared: PreparedBatch, itemIds: readonly string[]) => Promise<void>;
      verify: VerifyBatchItems;
    }
  ): Promise<BatchRecord>;
  reconcile(operationId: string, scope: BatchScope, verify: VerifyBatchItems): Promise<BatchRecord>;
  /** Call only for a person who has just seen fresh domain state and chosen to move on. */
  release(operationId: string, scope: BatchScope, verify: VerifyBatchItems): Promise<BatchRecord>;
  list(scope: BatchScope): Promise<BatchRecord[]>;
}

/** The adapter proves the business-call broadcast boundary was never crossed. */
export class BatchNotSubmittedError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "batch-not-submitted", { cause });
    this.name = "BatchNotSubmittedError";
  }
}
