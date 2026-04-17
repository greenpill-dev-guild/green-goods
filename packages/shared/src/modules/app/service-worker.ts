import { jobQueueEventBus } from "../job-queue/event-bus";
import { logger } from "./logger";
import { track } from "./posthog";

/**
 * Service Worker Manager for Background Sync
 * Provides reliable background sync capabilities using the Service Worker API
 */
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = false;
  private hasController = false;
  private hasReloadedForUpdate = false;
  private readonly boundMessageHandler = this.handleMessage.bind(this);

  constructor() {
    const hasNavigator = typeof navigator !== "undefined";
    const hasWindow = typeof window !== "undefined";

    this.isSupported =
      hasNavigator &&
      hasWindow &&
      "serviceWorker" in navigator &&
      "ServiceWorkerRegistration" in window &&
      // @ts-ignore - prototype check for Background Sync support in browsers that implement it
      "sync" in (window.ServiceWorkerRegistration.prototype as any);

    this.hasController =
      hasNavigator && "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;
  }

  /**
   * Attach to the active service worker registration (registered by VitePWA)
   * and set up message + controllerchange listeners for background sync.
   */
  async register(): Promise<boolean> {
    if (!this.isSupported) {
      logger.warn("[ServiceWorker] Service Worker or Background Sync not supported");
      return false;
    }

    try {
      // VitePWA owns the actual navigator.serviceWorker.register() call.
      // Wait for its registration to be active before attaching listeners.
      this.registration = await navigator.serviceWorker.ready;

      // Set up message handler for background sync notifications
      navigator.serviceWorker.removeEventListener("message", this.boundMessageHandler);
      navigator.serviceWorker.removeEventListener("controllerchange", this.handleControllerChange);
      navigator.serviceWorker.addEventListener("message", this.boundMessageHandler);
      navigator.serviceWorker.addEventListener("controllerchange", this.handleControllerChange);

      track("service_worker_registered", {
        scope: this.registration.scope,
        has_background_sync: this.isBackgroundSyncSupported(),
      });

      return true;
    } catch (error) {
      logger.error("[ServiceWorker] Service Worker registration failed", { error });
      track("service_worker_registration_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Reload the page once a new service worker takes control
   */
  private handleControllerChange = () => {
    // Avoid reloading on the very first install when there was no controller
    if (!this.hasController) {
      this.hasController = true;
      return;
    }

    if (this.hasReloadedForUpdate) {
      return;
    }

    this.hasReloadedForUpdate = true;
    window.location.reload();
  };

  /**
   * Check if Background Sync is supported
   */
  isBackgroundSyncSupported(): boolean {
    return this.isSupported && this.registration !== null;
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
   * Clear all SW caches and the React Query IndexedDB store.
   * Used during sign-out to prevent stale data leaking across sessions.
   */
  async clearAllCaches(): Promise<void> {
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
      isSupported: this.isSupported,
      isRegistered: this.registration !== null,
      canBackgroundSync: this.isBackgroundSyncSupported(),
      scope: this.registration?.scope || null,
    };
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();
