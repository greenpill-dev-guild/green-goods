/**
 * Background preparation for Upload all
 *
 * Once the connection is confirmed, queued work and decisions are prepared one
 * at a time under a claim, so Upload all only has to sign. Preparation pauses
 * while the connection is unconfirmed, while the page is hidden, under Data
 * Saver unless the person asks to prepare anyway, and while an upload runs.
 * Recovery of work earlier builds gave up on runs once, before the first item.
 *
 * @module modules/work/upload-preparation
 */

import type { Job } from "../../types/job-queue";
import { logger } from "../app/logger";
import type { WorkClaim } from "../job-queue/work-claims";
import type { PreparationResult } from "./prepare-queued-work";
import { isUploadJob, queuedUploadStatus } from "./upload-state";

export type UploadPreparationPause = "unconfirmed" | "hidden" | "data-saver" | "uploading";

export interface UploadPreparationSnapshot {
  /** The item being prepared right now. */
  activeJobId: string | null;
  /** Why preparation is waiting, when it is. */
  paused: UploadPreparationPause | null;
  /** The person asked to prepare under Data Saver; it lasts for this session. */
  dataSaverOverride: boolean;
}

const INITIAL_SNAPSHOT: UploadPreparationSnapshot = {
  activeJobId: null,
  paused: null,
  dataSaverOverride: false,
};

let snapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function publish(next: Partial<UploadPreparationSnapshot>) {
  const merged = { ...snapshot, ...next };
  if (
    merged.activeJobId === snapshot.activeJobId &&
    merged.paused === snapshot.paused &&
    merged.dataSaverOverride === snapshot.dataSaverOverride
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

export interface UploadPreparationPorts {
  userAddress: string;
  chainId: number;
  isConfirmedOnline(): boolean;
  isVisible(): boolean;
  isDataSaverOn(): boolean;
  listJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  acquire(ids: string[]): Promise<Map<string, WorkClaim>>;
  hold(claims: WorkClaim[]): () => void;
  prepare(job: Job, chainId: number, claim: WorkClaim): Promise<PreparationResult>;
  recover(userAddress: string): Promise<unknown>;
  now(): number;
}

export interface UploadPreparation {
  /** Look for items to prepare; a request during a run is served when it ends. */
  schedule(): void;
  /** Hold preparation back between items while an upload runs. Returns the release. */
  suspend(): () => void;
  /** Prepare under Data Saver for the rest of this session. */
  prepareNow(): void;
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
  let requested = false;
  let stopped = false;
  let suspended = 0;
  let recovered = false;
  const retries = new Map<string, { attempts: number; at: number }>();
  // A blocked item is checked again once a session: a membership may have changed.
  const recheckedBlocked = new Set<string>();

  const pauseReason = (): UploadPreparationPause | null => {
    if (suspended > 0) return "uploading";
    if (!ports.isConfirmedOnline()) return "unconfirmed";
    if (!ports.isVisible()) return "hidden";
    if (ports.isDataSaverOn() && !snapshot.dataSaverOverride) return "data-saver";
    return null;
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
      if (!job || !wantsPreparation(job)) return;
      if (queuedUploadStatus(job).state === "blocked") recheckedBlocked.add(id);
      publish({ activeJobId: id });
      const result = await ports.prepare(job, ports.chainId, claim);
      if (result === "retry-later") {
        const attempts = (retries.get(id)?.attempts ?? 0) + 1;
        const delay = Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
        retries.set(id, { attempts, at: ports.now() + delay });
      } else {
        retries.delete(id);
      }
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
        const paused = pauseReason();
        publish({ paused });
        if (paused) return;
        if (!recovered) {
          await ports.recover(ports.userAddress);
          recovered = true;
        }
        const candidates = (await ports.listJobs()).filter(wantsPreparation);
        for (const { id } of candidates) {
          if (stopped) return;
          const pausedMidway = pauseReason();
          if (pausedMidway) {
            publish({ paused: pausedMidway });
            return;
          }
          await prepareOne(id);
        }
      } while (requested && !stopped);
    } finally {
      running = false;
    }
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
      return () => {
        if (released) return;
        released = true;
        suspended -= 1;
        if (suspended === 0) start();
      };
    },
    prepareNow: () => {
      publish({ dataSaverOverride: true });
      start();
    },
    stop: () => {
      stopped = true;
      publish({ activeJobId: null, paused: null });
    },
  };
}
