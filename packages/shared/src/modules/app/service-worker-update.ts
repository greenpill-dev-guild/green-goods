/**
 * Settle helper for service worker update checks.
 *
 * `registration.update()` resolves as soon as the browser has compared the
 * scripts. When a newer worker exists it is already `installing` by then, but
 * the app can only offer a restart once that worker reaches `installed`, so
 * a manual check waits here for the install to settle.
 *
 * @module modules/app/service-worker-update
 */

/** Longest a manual check waits for an installing worker to reach `installed`. */
export const WAITING_WORKER_TIMEOUT_MS = 10_000;

/**
 * Resolve with the worker that finished installing after an update check, or
 * `null` when nothing settles before the timeout. `onInstalling` fires when a
 * worker starts installing during the wait so the caller can reflect the
 * download phase.
 */
export function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  onInstalling: () => void,
  timeoutMs = WAITING_WORKER_TIMEOUT_MS
): Promise<ServiceWorker | null> {
  if (registration.waiting) {
    return Promise.resolve(registration.waiting);
  }

  return new Promise((resolve) => {
    let installing = registration.installing;
    // eslint-disable-next-line prefer-const -- reassigned by setTimeout below
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (worker: ServiceWorker | null) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      registration.removeEventListener("updatefound", handleUpdateFound);
      installing?.removeEventListener("statechange", handleStateChange);
      resolve(worker);
    };

    const handleStateChange = () => {
      if (installing?.state === "installed" && navigator.serviceWorker.controller) {
        cleanup(registration.waiting ?? installing ?? null);
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
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        cleanup(registration.waiting ?? installing ?? null);
        return;
      }
    }

    registration.addEventListener("updatefound", handleUpdateFound);
    timeoutId = setTimeout(() => cleanup(registration.waiting ?? null), timeoutMs);
  });
}
