/**
 * Where a creation pass stands, before any words are chosen for it. Seed
 * Promises and Add to This Group send the same way, so they read a pass the
 * same way and differ only in what they say (`seedStatus`, `addToGroupStatus`).
 */

import {
  CREATION_BUNDLE_SIZE,
  countSeedCopies,
  type CreationSendMode,
  type SeedCopyProgress,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";

export type CreationPassState =
  | { phase: "ready" }
  /** A wallet asked once per copy, on the `current` of this pass's `total`. */
  | { phase: "sending"; current: number; total: number; created: number; progress: number }
  /** A bundling wallet asking about, or confirming, `inRequest` copies. */
  | {
      phase: "asking" | "confirming";
      inRequest: number;
      /** Which request of the pass, from 1. */
      request: number;
      requests: number;
    }
  /** Nothing created or left waiting; `retry` copies didn't send. */
  | { phase: "declined" | "refused" | "unconfirmed"; retry: number }
  | {
      phase: "partial";
      created: number;
      notSent: number;
      later: number;
      progress: number | null;
    }
  | { phase: "finishLater"; created: number; later: number; progress: number | null }
  | { phase: "created"; created: number; progress: number | null };

const IN_FLIGHT = new Set<SeedCopyProgress["status"]>([
  "waiting",
  "preparing",
  "wallet",
  "confirming",
]);

export function creationPass(input: {
  mode: CreationSendMode | null;
  isSending: boolean;
  /** Every copy sent at least once; null before the first send. */
  copies: readonly SeedCopyProgress[] | null;
  /** The copies the latest send sent, in its order. */
  pass: readonly SeedCopyProgress[] | null;
}): CreationPassState {
  const { mode, isSending, copies, pass } = input;
  if (!copies) return { phase: "ready" };

  const counts = countSeedCopies(copies);
  const oneByOne = mode === "one-by-one";
  const progress = oneByOne ? (counts.created / Math.max(1, counts.total)) * 100 : null;
  if (isSending) {
    // The wallet is asked about this send's copies, not the whole set: a Try
    // Again of three asks about three. A copy the queue refused never reaches
    // it, and the copies go in order, so the first unfinished one is the
    // current prompt, or leads the current request.
    const sending = (pass ?? []).filter((copy) => copy.jobId !== null);
    const at = Math.max(
      0,
      sending.findIndex((copy) => IN_FLIGHT.has(copy.status))
    );
    if (oneByOne) {
      return {
        phase: "sending",
        current: at + 1,
        total: Math.max(sending.length, 1),
        created: counts.created,
        progress: progress ?? 0,
      };
    }
    const request = Math.floor(at / CREATION_BUNDLE_SIZE);
    return {
      phase: sending[at]?.status === "confirming" ? "confirming" : "asking",
      inRequest: Math.max(
        1,
        Math.min(CREATION_BUNDLE_SIZE, sending.length - request * CREATION_BUNDLE_SIZE)
      ),
      request: request + 1,
      requests: Math.max(1, Math.ceil(sending.length / CREATION_BUNDLE_SIZE)),
    };
  }

  if (counts.notSent > 0 && counts.created === 0 && counts.later === 0) {
    const missed = copies.filter((copy) => copy.status === "not-sent");
    // A lost answer is no proof that nothing was created. Try Again is safe
    // either way: the chain returns a promise it already has instead of making
    // it twice.
    if (missed.some((copy) => copy.miss === "failed")) {
      return { phase: "unconfirmed", retry: counts.notSent };
    }
    const declined = missed.every((copy) => copy.miss === "declined");
    return { phase: declined ? "declined" : "refused", retry: counts.notSent };
  }
  if (counts.notSent > 0) {
    return {
      phase: "partial",
      created: counts.created,
      notSent: counts.notSent,
      later: counts.later,
      progress,
    };
  }
  if (counts.later > 0) {
    return { phase: "finishLater", created: counts.created, later: counts.later, progress };
  }
  return { phase: "created", created: counts.created, progress };
}
