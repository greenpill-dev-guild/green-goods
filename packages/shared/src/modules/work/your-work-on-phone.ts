/**
 * Your Work on this phone, in one garden: the reader's own work the queue holds, reviews they
 * made here that are still on their way, their work drafts and their unsent proof (DL-061).
 * Home's Continue lists it, and the Your Work badge counts the same items, scoped to the active
 * garden (PWA Home decisions 4 and 15). Sent work waiting for a review and work waiting for the
 * reader's review stay in the Your Work sheet: neither is on this phone.
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

/**
 * Whether an item belongs to a garden. An item names its own garden; one whose garden is not
 * known yet (a draft saved before a garden was chosen, proof whose promise has not been read)
 * shows in every garden, so nothing on this phone drops out of sight.
 */
export function isInGarden(itemGarden: string | null | undefined, gardenId: string): boolean {
  return !itemGarden || itemGarden.toLowerCase() === gardenId.toLowerCase();
}

export interface YourWorkOnPhoneInput<D, P> {
  gardenId: string;
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
  P extends { garden: string | null },
>(input: YourWorkOnPhoneInput<D, P>): YourWorkOnPhoneItems<D, P> {
  const inGarden = (itemGarden: string | null | undefined) =>
    isInGarden(itemGarden, input.gardenId);
  return {
    submissions: input.works.filter(
      (work) =>
        isUserAddress(work.gardenerAddress, input.viewer) &&
        work.status !== "approved" &&
        work.status !== "rejected" &&
        isWorkOnThisDevice(work) &&
        inGarden(work.gardenAddress)
    ),
    decisions: input.decidedHere.filter(
      (work) =>
        input.waitingDecisionWorkIds.has(work.id.toLowerCase()) && inGarden(work.gardenAddress)
    ),
    drafts: input.drafts.filter((draft) => inGarden(draft.gardenAddress)),
    proofs: input.proofs.filter((proof) => inGarden(proof.garden)),
  };
}
