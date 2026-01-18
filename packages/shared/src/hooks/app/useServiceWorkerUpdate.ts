import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    // Only run in production or when SW is explicitly enabled
    const enableDevServiceWorker = import.meta.env.VITE_ENABLE_SW_DEV === "true";
    if (!(import.meta.env.PROD || enableDevServiceWorker)) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const checkForWaitingWorker = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
        track("sw_update_available", { source: "initial_check" });
      }
    };

    const handleUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          // New SW installed, waiting to activate
          setWaitingWorker(installing);
          setUpdateAvailable(true);
          track("sw_update_available", { source: "update_found" });
        }
      });
    };

    const setup = async () => {
      try {
        registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Check if there's already a waiting worker
        checkForWaitingWorker(registration);

        // Listen for future updates
        registration.addEventListener("updatefound", handleUpdateFound);

        // Proactively check for updates on visibility change (mobile PWA optimization)
        const checkForUpdates = async () => {
          try {
            await registration?.update();
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

        return () => {
          registration?.removeEventListener("updatefound", handleUpdateFound);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          window.removeEventListener("focus", handleFocus);
        };
      } catch (error) {
        console.error("[useServiceWorkerUpdate] Setup failed:", error);
      }
    };

    const cleanup = setup();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    setIsUpdating(true);
    track("sw_update_applied", {});

    // Tell the waiting SW to skip waiting and become active
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // Listen for the controller change to reload
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, [waitingWorker]);

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
