import type { Hex } from "viem";
import type { BatchExecution, BatchReference } from "./batch-types";
import { isCanonicalTransactionHash } from "./confirmation";

export interface WalletBatchStatus {
  status?: string;
  statusCode?: number;
  chainId?: number;
  atomic?: boolean;
  receipts?: readonly { status?: string; transactionHash: Hex }[];
}

/** A partial or contradictory wallet response never establishes atomic completion. */
export function walletBatchExecution(
  reference: BatchReference,
  result: WalletBatchStatus
): BatchExecution {
  const receipts = (result.receipts ?? [])
    .filter(
      (receipt) =>
        isCanonicalTransactionHash(receipt.transactionHash) &&
        (receipt.status === "success" || receipt.status === "reverted")
    )
    .map((receipt) => ({
      transactionHash: receipt.transactionHash,
      status: receipt.status as "success" | "reverted",
    }));
  const complete =
    receipts.length > 0 &&
    receipts.length === result.receipts?.length &&
    new Set(receipts.map((receipt) => receipt.transactionHash.toLowerCase())).size ===
      receipts.length;
  let status: BatchExecution["status"] = "unresolved";
  if (result.chainId === reference.chainId && result.atomic === true && complete) {
    if (
      result.status === "success" &&
      (result.statusCode === undefined || (result.statusCode >= 200 && result.statusCode < 300)) &&
      receipts.every((receipt) => receipt.status === "success")
    )
      status = "confirmed";
    else if (
      result.status === "failure" &&
      (result.statusCode === undefined || (result.statusCode >= 500 && result.statusCode < 600)) &&
      receipts.every((receipt) => receipt.status === "reverted")
    )
      status = "reverted";
  }
  return { status, reference, receipts, sponsored: false };
}
