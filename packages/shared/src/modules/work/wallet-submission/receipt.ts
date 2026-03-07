import { waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "../../../config/appkit";
import { TX_RECEIPT_TIMEOUT_MS } from "../../../utils/blockchain/polling";

export async function waitForReceiptWithTimeout(
  hash: `0x${string}`,
  chainId: number,
  timeoutMs: number = TX_RECEIPT_TIMEOUT_MS
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
        )
      );
    }, timeoutMs);
  });

  const receiptPromise = waitForTransactionReceipt(wagmiConfig, { hash, chainId });

  try {
    await Promise.race([receiptPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
