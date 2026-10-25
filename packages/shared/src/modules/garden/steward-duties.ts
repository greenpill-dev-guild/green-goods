/**
 * What waits for a garden's stewards: the queues the phone can act on, in the order Home's Needs
 * Your Attention lists them (PWA Home decisions 22 and 27). Each is counted from what its own
 * screen lists, and opens there: work to review (Your Work's To review rows in the garden),
 * take-up requests on approval-gated asks (each promise's claim panel), and promises the garden
 * confirms (the Promises sheet's To confirm). A queue with nothing in it is left out. Who may see
 * a queue is decided where it is read (`useStewardDuties`), by the predicate of the act it opens.
 * Join requests have no count the app can read without a signature, so they stay in Gardeners.
 */

import type { Work } from "../../types/domain";
import type { CommitmentReadModel, PoolClaimRequestRow } from "../commitment-pooling/types-core";

export type StewardDuty =
  /** Work someone else submitted, waiting for review: the one waiting longest first. */
  | { kind: "review"; count: number; works: Work[] }
  /** Take-up requests waiting on one promise, decided in its claim panel. */
  | { kind: "takeUp"; count: number; commitment: CommitmentReadModel; newestAt: number }
  /** Promises the garden confirms. */
  | { kind: "confirm"; count: number; commitments: CommitmentReadModel[] };

export interface StewardDutyInputs {
  /** Work someone else submitted in the garden and nobody has reviewed yet. */
  toReview: readonly Work[];
  /** Take-up requests on the garden's pool. */
  pendingClaims: readonly PoolClaimRequestRow[];
  /** Promises the garden confirms, as the To confirm tab lists them. */
  toConfirm: readonly CommitmentReadModel[];
}

export function selectStewardDuties(input: StewardDutyInputs): StewardDuty[] {
  const duties: StewardDuty[] = [];

  if (input.toReview.length > 0) {
    const works = [...input.toReview].sort((left, right) => left.createdAt - right.createdAt);
    duties.push({ kind: "review", count: works.length, works });
  }

  const byPromise = new Map<string, Extract<StewardDuty, { kind: "takeUp" }>>();
  for (const { claim, commitment } of input.pendingClaims) {
    if (claim.state !== "PENDING") continue;
    const key = claim.commitmentId.toString();
    const duty = byPromise.get(key);
    if (duty) {
      duty.count += 1;
      duty.newestAt = Math.max(duty.newestAt, claim.requestedAt);
    } else {
      byPromise.set(key, { kind: "takeUp", count: 1, commitment, newestAt: claim.requestedAt });
    }
  }
  duties.push(...[...byPromise.values()].sort((left, right) => right.newestAt - left.newestAt));

  if (input.toConfirm.length > 0) {
    duties.push({
      kind: "confirm",
      count: input.toConfirm.length,
      commitments: [...input.toConfirm],
    });
  }
  return duties;
}
