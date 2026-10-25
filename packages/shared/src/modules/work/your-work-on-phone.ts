/**
 * Your Work on this phone, in the active garden's scope: the reader's own work the queue holds,
 * reviews they made here that are still on their way, their work drafts and their unsent proof
 * (DL-061). Home's Continue lists it, and the Your Work badge counts the same items (DL-129).
 * Each item is shown when the active garden's scope (`useActiveGarden().inScope`) shows the
 * garden it names: a work's or a review's garden, a draft's, and the garden saved with proof.
 * Sent work waiting for a review and work waiting for the reader's review stay in the Your Work
 * sheet: neither is on this phone.
 */

import type { Work } from "../../types/domain";
import { isUserAddress } from "../../utils/blockchain/address";

const ON_DEVICE_STATUSES: ReadonlySet<Work["status"]> = new Set([
  "offline",
  "uploading",
  "syncing",
  "sync_failed",
]);

/** Work that has not reached the chain yet: queued, sending, or failed to send. */
export function isWorkOnThisDevice(work: Pick<Work, "id" | "status">): boolean {
  return (
    ON_DEVICE_STATUSES.has(work.status) ||
    work.id.startsWith("0xoffline_") ||
    !work.id.startsWith("0x")
  );
}

/** Whether the active garden's scope shows an item naming these gardens. */
export type GardenScope = (gardens: readonly (string | null | undefined)[]) => boolean;

export interface YourWorkOnPhoneInput<D, P> {
  inScope: GardenScope;
  /** The reader, whose own work is listed; nothing is until they are known. */
  viewer: string | null | undefined;
  /** The reader's work with the queue's merged in (`useMyWorks({ includeOffline: true })`). */
  works: readonly Work[];
  /** Reviews decided on this phone that the record has not reported yet. */
  decidedHere: readonly Work[];
  /** Works whose review from this phone is still queued, in lowercase. */
  waitingDecisionWorkIds: ReadonlySet<string>;
  drafts: readonly D[];
  proofs: readonly P[];
}

export interface YourWorkOnPhoneItems<D, P> {
  /** The reader's own work the queue holds: to upload, sending, being checked or stopped. */
  submissions: Work[];
  /** Reviews the reader made here whose upload still waits. */
  decisions: Work[];
  drafts: D[];
  proofs: P[];
}

export function selectYourWorkOnPhone<
  D extends { gardenAddress?: string | null },
  P extends { savedGarden: string | null },
>(input: YourWorkOnPhoneInput<D, P>): YourWorkOnPhoneItems<D, P> {
  const { inScope } = input;
  return {
    submissions: input.works.filter(
      (work) =>
        isUserAddress(work.gardenerAddress, input.viewer) &&
        work.status !== "approved" &&
        work.status !== "rejected" &&
        isWorkOnThisDevice(work) &&
        inScope([work.gardenAddress])
    ),
    decisions: input.decidedHere.filter(
      (work) =>
        input.waitingDecisionWorkIds.has(work.id.toLowerCase()) && inScope([work.gardenAddress])
    ),
    drafts: input.drafts.filter((draft) => inScope([draft.gardenAddress])),
    // Proof follows the garden saved with it, as the Your Work count does.
    proofs: input.proofs.filter((proof) => inScope([proof.savedGarden])),
  };
}
