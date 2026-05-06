import { logger } from "./logger";
import { track } from "./posthog";
import { serviceWorkerManager } from "./service-worker";

type ServiceWorkerEnv = Partial<Pick<ImportMetaEnv, "DEV" | "PROD" | "VITE_ENABLE_SW_DEV">> &
  Record<string, unknown>;

async function clearDevelopmentServiceWorkers(): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      logger.warn("[ServiceWorker] Failed to unregister existing workers", { error });
    }
  }

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (error) {
      logger.warn("[ServiceWorker] Failed to clear caches", { error });
    }
  }
}

async function registerServiceWorker(): Promise<boolean> {
  if (!serviceWorkerManager.canRegister()) {
    logger.warn("[ServiceWorker] Service Worker or Background Sync not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    serviceWorkerManager.attachRegistration(registration);
    void registration.update().catch((error) => {
      logger.warn("[ServiceWorker] Update check failed", { error });
    });
    await navigator.serviceWorker.ready;

    track("service_worker_registered", {
      scope: registration.scope,
      has_background_sync: serviceWorkerManager.isBackgroundSyncSupported(),
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

export async function registerServiceWorkerFromEnv(
  env: ServiceWorkerEnv = import.meta.env
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const enableDevServiceWorker = env.VITE_ENABLE_SW_DEV === "true";
  const isStorybook = Boolean(env.STORYBOOK);
  if (isStorybook) return false;

  if (env.DEV && !enableDevServiceWorker) {
    await clearDevelopmentServiceWorkers();
    return false;
  }

  if (!env.PROD && !enableDevServiceWorker) return false;

  return registerServiceWorker();
}
