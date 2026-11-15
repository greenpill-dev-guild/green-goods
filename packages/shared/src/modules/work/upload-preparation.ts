/**
 * Background preparation for Upload all
 *
 * Once the connection is confirmed, queued work and decisions are prepared one
 * at a time under a claim, so Upload all only has to sign. Preparation pauses
 * while the connection is unconfirmed, while the page is hidden, under Data
 * Saver unless the person asks to prepare anyway, and while Upload all or a
 * Submit is sending. An item whose try fails without an answer waits out a
 * backoff, and says so, until it is tried again.
 * Recovery of work earlier builds gave up on runs once, before the first item.
 *
 * @module modules/work/upload-preparation
 */

import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import { appCodeRecovery } from "../app/cache-recovery";
import type { WorkClaim } from "../job-queue/work-claims";
import type { PreparationResult } from "./prepare-queued-work";
import { isUploadJob, queuedUploadStatus, uploadPreparationOf } from "./upload-state";

export type UploadPreparationPause =
  | "unconfirmed"
  | "hidden"
  | "data-saver"
  | "uploading"
  | "app-code";

export interface UploadPreparationSnapshot {
  /** The item being prepared right now. */
  activeJobId: string | null;
  /** Why preparation is waiting, when it is. */
  paused: UploadPreparationPause | null;
  /**
   * The person asked to prepare under Data Saver. It lasts until their session's preparation
   * stops, so the next person to sign in on this page starts under Data Saver again.
   */
  dataSaverOverride: boolean;
  /**
   * Items whose last try failed without an answer, waiting out their backoff. A new set is
   * published whenever one joins or leaves it.
   */
  retryingJobIds: ReadonlySet<string>;
}

const NO_RETRIES: ReadonlySet<string> = new Set();

const INITIAL_SNAPSHOT: UploadPreparationSnapshot = {
  activeJobId: null,
  paused: null,
  dataSaverOverride: false,
  retryingJobIds: NO_RETRIES,
};

let snapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function publish(next: Partial<UploadPreparationSnapshot>) {
  const merged = { ...snapshot, ...next };
  if (
    merged.activeJobId === snapshot.activeJobId &&
    merged.paused === snapshot.paused &&
    merged.dataSaverOverride === snapshot.dataSaverOverride &&
    merged.retryingJobIds === snapshot.retryingJobIds
  )
    return;
  snapshot = merged;
  for (const listener of listeners) listener();
}

export const uploadPreparationStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * One try at preparing an item, for telemetry: the item's kind and which try it is, how the try
 * ended and how long it took, and the wait before the next. Nothing names the item, its content
 * or its owner, so a work that keeps failing reads apart from a slow one without identifying it.
 */
export type UploadPreparationEvent =
  | { type: "started"; kind: string; attempt: number }
  | {
      type: "finished";
      kind: string;
      attempt: number;
      /** `error` when the try threw instead of answering. */
      result: PreparationResult | "error";
      durationMs: number;
      /** Why a blocked item was refused, by the fixed name of the refusal. */
      reason?: string;
    }
  | { type: "retry-scheduled"; kind: string; attempt: number; delayMs: number };

export interface UploadPreparationPorts {
  userAddress: Address;
  chainId: number;
  /**
   * Whether the origin has answered recently. It asks again when its last answer
   * has aged out: nothing re-probes a steady connection on a timer, so a read
   * that only looked would pause a long queue after a minute and never resume.
   */
  confirmOnline(): Promise<boolean>;
  isVisible(): boolean;
  isDataSaverOn(): boolean;
  listJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  acquire(ids: string[]): Promise<Map<string, WorkClaim>>;
  hold(claims: WorkClaim[]): () => void;
  prepare(job: Job, chainId: number, claim: WorkClaim): Promise<PreparationResult>;
  recover(userAddress: Address): Promise<unknown>;
  now(): number;
  record(event: UploadPreparationEvent): void;
}

interface PreparationHold {
  ready: Promise<void>;
  release(): void;
}

export interface UploadPreparation {
  /** Look for items to prepare; a request during a run is served when it ends. */
  schedule(): void;
  /** Stop new passes and wait for any in-flight claim to be released. */
  suspend(): PreparationHold;
  /** Prepare under Data Saver for the rest of this session. */
  prepareNow(): void;
  /** Forget one item's backoff and prepare it now, as the person's own Try Again asks. */
  retryNow(jobId: string): void;
  /** End this session's preparation, and the Data Saver override with it. */
  stop(): void;
}

/** Retries of one item back off from 30 seconds to 10 minutes. */
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 10 * 60_000;

function chainOf(job: Job, fallback: number) {
  return job.chainId ?? fallback;
}

export function createUploadPreparation(ports: UploadPreparationPorts): UploadPreparation {
  let running = false;
  const idleWaiters = new Set<() => void>();
  let requested = false;
  let stopped = false;
  let suspended = 0;
  let recovered = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const retries = new Map<string, { attempts: number; at: number }>();
  // A blocked item is checked again once a session: a membership may have changed.
  const recheckedBlocked = new Set<string>();

  // The snapshot names the items in `retries`, so a work's page can say its try failed.
  const announceRetries = () =>
    publish({ retryingJobIds: retries.size === 0 ? NO_RETRIES : new Set(retries.keys()) });
  const forgetRetry = (id: string) => {
    if (retries.delete(id)) announceRetries();
  };

  const pauseReason = async (): Promise<UploadPreparationPause | null> => {
    if (appCodeRecovery.getSnapshot()) return "app-code";
    if (suspended > 0) return "uploading";
    if (!ports.isVisible()) return "hidden";
    if (ports.isDataSaverOn() && !snapshot.dataSaverOverride) return "data-saver";
    // Asked last: it may probe, and a hidden or Data Saver page spends nothing on it.
    if (!(await ports.confirmOnline())) return "unconfirmed";
    return suspended > 0 ? "uploading" : null;
  };

  const wantsPreparation = (job: Job): boolean => {
    if (!isUploadJob(job) || chainOf(job, ports.chainId) !== ports.chainId) return false;
    const retry = retries.get(job.id);
    if (retry && retry.at > ports.now()) return false;
    const { state } = queuedUploadStatus(job);
    if (state === "preparing" || state === "photo-pending") return true;
    return state === "blocked" && !recheckedBlocked.has(job.id);
  };

  const prepareOne = async (id: string) => {
    const claim = (await ports.acquire([id])).get(id);
    if (!claim) return;
    const release = ports.hold([claim]);
    try {
      // Read again under the claim: another holder may have changed it.
      const job = await ports.getJob(id);
      if (stopped || suspended > 0 || !job || !wantsPreparation(job)) return;
      publish({ activeJobId: id });
      const { kind } = job;
      const attempt = (retries.get(id)?.attempts ?? 0) + 1;
      const startedAt = ports.now();
      ports.record({ type: "started", kind, attempt });
      let result: PreparationResult;
      try {
        result = await ports.prepare(job, ports.chainId, claim);
      } catch (error) {
        const durationMs = ports.now() - startedAt;
        ports.record({ type: "finished", kind, attempt, result: "error", durationMs });
        throw error;
      }
      // Preparation records its answer on the job it was handed, a refusal's reason included.
      const refusal = result === "blocked" ? uploadPreparationOf(job) : undefined;
      ports.record({
        type: "finished",
        kind,
        attempt,
        result,
        durationMs: ports.now() - startedAt,
        ...(refusal?.status === "blocked" ? { reason: refusal.reason } : {}),
      });
      if (result === "retry-later") {
        const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
        const waitingAlready = retries.has(id);
        retries.set(id, { attempts: attempt, at: ports.now() + delay });
        if (!waitingAlready) announceRetries();
        ports.record({ type: "retry-scheduled", kind, attempt, delayMs: delay });
        return;
      }
      forgetRetry(id);
      // A blocked item is checked once a session, and only the chain refusing it
      // again spends that check: a transient failure must not retire it.
      if (result === "blocked") recheckedBlocked.add(id);
    } finally {
      release();
      publish({ activeJobId: null });
      await claim.release();
    }
  };

  const run = async () => {
    if (stopped) return;
    if (running) {
      requested = true;
      return;
    }
    running = true;
    try {
      do {
        requested = false;
        const paused = await pauseReason();
        publish({ paused });
        if (paused) return;
        if (!recovered) {
          await ports.recover(ports.userAddress);
          recovered = true;
        }
        const queued = await ports.listJobs();
        // A discarded or confirmed item waits on nothing here any more.
        const listed = new Set(queued.map((job) => job.id));
        const gone = [...retries.keys()].filter((id) => !listed.has(id));
        for (const id of gone) retries.delete(id);
        if (gone.length > 0) announceRetries();
        const candidates = queued.filter(wantsPreparation);
        for (const { id } of candidates) {
          if (stopped) return;
          const pausedMidway = await pauseReason();
          if (pausedMidway) {
            publish({ paused: pausedMidway });
            return;
          }
          await prepareOne(id);
        }
      } while (requested && !stopped);
    } finally {
      running = false;
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
      scheduleRetry();
    }
  };

  /**
   * One timer for the earliest backoff still ahead. Without it a recorded retry
   * only throttles, and an item that failed once would wait for an unrelated
   * wake-up. A backoff already due needs no timer: the next pass takes it.
   */
  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    if (stopped || appCodeRecovery.getSnapshot()) return;
    const ahead = [...retries.values()].map(({ at }) => at).filter((at) => at > ports.now());
    if (ahead.length > 0) retryTimer = setTimeout(start, Math.min(...ahead) - ports.now());
  };

  // A failed pass leaves everything queued; the next trigger tries again.
  const start = () => {
    void run().catch((error: unknown) => {
      logger.warn("[UploadPreparation] Preparation pass stopped early", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  return {
    schedule: start,
    suspend: () => {
      suspended += 1;
      publish({ paused: "uploading" });
      let released = false;
      return {
        ready: running
          ? new Promise<void>((resolve) => idleWaiters.add(resolve))
          : Promise.resolve(),
        release: () => {
          if (released) return;
          released = true;
          suspended -= 1;
          if (suspended === 0) start();
        },
      };
    },
    prepareNow: () => {
      publish({ dataSaverOverride: true });
      start();
    },
    retryNow: (jobId) => {
      forgetRetry(jobId);
      start();
    },
    stop: () => {
      stopped = true;
      clearTimeout(retryTimer);
      publish({
        activeJobId: null,
        paused: null,
        dataSaverOverride: false,
        retryingJobIds: NO_RETRIES,
      });
    },
  };
}

let active: UploadPreparation | undefined;
/**
 * The releases of each hold still open. A preparation set while one is open
 * starts held too: it loads only once the connection is first confirmed, and a
 * Submit tapped at that moment must still send its own work.
 */
const openHolds = new Set<PreparationHold[]>();

/** The preparation the signed-in session runs, so the dashboard and uploads can reach it. */
export function setActiveUploadPreparation(preparation: UploadPreparation | undefined) {
  active = preparation;
  if (preparation) for (const releases of openHolds) releases.push(preparation.suspend());
}

export function scheduleUploadPreparation(): void {
  active?.schedule();
}

export function prepareUploadsNow(): void {
  active?.prepareNow();
}

/** Prepare one item again now, forgetting the backoff an earlier failed try left on it. */
export function retryUploadPreparationNow(jobId: string): void {
  active?.retryNow(jobId);
}

/** Hold preparation back, the current one and any set before the release, until released. */
export async function suspendUploadPreparation(): Promise<() => void> {
  const releases = active ? [active.suspend()] : [];
  openHolds.add(releases);
  // A session may mount a new scheduler while an older pass is draining.
  for (let index = 0; index < releases.length; index += 1) await releases[index].ready;
  return () => {
    if (!openHolds.delete(releases)) return;
    for (const hold of releases) hold.release();
  };
}
