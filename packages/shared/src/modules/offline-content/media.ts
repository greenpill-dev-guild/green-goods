import {
  type MediaStatsReply,
  OFFLINE_CONTENT_VERSION,
  type OfflineContentCapabilitiesReply,
  type ServiceWorkerMessage,
  SW_CACHES,
  SW_MESSAGE,
} from "../app/service-worker-protocol";
import { OFFLINE_MEDIA_BUDGET_BYTES } from "./policy";

export { isKeptMediaUrl } from "../app/service-worker-protocol";

/** The service worker's sized photo cache, shared by images and offline downloads. */
const MEDIA_CACHE = SW_CACHES.MEDIA;
/** Photos the previous worker prepared; read through on demand until replaced. */
const LEGACY_PREPARED_MEDIA_CACHE = SW_CACHES.LEGACY_PREPARED_MEDIA;
/** Workers older than the one this build ships cannot keep prepared photos. */
const MEDIA_WORKER_VERSION = OFFLINE_CONTENT_VERSION;
const WORKER_REPLY_MS = 4_000;
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";

export type MediaStats = Pick<MediaStatsReply, "bytes" | "count">;

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

function askWorker<T>(message: ServiceWorkerMessage): Promise<T | undefined> {
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
    void askWorker<Partial<OfflineContentCapabilitiesReply>>({
      type: SW_MESSAGE.OFFLINE_CONTENT_CAPABILITIES,
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
  const bytes = (await response.blob()).size;
  // The worker answers the request before Cache Storage finishes writing. A
  // completed preparation task must mean the copy is durable, so wait for the
  // exact cache entry rather than counting bytes from the network response.
  for (let attempt = 0; attempt < 40; attempt++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (await isMediaCached(url)) return bytes;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  const error = new Error("Photo was received but could not be saved for offline use");
  error.name = "OfflineMediaStoreError";
  throw error;
}

function readStats(reply: MediaStatsReply | undefined) {
  return reply && !reply.failed ? { bytes: reply.bytes, count: reply.count } : undefined;
}

/** Asks the worker to remove the oldest photos outside `keep` above the budget. */
export async function sweepMedia(
  keep: string[],
  budgetBytes = OFFLINE_MEDIA_BUDGET_BYTES
): Promise<MediaStats | undefined> {
  return readStats(await askWorker({ type: SW_MESSAGE.MEDIA_SWEEP, keep, budgetBytes }));
}

/** Updates admission protection before photo downloads begin. */
export async function protectMedia(
  keep: string[],
  budgetBytes = OFFLINE_MEDIA_BUDGET_BYTES
): Promise<boolean> {
  const reply = await askWorker<{ ready?: boolean; failed?: boolean }>({
    type: SW_MESSAGE.MEDIA_POLICY,
    keep,
    budgetBytes,
  });
  return Boolean(reply?.ready && !reply.failed);
}

export async function readMediaStats(): Promise<MediaStats | undefined> {
  return readStats(await askWorker({ type: SW_MESSAGE.MEDIA_STATS }));
}

export async function retireLegacyPreparedMedia(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(LEGACY_PREPARED_MEDIA_CACHE);
  } catch {
    /* Unavailable storage keeps the old copies until the next completed run. */
  }
}
