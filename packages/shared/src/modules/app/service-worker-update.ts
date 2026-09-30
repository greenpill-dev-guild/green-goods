/**
 * Service worker update helpers shared by the update hook.
 *
 * The hook owns React state; this module owns the browser-facing mechanics
 * that do not need it: following an installing worker to its outcome, waiting
 * for a manual check to settle, and shaping telemetry.
 *
 * @module modules/app/service-worker-update
 */

import { type QuietReport, SW_MESSAGE, SW_REPLY } from "./service-worker-protocol";

/**
 * Longest a download may run before the UI stops reporting it. The PWA shell
 * precache is well under a megabyte, so a healthy install settles in seconds;
 * anything longer is a stalled fetch the browser will eventually give up on.
 */
export const DOWNLOAD_TIMEOUT_MS = 90_000;

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? import.meta.env.VITE_GIT_SHA ?? "unknown";

export function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function durationSince(startedAt: number | null) {
  return startedAt === null ? undefined : Math.round(now() - startedAt);
}

function getServiceWorkerVersion(worker: ServiceWorker | null | undefined) {
  if (!worker?.scriptURL || typeof window === "undefined") return "unknown";

  try {
    const url = new URL(worker.scriptURL, window.location.href);
    return url.searchParams.get("gg_v") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function buildUpdateTelemetry(
  waiting: ServiceWorker | null | undefined,
  properties: Record<string, string | number | boolean | undefined> = {},
  registration?: ServiceWorkerRegistration | null
) {
  const serviceWorker =
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : null;

  return {
    app_version: APP_VERSION,
    active_worker_version: getServiceWorkerVersion(serviceWorker?.controller),
    waiting_worker_version: getServiceWorkerVersion(waiting),
    controller_state: serviceWorker?.controller?.state ?? "none",
    target_worker_state: waiting?.state ?? "none",
    registration_present: Boolean(registration),
    registered_active_worker_state: registration?.active?.state ?? "none",
    registered_waiting_worker_state: registration?.waiting?.state ?? "none",
    registered_installing_worker_state: registration?.installing?.state ?? "none",
    target_is_registered_waiting: Boolean(waiting && waiting === registration?.waiting),
    target_is_registered_active: Boolean(waiting && waiting === registration?.active),
    target_is_controller: Boolean(waiting && waiting === serviceWorker?.controller),
    visibility_state: typeof document === "undefined" ? "unknown" : document.visibilityState,
    ...properties,
  };
}

function hasController() {
  return Boolean(navigator.serviceWorker?.controller);
}

/**
 * The failure cause as flat telemetry. The DOMException/error name tells a
 * browser failure (SecurityError) apart from a cache/quota one (QuotaExceededError)
 * on a failed check; the online state already rides on every event via `track`.
 */
export function describeUpdateFailure(error: unknown) {
  if (error instanceof Error) {
    return { error_name: error.name };
  }
  return { error_name: "unknown" };
}

/** Observe an attempt's exact target without changing activation or reload behavior. */
export function observeUpdateAttempt(
  worker: ServiceWorker,
  getRegistration: () => ServiceWorkerRegistration | null,
  onStateChange: (
    properties: ReturnType<typeof buildUpdateTelemetry>,
    /** Set when the target reached `activated` after the attempt had timed out. */
    lateActivation?: { elapsedMs: number }
  ) => void
) {
  const startedAt = now();
  let timedOut = false;
  const telemetry = (properties: Record<string, string | number | boolean | undefined> = {}) =>
    buildUpdateTelemetry(
      worker,
      {
        duration_ms: durationSince(startedAt),
        after_timeout: timedOut,
        ...properties,
      },
      getRegistration()
    );
  const dispose = () => worker.removeEventListener("statechange", observe);
  const observe = () => {
    const late = timedOut && worker.state === "activated";
    onStateChange(telemetry(), late ? { elapsedMs: now() - startedAt } : undefined);
    if (worker.state === "activated" || worker.state === "redundant") dispose();
  };
  // This listener survives an activation timeout, because the browser activates
  // the target whenever the old worker finally drains. It only reports the
  // transition; whether a late one may still restart the app is the caller's
  // call, since the user may have picked work back up by then.
  worker.addEventListener("statechange", observe);
  return {
    telemetry,
    dispose,
    markTimedOut: () => {
      timedOut = true;
    },
  };
}

export interface InstallWatcherHandlers {
  /** A newer worker is downloading while a worker already controls the page. */
  onDownloading: () => void;
  /** The worker reached `installed` and can replace the controlling worker. */
  onInstalled: (worker: ServiceWorker, source: string) => void;
  /** The worker installed but nothing controls the page yet: a first install. */
  onFirstInstall: (source: string) => void;
  /** The worker became redundant before it installed. */
  onFailed: (source: string) => void;
  /** The download has not settled within the timeout. */
  onTimeout: (source: string) => void;
}

export interface InstallWatcher {
  /** Follow `installing` to its outcome. Repeating the same worker is a no-op. */
  watch: (installing: ServiceWorker, source: string) => void;
  /** Stop following the current worker and clear the watchdog. */
  dispose: () => void;
}

/**
 * Follows one installing worker at a time and reports where it ends up.
 *
 * `installed` is the only success. `redundant` before that is a failed
 * install; a settled worker going redundant later is just a replacement. A
 * worker installing while nothing controls the page is the first install,
 * not an update the user is waiting on, so it neither reports a download nor
 * arms the watchdog.
 */
export function createInstallWatcher(
  handlers: InstallWatcherHandlers,
  timeoutMs = DOWNLOAD_TIMEOUT_MS
): InstallWatcher {
  let current: ServiceWorker | null = null;
  let source = "update_found";
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearWatchdog = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const handleStateChange = () => {
    if (!current || settled) return;
    if (current.state === "installed") {
      settled = true;
      clearWatchdog();
      if (hasController()) handlers.onInstalled(current, source);
      else handlers.onFirstInstall(source);
    } else if (current.state === "redundant") {
      settled = true;
      clearWatchdog();
      handlers.onFailed(source);
    }
  };

  const dispose = () => {
    current?.removeEventListener("statechange", handleStateChange);
    current = null;
    clearWatchdog();
  };

  return {
    watch(installing, nextSource) {
      if (current === installing) return;
      dispose();
      current = installing;
      source = nextSource;
      settled = false;
      installing.addEventListener("statechange", handleStateChange);
      if (!hasController()) return;
      handlers.onDownloading();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (!settled) handlers.onTimeout(source);
      }, timeoutMs);
    },
    dispose,
  };
}

export type InstallSettlement =
  /** The worker finished installing and can replace the controlling worker. */
  | { status: "installed"; worker: ServiceWorker }
  /** The worker finished installing but nothing controls the page: a first install. */
  | { status: "first-install" }
  /** The install failed: the worker became redundant before installing. */
  | { status: "failed" }
  /** Nothing settled before the timeout; the install may still be running. */
  | { status: "timeout" };

/**
 * Resolve once an update check settles. `registration.update()` resolves as
 * soon as the browser has compared the scripts, and a newer worker is already
 * `installing` by then; the app can only act once that worker reaches
 * `installed`, fails, or outlasts the timeout. `onInstalling` fires when a
 * worker starts installing during the wait so the caller can follow it.
 */
export function waitForInstallToSettle(
  registration: ServiceWorkerRegistration,
  onInstalling: () => void,
  timeoutMs = DOWNLOAD_TIMEOUT_MS
): Promise<InstallSettlement> {
  if (registration.waiting) {
    return Promise.resolve({ status: "installed", worker: registration.waiting });
  }

  return new Promise((resolve) => {
    let installing = registration.installing;
    // eslint-disable-next-line prefer-const -- reassigned by setTimeout below
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (settlement: InstallSettlement) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      registration.removeEventListener("updatefound", handleUpdateFound);
      installing?.removeEventListener("statechange", handleStateChange);
      resolve(settlement);
    };

    const handleStateChange = () => {
      if (!installing) return;
      if (installing.state === "installed") {
        cleanup(
          hasController()
            ? { status: "installed", worker: registration.waiting ?? installing }
            : { status: "first-install" }
        );
      } else if (installing.state === "redundant") {
        cleanup({ status: "failed" });
      }
    };

    const handleUpdateFound = () => {
      installing?.removeEventListener("statechange", handleStateChange);
      installing = registration.installing;
      if (installing) {
        onInstalling();
        installing.addEventListener("statechange", handleStateChange);
      }
    };

    if (installing) {
      installing.addEventListener("statechange", handleStateChange);
      if (installing.state === "installed" || installing.state === "redundant") {
        handleStateChange();
        return;
      }
    }

    registration.addEventListener("updatefound", handleUpdateFound);
    timeoutId = setTimeout(() => cleanup({ status: "timeout" }), timeoutMs);
  });
}

export function isServiceWorkerUpdateEnabled() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW_DEV === "true";
}

export interface ActivationHandlers {
  /** The new worker took control of the page; the caller reloads. */
  onActivated: () => void;
  /** Nothing took control within the timeout. */
  onTimeout: () => void;
  /** `report` comes with "quiet", from an active worker new enough to send one. */
  onProgress?: (
    status:
      | "quieting"
      | "quiet"
      | "quiescence_unavailable"
      | "received"
      | "requested"
      | "rejected"
      | "send_failed",
    report?: QuietReport
  ) => void;
}

/** The report as the active worker sent it, or nothing when the shape is not the one expected. */
function readQuietReport(value: unknown): QuietReport | undefined {
  const report = value as Partial<QuietReport> | null | undefined;
  if (
    typeof report?.trackedWork !== "number" ||
    typeof report.cancelledFetches !== "number" ||
    typeof report.pendingResponses !== "object" ||
    report.pendingResponses === null
  ) {
    return undefined;
  }
  return report as QuietReport;
}

/** The worker this attempt should target: the live waiting one, or a remembered active one. */
export function resolveUpdateTarget(
  registration: ServiceWorkerRegistration | null,
  remembered: ServiceWorker | null
) {
  if (registration?.waiting) return registration.waiting;
  return remembered && remembered === registration?.active ? remembered : null;
}

/** Wait for the target to reach `activated`; an acknowledgment alone never permits a reload. */
export function activateWaitingWorker(
  worker: ServiceWorker,
  handlers: ActivationHandlers,
  timeoutMs: number
): () => void {
  let done = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const updateChannel = handlers.onProgress ? new MessageChannel() : null;
  const quietChannel = navigator.serviceWorker.controller ? new MessageChannel() : null;
  const active = navigator.serviceWorker.controller;

  const resumeActiveWorker = () => {
    if (!active || active === worker) return;
    try {
      active.postMessage({ type: SW_MESSAGE.RESUME_BACKGROUND_WORK });
    } catch {
      // The old worker may already have been terminated by activation.
    }
  };

  const finish = () => {
    done = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    worker.removeEventListener("statechange", handleStateChange);
    updateChannel?.port1.close();
    updateChannel?.port2.close();
    quietChannel?.port1.close();
    quietChannel?.port2.close();
  };

  const settle = () => {
    if (done) return;
    finish();
    handlers.onActivated();
  };
  const handleControllerChange = () => {
    if (navigator.serviceWorker.controller === worker) settle();
  };
  // The worker never claims open pages, so a controller change is not
  // guaranteed. Reaching `activated` is enough: the reload that follows is a
  // navigation, and navigations are served by the active worker.
  const handleStateChange = () => {
    if (worker.state === "activated") settle();
  };

  if (worker.state === "activated") {
    updateChannel?.port1.close();
    updateChannel?.port2.close();
    quietChannel?.port1.close();
    quietChannel?.port2.close();
    handlers.onActivated();
    return () => {};
  }

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  worker.addEventListener("statechange", handleStateChange);
  if (updateChannel) {
    updateChannel.port1.onmessage = ({ data }) => {
      if (done || data?.type !== SW_REPLY.UPDATE_ACK) return;
      if (["received", "requested", "rejected"].includes(data.status)) {
        handlers.onProgress?.(data.status);
      }
    };
  }
  timeoutId = setTimeout(() => {
    if (done) return;
    resumeActiveWorker();
    finish();
    handlers.onTimeout();
  }, timeoutMs);

  const requestActivation = () => {
    if (done) return;
    try {
      if (updateChannel) {
        worker.postMessage({ type: SW_MESSAGE.SKIP_WAITING }, [updateChannel.port2]);
      } else worker.postMessage({ type: SW_MESSAGE.SKIP_WAITING });
    } catch {
      handlers.onProgress?.("send_failed");
      resumeActiveWorker();
      finish();
      handlers.onTimeout();
    }
  };

  if (!active || active === worker || !quietChannel) {
    requestActivation();
  } else {
    handlers.onProgress?.("quieting");
    quietChannel.port1.onmessage = ({ data }) => {
      if (done || data?.type !== SW_REPLY.QUIET_ACK) return;
      if (data.status !== "quiet") {
        handlers.onProgress?.("quiescence_unavailable");
        resumeActiveWorker();
        finish();
        handlers.onTimeout();
        return;
      }
      const report = readQuietReport(data.report);
      if (report) handlers.onProgress?.("quiet", report);
      else handlers.onProgress?.("quiet");
      quietChannel.port1.close();
      requestActivation();
    };
    try {
      active.postMessage({ type: SW_MESSAGE.PREPARE_TO_ACTIVATE_UPDATE }, [quietChannel.port2]);
    } catch {
      handlers.onProgress?.("quiescence_unavailable");
      resumeActiveWorker();
      finish();
      handlers.onTimeout();
    }
  }

  /**
   * Abandoning an attempt leaves the old worker quiet, and it has no other way
   * to hear that the hand-over is off: every path that gives up tells it, and
   * this is the one the page calls. Once the update has activated there is
   * nothing to resume, so a settled attempt cancels to nothing.
   */
  return () => {
    if (done) return;
    resumeActiveWorker();
    finish();
  };
}

const UPDATE_APPLIED_KEY = "gg-update-applied";

/** Remember, across the reload an update triggers, that the app restarted onto a new worker. */
export function markUpdateApplied(): void {
  try {
    sessionStorage.setItem(UPDATE_APPLIED_KEY, "1");
  } catch {
    // Storage can be unavailable; the post-restart toast is a courtesy, not state.
  }
}

let appliedThisLoad = false;

/**
 * True for the rest of the page load once the flag has been seen, so a reader
 * that mounts twice (React strict mode) gets the same answer; the flag itself
 * is cleared on the first read so the next load starts clean.
 */
export function consumeUpdateApplied(): boolean {
  if (appliedThisLoad) return true;
  try {
    if (sessionStorage.getItem(UPDATE_APPLIED_KEY) === null) return false;
    sessionStorage.removeItem(UPDATE_APPLIED_KEY);
    appliedThisLoad = true;
  } catch {
    return false;
  }
  return true;
}
