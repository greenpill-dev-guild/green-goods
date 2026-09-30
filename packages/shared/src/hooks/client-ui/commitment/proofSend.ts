/**
 * A proof's send, after the proof screens are gone
 *
 * Add This Proof hands over to the promise once the queue holds the proof, so
 * the rest of the send happens under another screen. Two things here outlive
 * the composer on purpose. The first follows a proof the background flush sends
 * (a passkey or embedded sign-in) and says how it ended. The second tells the
 * promise that a proof from this phone is on its way, and what it carries, so
 * the page can say so instead of offering to send it a second time.
 *
 * @module hooks/client-ui/commitment/proofSend
 */

import { useCallback, useSyncExternalStore } from "react";

import { jobQueue } from "../../../modules/job-queue/default-instance";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import { hasRecordedSend, isTerminallyFailedJob } from "../../../modules/job-queue/queue-policy";
import type { Job } from "../../../types/job-queue";
import type { ProofContents } from "./proofContents";

/**
 * A proof this phone is sending, by promise. While the send runs the promise
 * holds its queue notice, since Send Now or Discard would race the send in
 * flight. Once it lands the entry stays a little longer, until the promise's own
 * record counts the proof, so the page never reads "no proof yet" in between.
 */
export interface ProofSend {
  contents: ProofContents;
  /** The promise's proof count when this one was added. */
  baseline: number;
  /** The send is over and the proof landed; only the record has to catch up. */
  landed: boolean;
}

/** How long a landed proof may wait for the record before the page stops saying so. */
const LANDED_GRACE_MS = 120_000;

// Replaced, never changed in place, so a reader can tell a change by identity.
let sends: ReadonlyMap<string, ProofSend> = new Map();
const listeners = new Set<() => void>();
const update = (change: (next: Map<string, ProofSend>) => void) => {
  const next = new Map(sends);
  change(next);
  sends = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * One account's proof for one promise. The map outlives a sign-in change, so a
 * send another account started on this phone never reads as this one's.
 */
export function proofSendKey(chainId: number, commitmentId: bigint, owner: string): string {
  return `${chainId}:${owner.toLowerCase()}:${commitmentId.toString()}`;
}

export function startProofSend(key: string, send: Omit<ProofSend, "landed">): void {
  update((next) => next.set(key, { ...send, landed: false }));
}

/** The send ended: a landed proof stays until the record shows it; any other ending clears it. */
export function settleProofSend(key: string, { landed }: { landed: boolean }): void {
  const current = sends.get(key);
  if (!current) return;
  if (!landed) {
    update((next) => next.delete(key));
    return;
  }
  const settled = { ...current, landed: true };
  update((next) => next.set(key, settled));
  setTimeout(() => {
    // A later proof for the same promise keeps its own entry.
    if (sends.get(key) !== settled) return;
    update((next) => next.delete(key));
  }, LANDED_GRACE_MS);
}

/** Every proof this phone is sending, by `proofSendKey`: Your Work holds their Discard. */
export function useProofSends(): ReadonlyMap<string, ProofSend> {
  return useSyncExternalStore(subscribe, readSends, readSends);
}
const readSends = () => sends;

/** The proof this phone is sending for one promise, if any. */
export function useProofSend(key: string | null): ProofSend | null {
  const read = useCallback(() => (key ? (sends.get(key) ?? null) : null), [key]);
  return useSyncExternalStore(subscribe, read, read);
}

/** How a followed send ended, as far as this device can tell. */
export type BackgroundProofOutcome =
  | "landed"
  | "declined"
  | "failed"
  /**
   * It left the phone, never got its turn, or failed a try the queue will
   * repeat; the queue keeps it either way, and the promise says which.
   */
  | "undecided";

/** Long enough for a prompt and a receipt; after it the promise's own notice takes over. */
const FOLLOW_FOR_MS = 90_000;

/**
 * What a flush that ended with the job still queued means. A declined prompt
 * marks the job for the person's own send; a send on record waits for its
 * answer; anything else waits for its next turn.
 */
function outcomeOfKept(job: Job): BackgroundProofOutcome {
  if (isTerminallyFailedJob(job)) return "failed";
  if (job.meta?.requiresExplicitSend && !hasRecordedSend(job)) return "declined";
  return "undecided";
}

/**
 * Follow one queued proof until it lands, is declined, fails, or the flush
 * leaves it for later; `onEnd` hears exactly one outcome. Returns a stop.
 */
export function followBackgroundProof({
  jobId,
  owner,
  onEnd,
  followForMs = FOLLOW_FOR_MS,
}: {
  jobId: string;
  owner: string;
  onEnd: (outcome: BackgroundProofOutcome) => void;
  followForMs?: number;
}): () => void {
  let ended = false;
  // A flush that started before this job was queued ends without seeing it,
  // so only a flush that picked this job up can say it was left waiting.
  let pickedUp = false;
  // Set once the listeners are in place; `stop` may clear it before then.
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const unsubscribers: Array<() => void> = [];
  const stop = () => {
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    clearTimeout(timer);
  };
  const end = (outcome: BackgroundProofOutcome) => {
    if (ended) return;
    ended = true;
    stop();
    onEnd(outcome);
  };
  const readKept = async (): Promise<Job | null> => {
    const jobs = await jobQueue.getJobs(owner);
    return jobs.find((job) => job.id === jobId && !job.synced) ?? null;
  };

  unsubscribers.push(
    jobQueueEventBus.on("job:processing", ({ jobId: id }) => {
      if (id === jobId) pickedUp = true;
    }),
    jobQueueEventBus.on("job:completed", ({ jobId: id }) => {
      if (id === jobId) end("landed");
    }),
    // Every failed attempt reports here: a declined prompt, the queue giving up,
    // and an ordinary try it keeps for another turn. The event's copy can predate
    // the failure being written, so the stored record says which it was.
    jobQueueEventBus.on("job:failed", ({ jobId: id }) => {
      if (id !== jobId) return;
      void readKept()
        .then((job) => end(job ? outcomeOfKept(job) : "failed"))
        .catch(() => end("undecided"));
    }),
    jobQueueEventBus.on("queue:sync-completed", () => {
      if (!pickedUp) return;
      void readKept()
        .then((job) => end(job ? outcomeOfKept(job) : "landed"))
        .catch(() => end("undecided"));
    })
  );
  timer = setTimeout(() => end("undecided"), followForMs);
  return stop;
}

/**
 * Add and Send's second act, queued with the proof and waiting for it, followed
 * from the moment the queue took both. The background flush sends it right after
 * the proof, so its end is heard from now, over two sends' time; a wallet reader
 * is asked for it once the proof has landed. The returned call resolves true
 * only for a send that landed: one still queued, or one that failed, leaves the
 * promise to say where it stands.
 */
export function followSecondAct({
  jobId,
  owner,
  byFlush,
  sendNow,
}: {
  jobId: string | null;
  owner: string;
  byFlush: boolean;
  sendNow: (jobId: string) => Promise<"landed" | "queued">;
}): () => Promise<boolean> {
  if (!jobId) return async () => false;
  if (!byFlush)
    return () =>
      sendNow(jobId).then(
        (outcome) => outcome === "landed",
        () => false
      );
  const ended = new Promise<BackgroundProofOutcome>((onEnd) => {
    followBackgroundProof({ jobId, owner, onEnd, followForMs: 2 * FOLLOW_FOR_MS });
  });
  return async () => (await ended) === "landed";
}
