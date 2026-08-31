import { logger } from "./logger";
import { track } from "./posthog";
import { serviceWorkerManager } from "./service-worker";

type ServiceWorkerEnv = Partial<
  Pick<ImportMetaEnv, "DEV" | "PROD" | "VITE_ENABLE_SW_DEV" | "VITE_APP_VERSION">
> &
  Record<string, unknown>;

export interface ServiceWorkerRegistrationConfig {
  scriptUrl?: string;
  scope?: string;
  legacyScopes?: string[];
}

export interface ResolvedServiceWorkerRegistrationConfig {
  scriptUrl: string;
  options: RegistrationOptions;
  legacyScopes: string[];
}

const DEFAULT_SERVICE_WORKER_SCOPE = "/home/";
const LEGACY_SCOPE_CLEANUP_KEY = "gg-sw-legacy-scope-cleanup-v1";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function normalizeScopePath(value: string): string {
  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://greengoods.local";
    const pathname = trimTrailingSlashes(new URL(value, base).pathname);
    return pathname || "/";
  } catch {
    const pathname = trimTrailingSlashes(value);
    return pathname || "/";
  }
}

export function createServiceWorkerRegistrationConfig(
  _version: string,
  config: ServiceWorkerRegistrationConfig = {}
): ResolvedServiceWorkerRegistrationConfig {
  return {
    scriptUrl: config.scriptUrl ?? "/sw.js",
    options: {
      scope: config.scope ?? DEFAULT_SERVICE_WORKER_SCOPE,
      updateViaCache: "none",
    },
    legacyScopes: config.legacyScopes ?? [],
  };
}

export function isLegacyServiceWorkerRegistration(
  registrationScope: string,
  currentScope: string,
  legacyScopes: string[]
): boolean {
  const registrationPath = normalizeScopePath(registrationScope);
  const currentPath = normalizeScopePath(currentScope);
  const legacyPaths = legacyScopes.map(normalizeScopePath);

  return registrationPath !== currentPath && legacyPaths.includes(registrationPath);
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

  await clearBrowserCaches();
}

async function clearBrowserCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    logger.warn("[ServiceWorker] Failed to clear caches", { error });
  }
}

async function clearDevelopmentServiceWorkers(): Promise<void> {
  await clearServiceWorkersAndCaches();
}

async function clearLegacyServiceWorkers(
  config: ResolvedServiceWorkerRegistrationConfig
): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (config.legacyScopes.length === 0) return;

  try {
    if (window.localStorage.getItem(LEGACY_SCOPE_CLEANUP_KEY) === "complete") return;
  } catch {
    // Storage can be unavailable in private browsing; the cleanup is still safe and bounded.
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) =>
          isLegacyServiceWorkerRegistration(
            registration.scope,
            config.options.scope ?? DEFAULT_SERVICE_WORKER_SCOPE,
            config.legacyScopes
          )
        )
        .map((registration) => registration.unregister())
    );
    try {
      window.localStorage.setItem(LEGACY_SCOPE_CLEANUP_KEY, "complete");
    } catch {
      // A successful unregister does not depend on remembering the cleanup.
    }
  } catch (error) {
    logger.warn("[ServiceWorker] Failed to unregister legacy workers", { error });
  }
}

async function registerServiceWorker(
  version: string,
  registrationConfig: ServiceWorkerRegistrationConfig = {}
): Promise<boolean> {
  const config = createServiceWorkerRegistrationConfig(version, registrationConfig);
  await clearLegacyServiceWorkers(config);

  if (!serviceWorkerManager.canRegister()) {
    logger.warn("[ServiceWorker] Service Worker not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register(config.scriptUrl, config.options);

    serviceWorkerManager.attachRegistration(registration);
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
  env: ServiceWorkerEnv = import.meta.env,
  registrationConfig: ServiceWorkerRegistrationConfig = {}
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

  return registerServiceWorker("", registrationConfig);
}
