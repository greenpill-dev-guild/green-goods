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
import type { Job } from "../../types/job-queue";
import { isUserAddress } from "../../utils/blockchain/address";

const ON_DEVICE_STATUSES: ReadonlySet<Work["status"]> = new Set([
  "offline",
  "uploading",
  "syncing",
  "sync_failed",
]);

/** The queued kinds that are work on this phone, which Your Work lists; promise acts are not. */
const ON_PHONE_KINDS: ReadonlySet<string> = new Set(["work", "approval", "evidence"]);

/** Work that has not reached the chain yet: queued, sending, or failed to send. */
export function isWorkOnThisDevice(work: Pick<Work, "id" | "status">): boolean {
  return (
    ON_DEVICE_STATUSES.has(work.status) ||
    work.id.startsWith("0xoffline_") ||
    !work.id.startsWith("0x")
  );
}

/**
 * A queued job Your Work lists as an upload on this phone: work, a review or proof, on this
 * chain. Each names the garden it writes to (`uploadGarden`).
 */
export function isUploadOnPhone(job: Pick<Job, "kind" | "chainId">, chainId: number): boolean {
  return ON_PHONE_KINDS.has(job.kind) && (job.chainId ?? chainId) === chainId;
}

/** The garden a queued upload writes to, as its payload names it. */
export function uploadGarden(job: Pick<Job, "payload">): string | undefined {
  return (job.payload as { gardenAddress?: string } | undefined)?.gardenAddress;
}

/** Whether the active garden's scope shows an item naming these gardens. */
export type GardenScope = (gardens: readonly (string | null | undefined)[]) => boolean;

export interface YourWorkOnPhoneInput<D, P> {
  inScope: GardenScope;
  /** The reader, whose own work is listed; nothing is until they are known. */
  viewer: string | null | undefined;
  /** The reader's work with the queue's merged in (`useMyWorks({ includeOffline: true })`). */
  works: readonly Work[];
  drafts: readonly D[];
  proofs: readonly P[];
}

export interface YourWorkOnPhoneItems<D, P> {
  /** The reader's own work the queue holds: to upload, sending, being checked or stopped. */
  submissions: Work[];
  /** Reviews the reader made here whose upload still waits (`selectQueuedDecisions`). */
  decisions: Work[];
  drafts: D[];
  proofs: P[];
}

export function selectYourWorkOnPhone<
  D extends { gardenAddress?: string | null },
  P extends { savedGarden: string | null },
>(input: YourWorkOnPhoneInput<D, P>): Omit<YourWorkOnPhoneItems<D, P>, "decisions"> {
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
    drafts: input.drafts.filter((draft) => inScope([draft.gardenAddress])),
    // Proof follows the garden saved with it, as the Your Work count does.
    proofs: input.proofs.filter((proof) => inScope([proof.savedGarden])),
  };
}

/**
 * Reviews the reader made here whose upload still waits, where the scope shows their garden:
 * Your Work › Pending and Continue list them, as the Your Work badge counts their jobs.
 */
export function selectQueuedDecisions(input: {
  inScope: GardenScope;
  /** Reviews decided on this phone that the record has not reported yet. */
  decidedHere: readonly Work[];
  /** Works whose review from this phone is still queued, in lowercase. */
  waitingDecisionWorkIds: ReadonlySet<string>;
}): Work[] {
  return input.decidedHere.filter(
    (work) =>
      input.waitingDecisionWorkIds.has(work.id.toLowerCase()) && input.inScope([work.gardenAddress])
  );
}

/** Where a notice about uploads still on this phone sends the member (PWA Home step 12). */
export type UploadOrientation =
  /** The active garden's Your Work lists them, or some of them. */
  | { target: "yourWork" }
  /**
   * They all wait in another of the member's gardens, whose Your Work lists them once the chip
   * switches there: the notice names it and opens the switcher, and never switches it itself.
   */
  | { target: "switcher"; gardenId: string; gardenName: string };

const TO_YOUR_WORK: UploadOrientation = { target: "yourWork" };

/**
 * Where a notice about uploads on this phone points: the arrival toast's queue branch and the
 * queue's failure toast (decision 6 keeps the switch the member's). `uploadGardens` are the
 * gardens the uploads write to, newest first. Returns null while an upload outside the active
 * garden cannot be placed because the member's gardens are not known yet.
 */
export function orientUploads(
  inScope: GardenScope,
  memberGardens: readonly { id: string; name: string }[] | null,
  uploadGardens: readonly (string | null | undefined)[]
): UploadOrientation | null {
  if (uploadGardens.some((garden) => inScope([garden]))) return TO_YOUR_WORK;
  if (memberGardens === null) return null;
  for (const garden of uploadGardens) {
    const mine = memberGardens.find(({ id }) => id.toLowerCase() === garden?.toLowerCase());
    if (mine) return { target: "switcher", gardenId: mine.id, gardenName: mine.name };
  }
  // What names none of the member's gardens is in every garden's scope; nothing is left out.
  return TO_YOUR_WORK;
}
