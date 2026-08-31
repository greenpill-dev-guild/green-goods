import { waitForTransactionReceipt } from "@wagmi/core";
import { getWagmiConfig } from "../../../config/appkit";
import { TX_RECEIPT_TIMEOUT_MS } from "../../../utils/blockchain/polling";

type Receipt = Awaited<ReturnType<typeof waitForTransactionReceipt>>;

export class TransactionReceiptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
    );
    this.name = "TransactionReceiptTimeoutError";
  }
}

export class TransactionRevertedError extends Error {
  constructor(readonly hash: `0x${string}`) {
    super("Transaction reverted on chain. The action was not recorded.");
    this.name = "TransactionRevertedError";
  }
}

/**
 * Wait for a receipt, or fail loudly.
 *
 * `waitForTransactionReceipt` resolves with the receipt even when the
 * transaction reverted — it only rejects on timeout, replacement, or RPC
 * failure. Callers that treat "a receipt arrived" as "the write succeeded"
 * would record a decision that never landed, so the reverted case is raised
 * here rather than left to each call site to remember.
 */
export async function waitForReceiptWithTimeout(
  hash: `0x${string}`,
  chainId: number,
  timeoutMs: number = TX_RECEIPT_TIMEOUT_MS
): Promise<Receipt> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TransactionReceiptTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const receiptPromise = waitForTransactionReceipt(getWagmiConfig(), { hash, chainId });

  try {
    const receipt = await Promise.race([receiptPromise, timeoutPromise]);
    if (receipt.status === "reverted") {
      throw new TransactionRevertedError(hash);
    }
    return receipt;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
