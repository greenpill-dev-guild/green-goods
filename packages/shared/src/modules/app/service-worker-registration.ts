import { logger } from "./logger";
import { track } from "./posthog";
import { serviceWorkerManager } from "./service-worker";
import { isStandaloneMode } from "../../utils/app/pwa";

type ServiceWorkerEnv = Partial<
  Pick<ImportMetaEnv, "DEV" | "PROD" | "VITE_ENABLE_SW_DEV" | "VITE_APP_VERSION">
> &
  Record<string, unknown>;

const BROWSER_CACHE_BUST_STORAGE_KEY = "gg-browser-cache-bust-version";

function getVersion(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 48) : "";
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

async function clearServiceWorkersAndCaches(): Promise<void> {
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

async function clearDevelopmentServiceWorkers(): Promise<void> {
  await clearServiceWorkersAndCaches();
}

async function clearBrowserServiceWorkerForDeployment(version: string): Promise<boolean> {
  if (
    !version ||
    version === "dev" ||
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    isStandaloneMode()
  ) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!navigator.serviceWorker.controller && registrations.length === 0) return false;

    const storage = getSessionStorage();
    if (storage?.getItem(BROWSER_CACHE_BUST_STORAGE_KEY) === version) return false;
    storage?.setItem(BROWSER_CACHE_BUST_STORAGE_KEY, version);

    await clearServiceWorkersAndCaches();

    const url = new URL(window.location.href);
    url.searchParams.set("gg_cache_bust", version);
    window.location.replace(url.toString());
    return true;
  } catch (error) {
    logger.warn("[ServiceWorker] Browser cache bust failed", { error });
    return false;
  }
}

async function registerServiceWorker(version: string): Promise<boolean> {
  if (!serviceWorkerManager.canRegister()) {
    logger.warn("[ServiceWorker] Service Worker or Background Sync not supported");
    return false;
  }

  try {
    const scriptUrl =
      version && version !== "dev" ? `/sw.js?gg_v=${encodeURIComponent(version)}` : "/sw.js";
    const registration = await navigator.serviceWorker.register(scriptUrl, {
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

  const version = getVersion(env.VITE_APP_VERSION);
  const enableDevServiceWorker = env.VITE_ENABLE_SW_DEV === "true";
  const isStorybook = Boolean(env.STORYBOOK);
  if (isStorybook) return false;

  if (env.DEV && !enableDevServiceWorker) {
    await clearDevelopmentServiceWorkers();
    return false;
  }

  if (!env.PROD && !enableDevServiceWorker) return false;

  if (env.PROD && (await clearBrowserServiceWorkerForDeployment(version))) return false;

  return registerServiceWorker(version);
}
