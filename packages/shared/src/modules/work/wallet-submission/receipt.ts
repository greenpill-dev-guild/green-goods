import { waitForTransactionReceipt } from "@wagmi/core";
import { getWagmiConfig } from "../../../config/appkit";
import { TX_RECEIPT_TIMEOUT_MS } from "../../../utils/blockchain/polling";

export class TransactionReceiptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
    );
    this.name = "TransactionReceiptTimeoutError";
  }
}

export async function waitForReceiptWithTimeout(
  hash: `0x${string}`,
  chainId: number,
  timeoutMs: number = TX_RECEIPT_TIMEOUT_MS
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TransactionReceiptTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const receiptPromise = waitForTransactionReceipt(getWagmiConfig(), { hash, chainId });

  try {
    await Promise.race([receiptPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
