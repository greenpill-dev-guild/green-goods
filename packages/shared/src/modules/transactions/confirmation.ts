import type { Hex } from "viem";
import {
  TransactionRevertedError,
  TransactionReplacementError,
  type BroadcastReference,
  type ContractCall,
  type TransactionSendOptions,
  type BroadcastConfirmation,
  type TransactionSender,
  type TxResult,
} from "./types";

/** Checkpoint a signed/accepted reference before a receipt wait can lose its response. */
export async function sendCheckpointedCall(
  sender: TransactionSender,
  call: ContractCall,
  checkpoint: (result: TxResult) => void | Promise<void>,
  clear: (result: TxResult) => void | Promise<void>,
  options: TransactionSendOptions = {}
): Promise<TxResult> {
  let pending: TxResult | undefined;
  let beforeCheckpointFailed = false;
  const record = async (reference: BroadcastReference) => {
    pending = {
      hash: reference.hash,
      sponsored: sender.supportsSponsorship,
      confirmation: "pending",
      broadcastReference: {
        ...reference,
        chainId: reference.chainId ?? call.chainId,
        ...(reference.kind === "transaction" ? { account: reference.account ?? call.account } : {}),
      },
    };
    await checkpoint(pending);
  };
  try {
    const result = await sender.sendContractCall(call, {
      ...options,
      onBeforeBroadcast: async (reference) => {
        try {
          if (reference) await record(reference);
          await options.onBeforeBroadcast?.(reference);
          await options.assertOwnership?.();
        } catch (error) {
          beforeCheckpointFailed = true;
          throw error;
        }
      },
      onBroadcastReference: async (reference) => {
        await record(reference);
        await options.onBroadcastReference?.(reference);
      },
    });
    return { ...result, ...(pending ? { broadcastReference: pending.broadcastReference } : {}) };
  } catch (error) {
    if (!pending) throw error;
    if (
      beforeCheckpointFailed ||
      error instanceof TransactionRevertedError ||
      error instanceof TransactionReplacementError
    ) {
      await clear(pending);
      throw error;
    }
    // A submitted reference plus a failed RPC response says nothing about execution.
    return pending;
  }
}

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
    const reference =
      submission.broadcastReference ??
      ({
        kind: "transaction",
        hash: submission.hash,
      } as const);
    const outcome = await sender.reconcileBroadcast?.(reference);
    if (outcome && outcome.status !== "unresolved") return outcome;
    if (reference.kind === "user-operation" || !isCanonicalTransactionHash(submission.hash))
      return { status: "unresolved" };
    const receipt = await readReceipt(submission.hash);
    return receipt.status === "success"
      ? { status: "confirmed", transactionHash: receipt.transactionHash }
      : { status: "reverted" };
  } catch {
    return { status: "unresolved" };
  }
}
