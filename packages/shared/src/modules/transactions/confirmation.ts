import type { Hex } from "viem";
import type { BroadcastConfirmation, TransactionSender, TxResult } from "./types";

/** An opaque wallet proposal is not an execution transaction hash. */
export function isCanonicalTransactionHash(hash: string): hash is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/** Read an existing submission; an unavailable read never authorizes another send. */
export async function reconcileTransaction(
  sender: TransactionSender,
  submission: TxResult,
  readReceipt: (hash: Hex) => Promise<{ status: "success" | "reverted"; transactionHash: Hex }>
): Promise<BroadcastConfirmation> {
  try {
    const outcome = await sender.reconcileBroadcast?.({
      kind: "transaction",
      hash: submission.hash,
    });
    if (outcome && outcome.status !== "unresolved") return outcome;
    if (!isCanonicalTransactionHash(submission.hash)) return { status: "unresolved" };
    const receipt = await readReceipt(submission.hash);
    return receipt.status === "success"
      ? { status: "confirmed", transactionHash: receipt.transactionHash }
      : { status: "reverted" };
  } catch {
    return { status: "unresolved" };
  }
}
