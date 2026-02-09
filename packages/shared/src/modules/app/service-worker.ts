// import { jobQueue } from "./job-queue";
import { jobQueueEventBus } from "../job-queue/event-bus";
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
   * Register the service worker and set up sync capabilities
   */
  async register(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn("Service Worker or Background Sync not supported");
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Set up message handler for background sync notifications
      navigator.serviceWorker.addEventListener("message", this.handleMessage.bind(this));
      navigator.serviceWorker.addEventListener("controllerchange", this.handleControllerChange);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      track("service_worker_registered", {
        scope: this.registration.scope,
        has_background_sync: this.isBackgroundSyncSupported(),
      });

      return true;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
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
      console.warn("Background Sync not available");
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
      console.error("Failed to request background sync:", error);
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

// Auto-register service worker only in production, or when explicitly enabled for tests
if (typeof window !== "undefined") {
  const enableDevServiceWorker = (import.meta as any).env?.VITE_ENABLE_SW_DEV === "true";

  if ((import.meta as any).env?.PROD || enableDevServiceWorker) {
    serviceWorkerManager.register();
  }

  // In development (and when not explicitly enabled), ensure no SW interferes with HMR
  if ((import.meta as any).env?.DEV && !enableDevServiceWorker && "serviceWorker" in navigator) {
    // Best-effort cleanup: unregister existing SWs and clear caches
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .catch((error) => {
        // Log but don't block - this is best-effort cleanup
        console.warn("[ServiceWorker] Failed to unregister existing workers:", error);
      });
    // Clear caches that could serve stale assets
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch((error) => {
          // Log but don't block - this is best-effort cleanup
          console.warn("[ServiceWorker] Failed to clear caches:", error);
        });
    }
  }
}
