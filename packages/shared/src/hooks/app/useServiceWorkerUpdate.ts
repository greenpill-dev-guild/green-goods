/** User-controlled worker updates with active-work protection. */

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { logger } from "../../modules/app/logger";
import { track } from "../../modules/app/posthog";
import {
  activateWaitingWorker,
  buildUpdateTelemetry,
  consumeUpdateApplied,
  createInstallWatcher,
  DOWNLOAD_TIMEOUT_MS,
  durationSince,
  isServiceWorkerUpdateEnabled,
  markUpdateApplied,
  now,
  observeUpdateAttempt,
  resolveUpdateTarget,
  waitForInstallToSettle,
} from "../../modules/app/service-worker-update";
import { useTimeout } from "../utils/useTimeout";

export type ServiceWorkerUpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "waiting"
  | "activating"
  | "error"
  | "install-failed";

/** Result of a manual update check; rejects when the check itself fails. */
export type UpdateCheckResult = "up-to-date" | "ready" | "pending" | "failed";

export interface ServiceWorkerUpdateState {
  activationBlocked: boolean;
  /** Current user-facing update phase */
  phase: ServiceWorkerUpdatePhase;
  /** Whether a new service worker is waiting to activate */
  updateAvailable: boolean;
  /** Whether the update is currently being applied */
  isUpdating: boolean;
  /** Whether applyUpdate timed out waiting for the new worker to activate */
  updateStalled: boolean;
  /** Long-lived clients wait before surfacing the restart action. */
  shouldPrompt: boolean;
  /** Check for an update and report what the registration settled on. */
  checkForUpdate: () => Promise<UpdateCheckResult>;
  /** Apply the update (reloads the page) */
  applyUpdate: () => void;
  /** Activate the waiting worker and reload exactly once. */
  activateNow: () => void;
  /** Dismiss the update notification (user can update later) */
  dismissUpdate: () => void;
  /** The waiting service worker registration, if any */
  waitingWorker: ServiceWorker | null;
  /** True for this page load when it began with an update-triggered reload. */
  restartedOnNewVersion: boolean;
}

// Bound the busy UI; reaching this deadline does not prove activation failed.
export const APPLY_UPDATE_TIMEOUT_MS = 7_000;
export const LONG_SESSION_UPDATE_PROMPT_MS = 30 * 60 * 1000;

/** Throttle automatic checks; manual checks and initial mount bypass the gap. */
const MIN_AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;

type ActivationProtection = { activationBlocked?: boolean; isActivationBlocked?: () => boolean };
const allowActivation = () => false;

function useServiceWorkerUpdateController({
  activationBlocked = false,
  isActivationBlocked = allowActivation,
}: ActivationProtection): ServiceWorkerUpdateState {
  const [phase, setPhase] = useState<ServiceWorkerUpdatePhase>("idle");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStalled, setUpdateStalled] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [restartedOnNewVersion] = useState(consumeUpdateApplied);

  const { set: scheduleWaitingPrompt, clear: clearWaitingPrompt } = useTimeout();

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const checkStartedAtRef = useRef<number | null>(null);
  const downloadStartedAtRef = useRef<number | null>(null);
  const reloadGuardRef = useRef(false);
  const lastAutoCheckRef = useRef(0);
  const cancelActivationRef = useRef<(() => void) | null>(null);
  const stopActivationDiagnosticsRef = useRef<(() => void) | null>(null);

  const isEnabled = useMemo(isServiceWorkerUpdateEnabled, []);

  const buildTelemetry = useCallback(
    (properties: Record<string, string | number | boolean | undefined> = {}) =>
      buildUpdateTelemetry(
        waitingWorkerRef.current ?? registrationRef.current?.waiting,
        properties,
        registrationRef.current
      ),
    []
  );

  const markUpdateAvailable = useCallback(
    (worker: ServiceWorker, source: string) => {
      waitingWorkerRef.current = worker;
      setWaitingWorker(worker);
      setDismissed(false);
      setUpdateAvailable(true);
      setUpdateStalled(false);
      setIsUpdating(false);
      setPhase("waiting");
      setShouldPrompt(false);
      clearWaitingPrompt();
      scheduleWaitingPrompt(() => setShouldPrompt(true), LONG_SESSION_UPDATE_PROMPT_MS);

      const telemetry = buildTelemetry({
        source,
        phase: "waiting",
        check_duration_ms: durationSince(checkStartedAtRef.current),
        install_duration_ms: durationSince(downloadStartedAtRef.current),
      });
      track("sw_update_available", telemetry);
      track("sw_update_ready", telemetry);
      checkStartedAtRef.current = null;
      downloadStartedAtRef.current = null;
    },
    [buildTelemetry, clearWaitingPrompt, scheduleWaitingPrompt]
  );

  const markDownloading = useCallback(() => {
    downloadStartedAtRef.current = downloadStartedAtRef.current ?? now();
    setPhase("downloading");
    track(
      "sw_update_download_started",
      buildTelemetry({
        phase: "downloading",
        check_duration_ms: durationSince(checkStartedAtRef.current),
      })
    );
  }, [buildTelemetry]);

  const settleFirstInstall = useCallback(
    (source: string) => {
      setPhase((current) =>
        current === "checking" || current === "downloading" ? "idle" : current
      );
      track(
        "sw_update_check_completed",
        buildTelemetry({
          source,
          phase: "idle",
          duration_ms: durationSince(checkStartedAtRef.current),
          found_update: false,
          first_install: true,
        })
      );
      checkStartedAtRef.current = null;
      downloadStartedAtRef.current = null;
    },
    [buildTelemetry]
  );

  const markInstallFailed = useCallback(
    (source: string) => {
      setPhase("install-failed");
      logger.warn("Service worker update failed to install", {
        source: "useServiceWorkerUpdate",
        checkSource: source,
      });
      track(
        "sw_update_install_failed",
        buildTelemetry({
          source,
          phase: "install-failed",
          install_duration_ms: durationSince(downloadStartedAtRef.current),
        })
      );
      checkStartedAtRef.current = null;
      downloadStartedAtRef.current = null;
    },
    [buildTelemetry]
  );

  // The download outlasted the watchdog: stop reporting it so the row offers a
  // fresh check. A late `installed` still surfaces through the watcher.
  const markDownloadTimeout = useCallback(
    (source: string) => {
      setPhase((current) => (current === "downloading" ? "idle" : current));
      logger.warn("Service worker download did not settle before timeout", {
        source: "useServiceWorkerUpdate",
        checkSource: source,
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
      });
      track(
        "sw_update_download_timeout",
        buildTelemetry({
          source,
          phase: "idle",
          duration_ms: durationSince(downloadStartedAtRef.current),
          timeout_ms: DOWNLOAD_TIMEOUT_MS,
        })
      );
      downloadStartedAtRef.current = null;
    },
    [buildTelemetry]
  );

  const installWatcher = useMemo(
    () =>
      createInstallWatcher({
        onDownloading: markDownloading,
        onInstalled: markUpdateAvailable,
        onFirstInstall: settleFirstInstall,
        onFailed: markInstallFailed,
        onTimeout: markDownloadTimeout,
      }),
    [
      markDownloading,
      markUpdateAvailable,
      settleFirstInstall,
      markInstallFailed,
      markDownloadTimeout,
    ]
  );

  useEffect(() => () => installWatcher.dispose(), [installWatcher]);

  const handleUpdateFound = useCallback(() => {
    const installing = registrationRef.current?.installing;
    if (installing) installWatcher.watch(installing, "update_found");
  }, [installWatcher]);

  useEffect(() => {
    if (!isEnabled) return;

    let isMounted = true;
    const cleanupFns: (() => void)[] = [];

    const setup = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/home/");
        if (!isMounted) return;

        registrationRef.current = registration ?? null;
        track("sw_update_state_observed", buildTelemetry({ source: "startup" }));
        if (!registration) return;

        registration.addEventListener("updatefound", handleUpdateFound);
        cleanupFns.push(() => {
          registration.removeEventListener("updatefound", handleUpdateFound);
        });

        const checkForUpdates = async (force = false) => {
          if (!force) {
            const elapsed = Date.now() - lastAutoCheckRef.current;
            if (elapsed < MIN_AUTO_CHECK_INTERVAL_MS) return;
          }
          lastAutoCheckRef.current = Date.now();
          checkStartedAtRef.current = now();
          setPhase((current) => (current === "idle" ? "checking" : current));
          const source = force ? "initial_check" : "auto_check";
          try {
            await registration.update();
            const duration = durationSince(checkStartedAtRef.current);
            if (registration.waiting) {
              markUpdateAvailable(registration.waiting, source);
            } else if (registration.installing) {
              installWatcher.watch(registration.installing, source);
            } else {
              setPhase((current) => (current === "checking" ? "idle" : current));
            }
            track(
              "sw_update_check_completed",
              buildTelemetry({
                source,
                phase: registration.waiting
                  ? "waiting"
                  : registration.installing
                    ? "downloading"
                    : "idle",
                duration_ms: duration,
                found_update: Boolean(registration.waiting || registration.installing),
              })
            );
          } catch {
            setPhase((current) => (current === "checking" ? "idle" : current));
            track(
              "sw_update_check_failed",
              buildTelemetry({
                source,
                duration_ms: durationSince(checkStartedAtRef.current),
              })
            );
          }
        };

        if (registration.waiting) {
          markUpdateAvailable(registration.waiting, "initial_check");
        } else {
          void checkForUpdates(true);
        }

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            track("sw_update_state_observed", buildTelemetry({ source: "resume" }));
            void checkForUpdates();
          }
        };

        const handleControllerChange = () =>
          track("sw_update_state_observed", buildTelemetry({ source: "controller_change" }));
        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        const handleFocus = () => void checkForUpdates();

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        cleanupFns.push(() => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          window.removeEventListener("focus", handleFocus);
          navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        });
      } catch (error) {
        logger.error("Service worker update setup failed", {
          source: "useServiceWorkerUpdate",
          error,
        });
      }
    };

    void setup();

    return () => {
      isMounted = false;
      installWatcher.dispose();
      cleanupFns.forEach((fn) => fn());
      registrationRef.current = null;
      waitingWorkerRef.current = null;
      checkStartedAtRef.current = null;
      downloadStartedAtRef.current = null;
    };
  }, [isEnabled, buildTelemetry, handleUpdateFound, installWatcher, markUpdateAvailable]);

  const checkForUpdate = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!isEnabled) return "up-to-date";

    checkStartedAtRef.current = now();
    setUpdateStalled(false);
    setPhase("checking");

    const completeWithoutUpdate = (): UpdateCheckResult => {
      setPhase((current) => (current === "checking" ? "idle" : current));
      track(
        "sw_update_check_completed",
        buildTelemetry({
          source: "manual_check",
          phase: "idle",
          duration_ms: durationSince(checkStartedAtRef.current),
          found_update: false,
        })
      );
      checkStartedAtRef.current = null;
      return "up-to-date";
    };

    try {
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.getRegistration("/home/"));
      if (!registration) return completeWithoutUpdate();
      registrationRef.current = registration;

      if (registration.waiting) {
        markUpdateAvailable(registration.waiting, "manual_check");
        return "ready";
      }

      lastAutoCheckRef.current = Date.now();
      await registration.update();

      if (!registration.installing && !registration.waiting) return completeWithoutUpdate();

      const watchManualInstall = () => {
        const installing = registration.installing;
        if (installing) installWatcher.watch(installing, "manual_check");
      };
      watchManualInstall();
      const settlement = await waitForInstallToSettle(registration, watchManualInstall);
      switch (settlement.status) {
        case "installed":
          // The watcher normally marks it first; this covers a worker that was
          // already waiting when the wait began.
          if (waitingWorkerRef.current !== settlement.worker) {
            markUpdateAvailable(settlement.worker, "manual_check");
          }
          return "ready";
        case "first-install":
          return "up-to-date";
        case "failed":
          return "failed";
        default:
          // Still installing past the wait. The watcher owns the download
          // phase, so only a lingering "checking" needs clearing here.
          setPhase((current) => (current === "checking" ? "idle" : current));
          return "pending";
      }
    } catch (error) {
      logger.error("Service worker update check failed", {
        source: "useServiceWorkerUpdate.checkForUpdate",
        error,
      });
      setPhase("idle");
      track(
        "sw_update_check_failed",
        buildTelemetry({
          source: "manual_check",
          duration_ms: durationSince(checkStartedAtRef.current),
        })
      );
      checkStartedAtRef.current = null;
      throw error;
    }
  }, [buildTelemetry, installWatcher, isEnabled, markUpdateAvailable]);

  const applyUpdate = useCallback(() => {
    const worker = resolveUpdateTarget(registrationRef.current, waitingWorkerRef.current);
    if (!worker) {
      track("sw_update_state_observed", buildTelemetry({ source: "apply_no_target" }));
      setUpdateAvailable(false);
      setWaitingWorker(null);
      waitingWorkerRef.current = null;
      void checkForUpdate().catch(() => {});
      return;
    }
    if (isActivationBlocked()) {
      setPhase("waiting");
      track("sw_update_deferred", { reason: "active_work" });
      return;
    }

    cancelActivationRef.current?.();
    stopActivationDiagnosticsRef.current?.();
    waitingWorkerRef.current = worker;
    setUpdateStalled(false);
    setIsUpdating(true);
    setPhase("activating");
    const diagnostics = observeUpdateAttempt(
      worker,
      () => registrationRef.current,
      (properties) => track("sw_update_target_state_changed", properties)
    );
    stopActivationDiagnosticsRef.current = diagnostics.dispose;
    let acknowledgment = "not_received";
    const telemetry = diagnostics.telemetry({ phase: "activating" });
    track("sw_update_applied", telemetry);
    track("sw_update_apply_started", telemetry);

    cancelActivationRef.current = activateWaitingWorker(
      worker,
      {
        onProgress: (status) => {
          acknowledgment = status;
          track("sw_update_activation_ack", diagnostics.telemetry({ acknowledgment: status }));
        },
        onActivated: () => {
          cancelActivationRef.current = null;
          if (reloadGuardRef.current) return;
          reloadGuardRef.current = true;
          track("sw_update_apply_completed", diagnostics.telemetry({ phase: "activating" }));
          markUpdateApplied();
          window.location.reload();
        },
        onTimeout: () => {
          diagnostics.markTimedOut();
          cancelActivationRef.current = null;
          setIsUpdating(false);
          setUpdateStalled(true);
          setPhase("error");
          logger.warn("Service worker update did not activate before timeout", {
            source: "useServiceWorkerUpdate.applyUpdate",
            timeoutMs: APPLY_UPDATE_TIMEOUT_MS,
          });
          track(
            "sw_update_apply_timeout",
            diagnostics.telemetry({
              phase: "error",
              timeout_ms: APPLY_UPDATE_TIMEOUT_MS,
              acknowledgment,
            })
          );
        },
      },
      APPLY_UPDATE_TIMEOUT_MS
    );
  }, [buildTelemetry, checkForUpdate, isActivationBlocked]);

  useEffect(() => {
    return () => {
      cancelActivationRef.current?.();
      cancelActivationRef.current = null;
      stopActivationDiagnosticsRef.current?.();
      stopActivationDiagnosticsRef.current = null;
      clearWaitingPrompt();
    };
  }, [clearWaitingPrompt]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    setUpdateAvailable(false);
    setUpdateStalled(false);
    setIsUpdating(false);
    setShouldPrompt(false);
    clearWaitingPrompt();
    setPhase("idle");
    track(
      "sw_update_dismissed",
      buildTelemetry({
        phase: "idle",
      })
    );
  }, [buildTelemetry, clearWaitingPrompt]);

  return {
    phase,
    updateAvailable: updateAvailable && !dismissed,
    isUpdating,
    updateStalled,
    shouldPrompt: shouldPrompt && !dismissed,
    checkForUpdate,
    applyUpdate,
    activateNow: applyUpdate,
    activationBlocked,
    dismissUpdate,
    waitingWorker,
    restartedOnNewVersion,
  };
}

const ServiceWorkerUpdateContext = createContext<ServiceWorkerUpdateState | null>(null);

export function ServiceWorkerUpdateProvider({
  children,
  ...protection
}: { children: ReactNode } & ActivationProtection) {
  const value = useServiceWorkerUpdateController(protection);
  return createElement(ServiceWorkerUpdateContext.Provider, { value }, children);
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const value = useContext(ServiceWorkerUpdateContext);
  if (!value) {
    throw new Error("useServiceWorkerUpdate must be used within ServiceWorkerUpdateProvider");
  }
  return value;
}
