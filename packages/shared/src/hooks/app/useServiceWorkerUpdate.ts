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

export interface ServiceWorkerUpdateState {
  /** Whether a new service worker is waiting to activate */
  updateAvailable: boolean;
  /** Whether the update is currently being applied */
  isUpdating: boolean;
  /** Apply the update (reloads the page) */
  applyUpdate: () => void;
  /** Dismiss the update notification (user can update later) */
  dismissUpdate: () => void;
  /** The waiting service worker registration, if any */
  waitingWorker: ServiceWorker | null;
}

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
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Track registration for cleanup
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const installingWorkerRef = useRef<ServiceWorker | null>(null);

  // Check if SW is enabled - memoized to avoid recomputation
  const isEnabled = useMemo(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    const enableDevServiceWorker = import.meta.env.VITE_ENABLE_SW_DEV === "true";
    return import.meta.env.PROD || enableDevServiceWorker;
  }, []);

  // Handler for when a new SW is found installing
  const handleStateChange = useCallback(() => {
    const installing = installingWorkerRef.current;
    if (installing?.state === "installed" && navigator.serviceWorker.controller) {
      setWaitingWorker(installing);
      setUpdateAvailable(true);
      track("sw_update_available", { source: "update_found" });
    }
  }, []);

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
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
          track("sw_update_available", { source: "initial_check" });
        }

        // Listen for future updates
        registration.addEventListener("updatefound", handleUpdateFound);
        cleanupFns.push(() => {
          registration.removeEventListener("updatefound", handleUpdateFound);
        });

        // Proactively check for updates
        const checkForUpdates = async () => {
          try {
            await registration.update();
          } catch {
            // Silently ignore update check failures (offline, etc.)
          }
        };

        // Check on initial load
        void checkForUpdates();

        // Check when app comes to foreground
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
    };
  }, [isEnabled, handleUpdateFound, handleStateChange, markUpdateAvailable]);

  // Use the event listener hook for controller change (with { once: true })
  // This ensures we only handle it once and it's properly cleaned up
  const handleControllerChange = useCallback(() => {
    window.location.reload();
  }, []);

  // Track if we've added the controllerchange listener
  const controllerChangeListenerRef = useRef(false);

  // Apply update handler
  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    setIsUpdating(true);
    track("sw_update_applied", {});

    // Tell the waiting SW to skip waiting and become active
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // Use { once: true } to automatically remove the listener after it fires
    // Track that we added it for cleanup on unmount
    controllerChangeListenerRef.current = true;
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange, {
      once: true,
    });
  }, [waitingWorker, handleControllerChange]);

  // Cleanup effect for controllerchange listener if component unmounts before it fires
  useEffect(() => {
    return () => {
      if (controllerChangeListenerRef.current) {
        navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
        controllerChangeListenerRef.current = false;
      }
    };
  }, [handleControllerChange]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    setUpdateAvailable(false);
    track("sw_update_dismissed", {});
  }, []);

  return {
    updateAvailable: updateAvailable && !dismissed,
    isUpdating,
    applyUpdate,
    dismissUpdate,
    waitingWorker,
  };
}
