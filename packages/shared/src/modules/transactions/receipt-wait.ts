/**
 * Transaction receipt wait
 *
 * @module modules/transactions/receipt-wait
 */

import type { Config } from "@wagmi/core";
import type { Hex, TransactionReceipt } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

export interface ReceiptWait {
  hash: Hex;
  chainId?: number;
  /** Milliseconds to wait. Without it, the wait lasts until the receipt arrives. */
  timeout?: number;
  onReplaced?: (replacement: { reason: "cancelled" | "replaced" | "repriced" }) => void;
}

/**
 * Waits for a transaction's receipt and returns it, reverted or not.
 *
 * wagmi's `waitForTransactionReceipt` never returns a reverted receipt: it replays the
 * transaction as a call to read a reason and throws whatever that replay throws, which can be the
 * same RPC error a lost receipt raises. This runs viem's own wait on the wagmi config's client for
 * the chain, so a revert arrives as `status: "reverted"` for the caller to act on, and only a wait
 * that failed rejects.
 */
export function waitForReceipt(
  config: Config,
  { hash, chainId, timeout = 0, onReplaced }: ReceiptWait
): Promise<TransactionReceipt> {
  return waitForTransactionReceipt(config.getClient({ chainId }), { hash, timeout, onReplaced });
}
