import { TransactionRevertedError } from "../../transactions/types";
export { TransactionRevertedError } from "../../transactions/types";
import { getWagmiConfig } from "../../../config/appkit";
import { TX_RECEIPT_TIMEOUT_MS } from "../../../utils/blockchain/polling";
import { waitForReceipt } from "../../transactions/receipt-wait";

type Receipt = Awaited<ReturnType<typeof waitForReceipt>>;

export class TransactionReceiptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
    );
    this.name = "TransactionReceiptTimeoutError";
  }
}

/**
 * Wait for a receipt, or fail loudly.
 *
 * `waitForReceipt` resolves with the receipt even when the transaction
 * reverted, and rejects only when the wait itself fails. Callers that treat
 * "a receipt arrived" as "the write succeeded" would record a decision that
 * never landed, so the reverted case is raised here rather than left to each
 * call site to remember.
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

  const receiptPromise = waitForReceipt(getWagmiConfig(), { hash, chainId });

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
