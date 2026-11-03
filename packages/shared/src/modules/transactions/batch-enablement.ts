import type { PasskeyAccountProfileId } from "../auth/account-profile";
import type { AtomicBatchAction } from "./types";

export type { AtomicBatchAction };

export type BatchRail = "passkey" | "wallet";

export type DepositAction = "vault-deposit" | "jar-deposit";

interface RailListing {
  rail: BatchRail;
  /**
   * A wallet lists as `eip-5792` when the action needs atomic calls: this list says it may batch,
   * its own capability says it can. It lists as `contract-call` when one call does the batching, so
   * every wallet can send it. It lists as `sequential` when it keeps one signature per step, which
   * still runs through the journal.
   */
  profile: PasskeyAccountProfileId | "eip-5792" | "contract-call" | "sequential";
  chainId: number;
}

/** A deposit moves money, so its listing names the one asset with recorded evidence. */
export type BatchEnablement = RailListing &
  (
    | {
        action: "garden-settings" | "add-members" | "bulk-reviews" | AtomicBatchAction;
        asset?: never;
      }
    | { action: DepositAction; asset: string }
  );

/**
 * What may send as one batch. `getBatchCapability` only checks an encoding, so a listing waits for
 * a live batch on that rail, account profile, and chain. A passkey signs only on a deployed host,
 * so its entry reaches beta through `develop` and is proven there before a release carries it.
 * Removing one stops new batches; a save already sent still recovers, because recovery never reads
 * this list.
 */
export const ENABLED_BATCHES: readonly BatchEnablement[] = [
  { action: "garden-settings", rail: "passkey", profile: "kernel-0.3.1-legacy", chainId: 42161 },
  { action: "pool-setup", rail: "passkey", profile: "kernel-0.3.1-legacy", chainId: 42161 },
  { action: "add-members", rail: "passkey", profile: "kernel-0.3.1-legacy", chainId: 42161 },
  { action: "add-members", rail: "wallet", profile: "contract-call", chainId: 42161 },
  { action: "bulk-reviews", rail: "passkey", profile: "kernel-0.3.1-legacy", chainId: 42161 },
  { action: "bulk-reviews", rail: "wallet", profile: "contract-call", chainId: 42161 },
];

export function isBatchEnabled(
  query: BatchEnablement,
  list: readonly BatchEnablement[] = ENABLED_BATCHES
): boolean {
  return list.some(
    (entry) =>
      entry.action === query.action &&
      entry.rail === query.rail &&
      entry.profile === query.profile &&
      entry.chainId === query.chainId &&
      entry.asset?.toLowerCase() === query.asset?.toLowerCase()
  );
}
