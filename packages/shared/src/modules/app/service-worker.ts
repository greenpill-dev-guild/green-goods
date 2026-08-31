import { jobQueueEventBus } from "../job-queue/event-bus";
import { logger } from "./logger";
import { track } from "./posthog";

const REACT_QUERY_PERSISTENCE_KEY = "__rq_pc__";

/**
 * Service Worker Manager for Background Sync
 * Provides reliable background sync capabilities using the Service Worker API
 */
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private readonly boundMessageHandler = this.handleMessage.bind(this);

  /**
   * Whether the current browser can register the Green Goods service worker.
   */
  canRegister(): boolean {
    return isServiceWorkerSupported();
  }

  /**
   * Attach an already-registered service worker to the background-sync manager.
   * Registration itself lives in `service-worker-registration.ts` so Storybook
   * can bundle the manager without bundling a `/sw.js` registration call.
   */
  attachRegistration(registration: ServiceWorkerRegistration): void {
    this.registration = registration;

    // Set up message handler for background sync notifications
    navigator.serviceWorker.removeEventListener("message", this.boundMessageHandler);
    navigator.serviceWorker.addEventListener("message", this.boundMessageHandler);
  }

  /**
   * Check if Background Sync is supported
   */
  isBackgroundSyncSupported(): boolean {
    return isBackgroundSyncSupported(this.registration);
  }

  /**
   * Register for background sync when jobs are added
   */
  async requestBackgroundSync(): Promise<boolean> {
    if (!this.isBackgroundSyncSupported()) {
      logger.warn("[ServiceWorker] Background Sync not available");
      return false;
    }

    try {
      const payload = {
        type: "REGISTER_SYNC",
      };

      const controller = navigator.serviceWorker.controller;
      if (controller) {
        controller.postMessage(payload);
      } else {
        const readyRegistration = this.registration ?? (await navigator.serviceWorker.ready);
        readyRegistration.active?.postMessage(payload);
      }

      track("background_sync_requested", {
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("[ServiceWorker] Failed to request background sync", { error });
      track("background_sync_request_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Handle messages from the service worker
   */
  private async handleMessage(event: MessageEvent) {
    if (event.data?.type === "BACKGROUND_SYNC") {
      const timestamp =
        typeof event.data?.payload?.timestamp === "number"
          ? event.data.payload.timestamp
          : Date.now();

      track("background_sync_triggered", {
        timestamp,
      });

      // Provider reacts to this event and triggers queue flush for passkey users.
      jobQueueEventBus.emit("background:sync-requested", {
        source: "service-worker",
        timestamp,
      });
    }
  }

  /**
   * Clear all SW caches and React Query persistence stores.
   * Used during sign-out to prevent stale data leaking across sessions.
   */
  async clearAllCaches(): Promise<void> {
    // Clear localStorage fallback used when IndexedDB persistence is unavailable.
    if (typeof window !== "undefined" && "localStorage" in window) {
      try {
        window.localStorage.removeItem(REACT_QUERY_PERSISTENCE_KEY);
      } catch (error) {
        logger.warn("[ServiceWorker] Failed to clear local query persistence", { error });
      }
    }

    // Clear Cache Storage (SW runtime caches)
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (error) {
        logger.warn("[ServiceWorker] Failed to clear caches", { error });
      }
    }

    // Clear React Query IndexedDB persistence store
    if ("indexedDB" in window) {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases
            .filter((db) => db.name?.includes("gg-react-query"))
            .map((db) => {
              return new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
            })
        );
      } catch (error) {
        logger.warn("[ServiceWorker] Failed to clear IndexedDB", { error });
      }
    }
  }

  /**
   * Get registration status info
   */
  getStatus() {
    return {
      isSupported: this.canRegister(),
      isRegistered: this.registration !== null,
      canBackgroundSync: this.isBackgroundSyncSupported(),
      scope: this.registration?.scope || null,
    };
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();

function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function isBackgroundSyncSupported(
  registration?: ServiceWorkerRegistration | null
): boolean {
  if (!isServiceWorkerSupported() || !registration) return false;
  return "sync" in registration;
}
