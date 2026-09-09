import type { Hex } from "viem";
import { getTransactionReceipt } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";

type WorkConfirmation = "confirmed" | "reverted" | "unresolved";
export class AwaitingWorkConfirmation extends Error {
  constructor(readonly hash: Hex) {
    super("awaiting-confirmation");
  }
}
export class WorkTransactionReverted extends Error {
  constructor(readonly hash: Hex) {
    super("work-transaction-reverted");
  }
}

/** A missing receipt is never permission to send again. Opaque wallet IDs keep their existing semantics. */
export async function reconcileWorkTransaction(
  hash: Hex,
  chainId: number,
  read: () => Promise<{ status: string }> = () =>
    getTransactionReceipt(getWagmiConfig(), { hash, chainId })
): Promise<WorkConfirmation> {
  if (!/^0x[\da-f]{64}$/i.test(hash)) return "confirmed";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "unresolved";
  try {
    const receipt = await read();
    return receipt.status === "success"
      ? "confirmed"
      : receipt.status === "reverted"
        ? "reverted"
        : "unresolved";
  } catch {
    return "unresolved";
  }
}

// Retain a broadcast when storage rejects its checkpoint. Never let an in-session retry resend it.
const broadcasts = new Map<string, Hex>();
export function rememberWorkBroadcast(id: string, hash: Hex) {
  broadcasts.set(id, hash);
}
export function retainedWorkBroadcast(id: string) {
  return broadcasts.get(id);
}
export function forgetWorkBroadcast(id: string) {
  broadcasts.delete(id);
}

const processing = new Set<string>();
export function claimWorkJobs(ids: string[]): (() => void) | null {
  if (ids.some((id) => processing.has(id))) return null;
  ids.forEach((id) => processing.add(id));
  return () => {
    ids.forEach((id) => processing.delete(id));
  };
}
