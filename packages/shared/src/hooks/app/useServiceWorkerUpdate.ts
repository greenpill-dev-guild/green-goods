/**
 * Service Worker Update Hook
 *
 * Manages service worker updates with user control.
 * Uses utility hooks for proper event listener and async cleanup.
 *
 * @module hooks/app/useServiceWorkerUpdate
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "../../modules/app/logger";
import { track } from "../../modules/app/posthog";
import { useTimeout } from "../utils/useTimeout";

export interface ServiceWorkerUpdateState {
  /** Whether a new service worker is waiting to activate */
  updateAvailable: boolean;
  /** Whether the update is currently being applied */
  isUpdating: boolean;
  /** Whether applyUpdate timed out waiting for the new worker to activate */
  updateStalled: boolean;
  /** Check for an update and return true when a waiting worker is ready */
  checkForUpdate: () => Promise<boolean>;
  /** Apply the update (reloads the page) */
  applyUpdate: () => void;
  /** Dismiss the update notification (user can update later) */
  dismissUpdate: () => void;
  /** The waiting service worker registration, if any */
  waitingWorker: ServiceWorker | null;
}

const WAITING_WORKER_TIMEOUT_MS = 10_000;

/**
 * Bound on the apply path: time allowed between posting SKIP_WAITING and the
 * `controllerchange` reload. If the waiting worker never activates, recover
 * the UI (reset `isUpdating`, expose `updateStalled`) instead of hanging in
 * an indefinite "Updating…" state (PRD-500).
 */
export const APPLY_UPDATE_TIMEOUT_MS = 60_000;

/**
 * Minimum gap between automatic update checks triggered by `focus` /
 * `visibilitychange`. Prevents the toast from re-firing every time the user
 * brings the PWA to the foreground in a high-deploy-cadence environment.
 * Manual `checkForUpdate()` calls and the initial mount check are not
 * throttled.
 */
const MIN_AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Hook to manage service worker updates with user control.
 *
 * Instead of silently reloading when a new SW is available,
 * this hook provides state and actions so the UI can notify
 * the user and let them choose when to update.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { updateAvailable, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();
 *
 *   return (
 *     <>
 *       {updateAvailable && (
 *         <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} />
 *       )}
 *       <RestOfApp />
 *     </>
 *   );
 * }
 * ```
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStalled, setUpdateStalled] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Managed timeout for the apply path; cleared on activation and on unmount.
  const { set: scheduleApplyTimeout, clear: clearApplyTimeout } = useTimeout();

  // Track registration for cleanup
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const installingWorkerRef = useRef<ServiceWorker | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  // Timestamp of the last auto-check (focus/visibility-triggered). Used to
  // throttle network update checks; manual checks bypass this.
  const lastAutoCheckRef = useRef(0);

  // Check if SW is enabled - memoized to avoid recomputation
  const isEnabled = useMemo(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    const enableDevServiceWorker = import.meta.env.VITE_ENABLE_SW_DEV === "true";
    return import.meta.env.PROD || enableDevServiceWorker;
  }, []);

  const markUpdateAvailable = useCallback((worker: ServiceWorker, source: string) => {
    waitingWorkerRef.current = worker;
    setWaitingWorker(worker);
    setDismissed(false);
    setUpdateAvailable(true);
    track("sw_update_available", { source });
  }, []);

  // Handler for when a new SW is found installing
  const handleStateChange = useCallback(() => {
    const installing = installingWorkerRef.current;
    if (installing?.state === "installed" && navigator.serviceWorker.controller) {
      markUpdateAvailable(registrationRef.current?.waiting ?? installing, "update_found");
    }
  }, [markUpdateAvailable]);

  // Handler for update found event
  const handleUpdateFound = useCallback(() => {
    const registration = registrationRef.current;
    const installing = registration?.installing;
    if (!installing) return;

    // Clean up previous listener if any
    if (installingWorkerRef.current) {
      installingWorkerRef.current.removeEventListener("statechange", handleStateChange);
    }

    // Store reference and add listener
    installingWorkerRef.current = installing;
    installing.addEventListener("statechange", handleStateChange);
  }, [handleStateChange]);

  // Setup effect - get registration and check for waiting worker
  useEffect(() => {
    if (!isEnabled) return;

    let isMounted = true;
    const cleanupFns: (() => void)[] = [];

    const setup = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration || !isMounted) return;

        registrationRef.current = registration;

        // Check if there's already a waiting worker
        if (registration.waiting) {
          markUpdateAvailable(registration.waiting, "initial_check");
        }

        // Listen for future updates
        registration.addEventListener("updatefound", handleUpdateFound);
        cleanupFns.push(() => {
          registration.removeEventListener("updatefound", handleUpdateFound);
        });

        // Proactively check for updates. `force` skips the throttle so the
        // initial-load check always runs; focus/visibility paths respect the
        // MIN_AUTO_CHECK_INTERVAL_MS gap.
        const checkForUpdates = async (force = false) => {
          if (!force) {
            const elapsed = Date.now() - lastAutoCheckRef.current;
            if (elapsed < MIN_AUTO_CHECK_INTERVAL_MS) return;
          }
          lastAutoCheckRef.current = Date.now();
          try {
            await registration.update();
          } catch {
            // Silently ignore update check failures (offline, etc.)
          }
        };

        // Check on initial load (always — no throttle)
        void checkForUpdates(true);

        // Check when app comes to foreground (throttled)
        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            void checkForUpdates();
          }
        };

        const handleFocus = () => void checkForUpdates();

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        cleanupFns.push(() => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          window.removeEventListener("focus", handleFocus);
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
      // Clean up installing worker listener
      if (installingWorkerRef.current) {
        installingWorkerRef.current.removeEventListener("statechange", handleStateChange);
        installingWorkerRef.current = null;
      }
      // Run all cleanup functions
      cleanupFns.forEach((fn) => fn());
      registrationRef.current = null;
      waitingWorkerRef.current = null;
    };
  }, [isEnabled, handleUpdateFound, handleStateChange, markUpdateAvailable]);

  // Use the event listener hook for controller change (with { once: true })
  // This ensures we only handle it once and it's properly cleaned up
  const handleControllerChange = useCallback(() => {
    clearApplyTimeout();
    controllerChangeListenerRef.current = false;
    window.location.reload();
  }, [clearApplyTimeout]);

  // Track if we've added the controllerchange listener
  const controllerChangeListenerRef = useRef(false);

  const waitForWaitingWorker = useCallback(
    async (registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> => {
      if (registration.waiting) {
        return registration.waiting;
      }

      return new Promise((resolve) => {
        let installing = registration.installing;
        // eslint-disable-next-line prefer-const -- reassigned by setTimeout below
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const cleanup = (worker: ServiceWorker | null) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          registration.removeEventListener("updatefound", handleUpdateFoundOnce);
          if (installing) {
            installing.removeEventListener("statechange", handleStateChangeOnce);
          }
          resolve(worker);
        };

        const handleStateChangeOnce = () => {
          if (installing?.state === "installed" && navigator.serviceWorker.controller) {
            cleanup(registration.waiting ?? installing ?? null);
          }
        };

        const handleUpdateFoundOnce = () => {
          if (installing) {
            installing.removeEventListener("statechange", handleStateChangeOnce);
          }
          installing = registration.installing;
          if (installing) {
            installing.addEventListener("statechange", handleStateChangeOnce);
          }
        };

        if (installing) {
          installing.addEventListener("statechange", handleStateChangeOnce);
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            cleanup(registration.waiting ?? installing ?? null);
            return;
          }
        }

        registration.addEventListener("updatefound", handleUpdateFoundOnce);
        timeoutId = setTimeout(
          () => cleanup(registration.waiting ?? null),
          WAITING_WORKER_TIMEOUT_MS
        );
      });
    },
    []
  );

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    if (!isEnabled) return false;

    try {
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.getRegistration());

      if (!registration) return false;

      registrationRef.current = registration;

      if (registration.waiting) {
        markUpdateAvailable(registration.waiting, "manual_check");
        return true;
      }

      lastAutoCheckRef.current = Date.now();
      await registration.update();

      const waiting = await waitForWaitingWorker(registration);
      if (!waiting) {
        return false;
      }

      markUpdateAvailable(waiting, "manual_check");
      return true;
    } catch (error) {
      logger.error("Service worker update check failed", {
        source: "useServiceWorkerUpdate.checkForUpdate",
        error,
      });
      throw error;
    }
  }, [isEnabled, markUpdateAvailable, waitForWaitingWorker]);

  // Apply update handler
  const applyUpdate = useCallback(() => {
    const worker =
      waitingWorkerRef.current ?? waitingWorker ?? registrationRef.current?.waiting ?? null;
    if (!worker) return;

    clearApplyTimeout();
    if (controllerChangeListenerRef.current) {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      controllerChangeListenerRef.current = false;
    }

    waitingWorkerRef.current = worker;
    setUpdateStalled(false);
    setIsUpdating(true);
    track("sw_update_applied", {});

    // Tell the waiting SW to skip waiting and become active
    worker.postMessage({ type: "SKIP_WAITING" });

    // Use { once: true } to automatically remove the listener after it fires
    // Track that we added it for cleanup on unmount
    controllerChangeListenerRef.current = true;
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange, {
      once: true,
    });

    // Fail open after a bounded wait: if the waiting worker never activates
    // (PRD-500's indefinite "Updating…" hang), recover the UI so the user can
    // retry or keep using the current version.
    scheduleApplyTimeout(() => {
      if (controllerChangeListenerRef.current) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        controllerChangeListenerRef.current = false;
      }
      setIsUpdating(false);
      setUpdateStalled(true);
      logger.warn("Service worker update did not activate before timeout", {
        source: "useServiceWorkerUpdate.applyUpdate",
        timeoutMs: APPLY_UPDATE_TIMEOUT_MS,
      });
      track("sw_update_apply_timeout", {});
    }, APPLY_UPDATE_TIMEOUT_MS);
  }, [waitingWorker, handleControllerChange, scheduleApplyTimeout, clearApplyTimeout]);

  // Cleanup effect for apply timeout and controllerchange listener
  useEffect(() => {
    return () => {
      clearApplyTimeout();
      if (controllerChangeListenerRef.current) {
        navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
        controllerChangeListenerRef.current = false;
      }
    };
  }, [handleControllerChange, clearApplyTimeout]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    setUpdateAvailable(false);
    setUpdateStalled(false);
    track("sw_update_dismissed", {});
  }, []);

  return {
    updateAvailable: updateAvailable && !dismissed,
    isUpdating,
    updateStalled,
    checkForUpdate,
    applyUpdate,
    dismissUpdate,
    waitingWorker,
  };
}
