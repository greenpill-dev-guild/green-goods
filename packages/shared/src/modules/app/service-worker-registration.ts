import { logger } from "./logger";
import { track } from "./posthog";
import { serviceWorkerManager } from "./service-worker";
import {
  type ServiceWorkerMessageType,
  SW_MESSAGE,
  type TailStatus,
} from "./service-worker-protocol";
import { isStandaloneMode } from "../../utils/app/pwa";

type ServiceWorkerEnv = Partial<
  Pick<ImportMetaEnv, "DEV" | "PROD" | "VITE_ENABLE_SW_DEV" | "VITE_APP_VERSION">
> &
  Record<string, unknown>;

export interface ServiceWorkerRegistrationConfig {
  scriptUrl?: string;
  scope?: string;
  legacyScopes?: string[];
  /** The dev server serves the worker as an ES module; production ships a classic script. */
  type?: WorkerType;
}

export interface ResolvedServiceWorkerRegistrationConfig {
  scriptUrl: string;
  options: RegistrationOptions;
  legacyScopes: string[];
}

const DEFAULT_SERVICE_WORKER_SCOPE = "/home/";
const LEGACY_SCOPE_CLEANUP_KEY = "gg-sw-legacy-scope-cleanup-v1";

/** The deferred shell tiers, in the order an installed app wants them. */
export type PwaShellTier = "priority" | "tail";

/** What the page learns about a tier it asked for; `undefined` until the worker answers. */
export type PwaShellTierStatus = TailStatus;

const TIER_MESSAGE: Record<PwaShellTier, ServiceWorkerMessageType> = {
  priority: SW_MESSAGE.PREPARE_PWA_PRIORITY,
  tail: SW_MESSAGE.PREPARE_PWA_TAIL,
};

const shellPreparationState = new WeakMap<
  ServiceWorker,
  Map<PwaShellTier, PwaShellTierStatus | "scheduled">
>();
type TierListener = (status: PwaShellTierStatus) => void;
const TIER_REPLY_TIMEOUT_MS = 15_000;
/**
 * Every request carries a reply port and the outcome is fanned out here, so a
 * listener that registers while a request is already in flight still hears it.
 * The alternative — remembering one callback per tier — silently dropped the
 * second caller, because the in-flight message had already been posted.
 */
const tierListeners = new Map<PwaShellTier, Set<TierListener>>();
/** The last answer for a tier, so a listener arriving after it settled is not left waiting. */
const tierOutcome = new Map<PwaShellTier, PwaShellTierStatus>();
const requestedTiers = new Set<PwaShellTier>();
let shellListenersStarted = false;

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
}

function networkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function tierState(worker: ServiceWorker): Map<PwaShellTier, PwaShellTierStatus | "scheduled"> {
  const existing = shellPreparationState.get(worker);
  if (existing) return existing;
  const created = new Map<PwaShellTier, PwaShellTierStatus | "scheduled">();
  shellPreparationState.set(worker, created);
  return created;
}

function readTierStatus(value: unknown): PwaShellTierStatus {
  const status = (value as { status?: unknown } | null)?.status;
  return typeof status === "string" ? (status as PwaShellTierStatus) : "failed";
}

function notifyTier(tier: PwaShellTier, status: PwaShellTierStatus): void {
  tierOutcome.set(tier, status);
  // Copied: a listener may unsubscribe itself while being told.
  for (const listener of [...(tierListeners.get(tier) ?? [])]) listener(status);
}

/** Ask the worker for one tier. The reply port is always attached, never conditional. */
function postTierRequest(worker: ServiceWorker, tier: PwaShellTier): void {
  const payload = { type: TIER_MESSAGE[tier] };
  const state = tierState(worker);
  let channel: MessageChannel | undefined;
  let replyTimeout: number | undefined;
  try {
    channel = new MessageChannel();
    const replyChannel = channel;
    replyTimeout = window.setTimeout(() => {
      replyChannel.port1.close();
      state.set(tier, "failed");
      notifyTier(tier, "failed");
    }, TIER_REPLY_TIMEOUT_MS);
    replyChannel.port1.onmessage = (event: MessageEvent) => {
      window.clearTimeout(replyTimeout);
      replyChannel.port1.close();
      const status = readTierStatus(event.data);
      state.set(tier, status);
      notifyTier(tier, status);
    };
    worker.postMessage(payload, [replyChannel.port2]);
  } catch (error) {
    if (replyTimeout !== undefined) window.clearTimeout(replyTimeout);
    channel?.port1.close();
    logger.warn("[ServiceWorker] Shell tier reply port unavailable", { tier, error });
    state.set(tier, "failed");
    notifyTier(tier, "failed");
    try {
      worker.postMessage(payload);
    } catch (fallbackError) {
      logger.warn("[ServiceWorker] Shell tier request failed", { tier, error: fallbackError });
    }
  }
}

function requestTier(tier: PwaShellTier): void {
  const worker = navigator.serviceWorker.controller;
  if (!worker) return;
  const state = tierState(worker);
  const pause = () => {
    worker.postMessage({ type: SW_MESSAGE.PAUSE_PWA_TAIL });
    state.set(tier, "paused");
    notifyTier(tier, "paused");
  };
  if (networkInformation()?.saveData) {
    pause();
    return;
  }
  if (["scheduled", "ready"].includes(state.get(tier) ?? "")) return;
  state.set(tier, "scheduled");
  const run = () => {
    if (networkInformation()?.saveData) {
      pause();
      return;
    }
    postTierRequest(worker, tier);
  };
  // The offline-ready tier is the difference between an installed app that can
  // take a photo with no signal and one that cannot, so it does not wait for an
  // idle moment. The send-time tail still yields to the page first.
  if (tier === "priority") run();
  else if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 5_000 });
  else window.setTimeout(run, 0);
}

function scheduleRequestedTiers(): void {
  // A new controller re-runs the work, so its predecessor's verdict is stale.
  tierOutcome.clear();
  for (const tier of requestedTiers) requestTier(tier);
}

/**
 * Ask the active worker to finish a deferred shell tier. Data Saver pauses the
 * work until the browser reports a change, and a new controller re-asks, so a
 * tier requested once keeps trying across reconnects and worker updates.
 *
 * Returns an unsubscribe for `onStatus`; callers with a lifecycle should use it.
 */
export function schedulePwaShellPreparation(
  tier: PwaShellTier,
  onStatus?: TierListener
): () => void {
  if (typeof window === "undefined") return () => {};
  if (onStatus) {
    const listeners = tierListeners.get(tier) ?? new Set<TierListener>();
    tierListeners.set(tier, listeners);
    listeners.add(onStatus);
    // The worker runs one download per tier, so a tier that already answered
    // will not answer again; replay it rather than leave this listener waiting.
    const settled = tierOutcome.get(tier);
    if (settled) onStatus(settled);
  }
  requestedTiers.add(tier);
  if (!shellListenersStarted) {
    shellListenersStarted = true;
    networkInformation()?.addEventListener("change", scheduleRequestedTiers);
    window.addEventListener("online", scheduleRequestedTiers);
    navigator.serviceWorker.addEventListener("controllerchange", scheduleRequestedTiers);
  }
  requestTier(tier);
  return () => {
    if (onStatus) tierListeners.get(tier)?.delete(onStatus);
  };
}

/**
 * The current worker's last answer for a tier, without asking for it. A new
 * controller clears every answer, so a reader never trusts a previous worker's
 * files. `undefined` means this worker has not answered yet.
 */
export function currentPwaShellTierStatus(tier: PwaShellTier): PwaShellTierStatus | undefined {
  return tierOutcome.get(tier);
}

/**
 * Hear a tier's outcome without asking for it. For readers that only need to
 * know whether the offline-ready files are on the device, such as the HEIC
 * decoder: only an installed app or an install should start that download.
 */
export function observePwaShellTier(tier: PwaShellTier, onStatus: TierListener): () => void {
  const listeners = tierListeners.get(tier) ?? new Set<TierListener>();
  tierListeners.set(tier, listeners);
  listeners.add(onStatus);
  const settled = tierOutcome.get(tier);
  if (settled) onStatus(settled);
  return () => listeners.delete(onStatus);
}

/** Lets the active worker finish the send-time tail after the page has yielded. */
export function schedulePwaTailPreparation(): void {
  schedulePwaShellPreparation("tail");
}

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
      ...(config.type ? { type: config.type } : {}),
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
    // An app already on the home screen asks for the offline-ready tier every
    // launch: `appinstalled` fires once, and only for the install that happens
    // in this tab, so it cannot reach anyone who installed on an older build.
    if (isStandaloneMode()) schedulePwaShellPreparation("priority");
    schedulePwaTailPreparation();

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
