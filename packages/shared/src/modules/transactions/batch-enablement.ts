import type { PasskeyAccountProfileId } from "../auth/account-profile";

export type BatchRail = "passkey" | "wallet";

export interface BatchEnablement {
  action: "garden-settings" | "add-members";
  rail: BatchRail;
  /**
   * A wallet lists as `eip-5792` when the action needs atomic calls: this list says it may batch,
   * its own capability says it can. It lists as `contract-call` when one call does the batching, so
   * every wallet can send it.
   */
  profile: PasskeyAccountProfileId | "eip-5792" | "contract-call";
  chainId: number;
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
      entry.chainId === query.chainId
  );
}
