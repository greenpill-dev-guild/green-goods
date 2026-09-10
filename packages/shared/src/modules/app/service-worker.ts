import { clearObsoleteRuntimeCaches } from "./cache-recovery";
import { jobQueueEventBus } from "../job-queue/event-bus";
import { logger } from "./logger";
import { track } from "./posthog";

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

  /** Remove retired runtime caches while preserving shell assets and local evidence. */
  async clearAllCaches(): Promise<void> {
    await clearObsoleteRuntimeCaches();
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
