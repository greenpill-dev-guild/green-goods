/**
 * The page's side of an update hand-over.
 *
 * A waiting worker cannot activate while the active one still owes anyone a
 * response, so applying an update is a negotiation rather than a switch: the
 * page stops giving the old worker new work, the old worker settles what it
 * has, and the browser activates the new one whenever that finishes — which
 * can be long after the page stopped waiting. This module owns that
 * choreography and the judgement around a late arrival; the hook owns the
 * React state it drives.
 *
 * @module modules/app/update-handover
 */

import { logger } from "./logger";
import type { QuietReport } from "./service-worker-protocol";
import {
  activateWaitingWorker,
  type buildUpdateTelemetry,
  observeUpdateAttempt,
} from "./service-worker-update";

type UpdateTelemetry = ReturnType<typeof buildUpdateTelemetry>;

/**
 * How long after the tap a late activation still finishes the restart by
 * itself. The browser activates the target the moment the old worker drains,
 * often seconds after the page gave up. Past this window the person has moved
 * on, so the row offers Restart instead of reloading under them.
 */
export const LATE_RESTART_WINDOW_MS = 2 * 60 * 1000;

/** Why a late activation was left for the person to finish. */
export type UpdateDeferralReason = "dismissed" | "late_activation" | "active_work";

/** The old worker's quiet report as flat telemetry; nothing for a worker that sent none. */
export function describeQuietReport(report: QuietReport | undefined) {
  if (!report) return {};
  const pending = Object.entries(report.pendingResponses).map(
    ([kind, count]) => `${kind}:${count}`
  );
  return {
    old_worker_tracked_work: report.trackedWork,
    old_worker_cancelled_fetches: report.cancelledFetches,
    old_worker_pending_responses: pending.join(",") || "none",
  };
}

/** What the page quiets for a hand-over, and lets go of when the hand-over ends. */
export interface UpdateHandoverParticipant {
  hold: () => void;
  release: () => void;
}

const participants = new Set<UpdateHandoverParticipant>();
let held = 0;

/**
 * Take part in update hand-overs. The active worker quiets its own work, but
 * anything the page keeps sending it is a fresh open event, and a waiting
 * worker cannot activate over one. Returns the way out; a participant that
 * joins during a hand-over is held at once.
 */
export function joinUpdateHandover(participant: UpdateHandoverParticipant): () => void {
  participants.add(participant);
  if (held > 0) participant.hold();
  return () => {
    participants.delete(participant);
  };
}

/** Hold every participant for one hand-over. The returned release runs once. */
export function holdUpdateHandover(): () => void {
  held += 1;
  for (const participant of participants) participant.hold();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held -= 1;
    if (held > 0) return;
    for (const participant of participants) participant.release();
  };
}

export interface UpdateActivationHandlers {
  /** The attempt has begun; nothing has been asked of either worker yet. */
  onStarted: (properties: UpdateTelemetry) => void;
  /** An acknowledgment from either worker. */
  onProgress: (properties: UpdateTelemetry) => void;
  /** Any state the target passes through, whether or not it was still awaited. */
  onTargetState: (properties: UpdateTelemetry) => void;
  /** The target is active: restart onto it. `late` means the wait had given up. */
  onRestart: (properties: UpdateTelemetry, late: boolean) => void;
  /** Nothing took control before the deadline. */
  onTimeout: (properties: UpdateTelemetry) => void;
  /** A late activation this page chose to leave to the person. */
  onDeferred: (reason: UpdateDeferralReason) => void;
  /** True while open work would lose something in a restart. */
  isBlocked: () => boolean;
  /** False once the person has dismissed this update. */
  isWanted: () => boolean;
}

/**
 * Apply one update: observe the target, quiet the old worker, ask the new one
 * to take over, and decide what a late activation means. `cancel` stops the
 * wait; `dispose` also stops observing, which the page does when it lets go of
 * the attempt for good.
 */
export function beginUpdateActivation(
  worker: ServiceWorker,
  getRegistration: () => ServiceWorkerRegistration | null,
  handlers: UpdateActivationHandlers,
  timeoutMs: number
): { cancel: () => void; dispose: () => void } {
  let acknowledgment = "not_received";
  let oldWorker: ReturnType<typeof describeQuietReport> = {};

  const diagnostics = observeUpdateAttempt(worker, getRegistration, (properties, late) => {
    handlers.onTargetState(properties);
    if (!late) return;
    // The wait gave up, but the request to activate stayed with the browser,
    // which acts on it the moment the old worker drains. Finish the restart the
    // person asked for, unless they dismissed it, picked work back up, or
    // tapped too long ago to still be waiting on it.
    const reason: UpdateDeferralReason | null = !handlers.isWanted()
      ? "dismissed"
      : late.elapsedMs > LATE_RESTART_WINDOW_MS
        ? "late_activation"
        : handlers.isBlocked()
          ? "active_work"
          : null;
    if (reason) handlers.onDeferred(reason);
    else handlers.onRestart(diagnostics.telemetry({ phase: "error" }), true);
  });

  handlers.onStarted(diagnostics.telemetry({ phase: "activating" }));

  const cancel = activateWaitingWorker(
    worker,
    {
      onProgress: (status, report) => {
        acknowledgment = status;
        if (report) oldWorker = describeQuietReport(report);
        handlers.onProgress(diagnostics.telemetry({ acknowledgment: status, ...oldWorker }));
      },
      onActivated: () => handlers.onRestart(diagnostics.telemetry({ phase: "activating" }), false),
      onTimeout: () => {
        diagnostics.markTimedOut();
        logger.warn("Service worker update did not activate before timeout", {
          source: "beginUpdateActivation",
          timeoutMs,
        });
        handlers.onTimeout(
          diagnostics.telemetry({
            phase: "error",
            timeout_ms: timeoutMs,
            acknowledgment,
            ...oldWorker,
          })
        );
      },
    },
    timeoutMs
  );

  return {
    cancel,
    dispose: () => {
      cancel();
      diagnostics.dispose();
    },
  };
}
