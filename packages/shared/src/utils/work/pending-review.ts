/**
 * Pending-review derivation shared by the Work Dashboard's Needs Review list and the
 * arrival orientation's review count, so the two can never drift.
 *
 * @module utils/work/pending-review
 */

import type { Work } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
import { isUserAddress } from "../blockchain/address";

/**
 * Build the recipient set that provably covers every approval attested for the given
 * candidate works. Approvals are not recipient-normalized on-chain: PWA paths attest
 * with recipient = garden, while the agent bot path attests with recipient = the
 * work's gardener (see modules/work/bot-submission.ts). Recipient-scoped fetching by
 * garden ids alone therefore permanently misses agent-made approvals, leaving
 * agent-approved works as false "needs review" residue. Gardens ∪ candidate works'
 * gardeners closes that class for all shipped attestation paths.
 */
export function collectApprovalRecipientsForWorks(gardenIds: string[], works: Work[]): string[] {
  const recipients = new Map<string, string>();
  for (const gardenId of gardenIds) {
    if (gardenId) recipients.set(gardenId.toLowerCase(), gardenId);
  }
  for (const work of works) {
    const gardener = work.gardenerAddress;
    if (gardener) recipients.set(gardener.toLowerCase(), gardener);
  }
  return Array.from(recipients.values());
}

/** Set of workUIDs that any operator has already approved/rejected. */
export function collectApprovedWorkUIDs(approvals: EASWorkApproval[]): Set<string> {
  return new Set(approvals.map((approval) => approval.workUID));
}

/**
 * Works still needing review by the viewer: not reviewed by ANYONE and not the
 * viewer's own submission. Pure — callers own fetching and readiness; in
 * truth-gated contexts (arrival toast) compute this only once both the works and
 * approvals sources have settled successfully, never from loading-default arrays.
 */
export function filterPendingNeedsReview(
  works: Work[],
  approvedWorkUIDs: Set<string>,
  viewerAddress: string | undefined | null
): Work[] {
  return works.filter(
    (work) => !approvedWorkUIDs.has(work.id) && !isUserAddress(work.gardenerAddress, viewerAddress)
  );
}
