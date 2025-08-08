import { jobQueue } from "./job-queue";
import { track } from "./posthog";

/**
 * Service Worker Manager for Background Sync
 * Provides reliable background sync capabilities using the Service Worker API
 */
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = false;

  constructor() {
    this.isSupported =
      "serviceWorker" in navigator &&
      "ServiceWorkerRegistration" in window &&
      // @ts-ignore - prototype check for Background Sync support in browsers that implement it
      "sync" in (window.ServiceWorkerRegistration.prototype as any);
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
      // Send message to service worker to register sync
      navigator.serviceWorker.controller?.postMessage({
        type: "REGISTER_SYNC",
      });

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
      console.log("Background sync triggered by service worker");

      track("background_sync_triggered", {
        timestamp: event.data.payload.timestamp,
      });

      // Trigger job queue sync
      try {
        const result = await jobQueue.flush();

        track("background_sync_completed", {
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped,
        });
      } catch (error) {
        console.error("Background sync failed:", error);

        track("background_sync_failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
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

// Auto-register service worker
if (typeof window !== "undefined") {
  serviceWorkerManager.register().then((success) => {
    if (success) {
      console.log("Service Worker registered successfully");
    }
  });
}
