import type { PasskeyAccountProfileId } from "../auth/account-profile";

export type BatchRail = "passkey" | "wallet";

export interface BatchEnablement {
  action: "garden-settings" | "add-members" | "vault-deposit" | "jar-deposit";
  rail: BatchRail;
  /**
   * A wallet lists as `eip-5792` when the action needs atomic calls: this list says it may batch,
   * its own capability says it can. It lists as `contract-call` when one call does the batching, so
   * every wallet can send it. It lists as `sequential` when it keeps one signature per step, which
   * still runs through the journal.
   */
  profile: PasskeyAccountProfileId | "eip-5792" | "contract-call" | "sequential";
  chainId: number;
  /** Only the assets with recorded evidence, for an action that moves money. */
  asset?: string;
}

/**
 * What may send as one batch. `getBatchCapability` only checks an encoding, so a listing waits for
 * a live batch on that rail, account profile, and chain. Removing one stops new batches; a save
 * already sent still recovers, because recovery never reads this list.
 */
export const ENABLED_BATCHES: readonly BatchEnablement[] = [];

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
      (entry.asset === undefined || entry.asset.toLowerCase() === query.asset?.toLowerCase())
  );
}
