import { OFFLINE_MEDIA_BUDGET_BYTES } from "./policy";

/** The service worker's sized photo cache, shared by images and offline downloads. */
const MEDIA_CACHE = "ipfs-cache";
/** Photos the previous worker prepared; read through on demand until replaced. */
const LEGACY_PREPARED_MEDIA_CACHE = "gg-prepared-media-v1";
/** Workers older than this answer images themselves and cannot keep prepared photos. */
const MEDIA_WORKER_VERSION = 2;
const WORKER_REPLY_MS = 4_000;
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";
const KEPT_GATEWAY_HOSTS = new Set([
  "greengoods.mypinata.cloud",
  "gateway.pinata.cloud",
  "ipfs.io",
]);

export interface MediaStats {
  bytes: number;
  count: number;
}

/** Only gateway media passes through the worker's photo cache. */
export function isKeptMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      KEPT_GATEWAY_HOSTS.has(parsed.hostname) &&
      parsed.pathname.startsWith("/ipfs/")
    );
  } catch {
    return false;
  }
}

let workerVersion = 0;
const workerListeners = new Set<() => void>();

function publishWorkerVersion(version: number) {
  if (version === workerVersion) return;
  workerVersion = version;
  for (const listener of workerListeners) listener();
}

export function isMediaWorkerReady(): boolean {
  return workerVersion >= MEDIA_WORKER_VERSION;
}

export function subscribeMediaWorker(listener: () => void): () => void {
  workerListeners.add(listener);
  return () => {
    workerListeners.delete(listener);
  };
}

function askWorker<T>(message: Record<string, unknown>): Promise<T | undefined> {
  const worker = typeof navigator === "undefined" ? undefined : navigator.serviceWorker?.controller;
  if (!worker || typeof MessageChannel === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value?: T) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), WORKER_REPLY_MS);
    channel.port1.onmessage = (event) => finish(event.data as T);
    try {
      worker.postMessage(message, [channel.port2]);
    } catch {
      finish(undefined);
    }
  });
}

/** Tracks whether the controlling worker keeps photos. Never forces activation. */
export function monitorMediaWorker(): () => void {
  let generation = 0;
  const check = () => {
    const current = ++generation;
    void askWorker<{ offlineContentVersion?: number }>({
      type: "OFFLINE_CONTENT_CAPABILITIES",
    }).then((reply) => {
      if (current === generation) publishWorkerVersion(Number(reply?.offlineContentVersion) || 0);
    });
  };
  check();
  navigator.serviceWorker?.addEventListener("controllerchange", check);
  return () => {
    generation++;
    navigator.serviceWorker?.removeEventListener("controllerchange", check);
    publishWorkerVersion(0);
  };
}

export async function isMediaCached(url: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return Boolean(await caches.match(url, { cacheName: MEDIA_CACHE, ignoreVary: true }));
  } catch {
    return false;
  }
}

/**
 * Downloads a photo through the service worker, which keeps the copy, and
 * resolves with the bytes received.
 */
export async function downloadMedia(url: string, signal: AbortSignal): Promise<number> {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    signal,
    headers: { accept: IMAGE_ACCEPT },
    priority: "low",
  } as RequestInit);
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`);
  return (await response.blob()).size;
}

function readStats(reply: (MediaStats & { failed?: boolean }) | undefined) {
  return reply && !reply.failed ? { bytes: reply.bytes, count: reply.count } : undefined;
}

/** Asks the worker to remove the oldest photos outside `keep` above the budget. */
export async function sweepMedia(
  keep: string[],
  budgetBytes = OFFLINE_MEDIA_BUDGET_BYTES
): Promise<MediaStats | undefined> {
  return readStats(await askWorker({ type: "MEDIA_SWEEP", keep, budgetBytes }));
}

export async function readMediaStats(): Promise<MediaStats | undefined> {
  return readStats(await askWorker({ type: "MEDIA_STATS" }));
}

export async function retireLegacyPreparedMedia(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(LEGACY_PREPARED_MEDIA_CACHE);
  } catch {
    /* Unavailable storage keeps the old copies until the next completed run. */
  }
}
