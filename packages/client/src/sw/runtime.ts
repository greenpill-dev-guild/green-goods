/// <reference lib="webworker" />
import {
  type BackgroundSyncNotice,
  GREEN_GOODS_SYNC_TAG,
  SW_CACHES,
  SW_REPLY,
} from "@green-goods/shared/modules/app/service-worker-protocol";

interface SyncManagerLike {
  register(tag: string): Promise<void>;
}

/** Background Sync is not in the worker type library yet. */
function syncManager(scope: ServiceWorkerGlobalScope): SyncManagerLike | undefined {
  return (scope.registration as ServiceWorkerRegistration & { sync?: SyncManagerLike }).sync;
}

export function isJavaScriptAssetRequest(
  scope: ServiceWorkerGlobalScope,
  request: Request
): boolean {
  try {
    const url = new URL(request.url);
    return (
      request.method === "GET" &&
      url.origin === scope.location.origin &&
      url.pathname.startsWith("/assets/") &&
      url.pathname.endsWith(".js")
    );
  } catch {
    return false;
  }
}

function isJavaScriptResponse(response: Response | undefined): response is Response {
  return response?.headers.get("content-type")?.includes("javascript") === true;
}

/**
 * A stale shell can ask for a module the host no longer serves, and the host
 * then falls through to HTML. Answer with a tiny script that fails the import
 * cleanly instead of caching HTML as a module.
 */
export async function fetchJavaScriptAsset(
  request: Request,
  currentCacheName: () => Promise<string | null>
): Promise<Response> {
  const cached = await caches.match(request);
  if (isJavaScriptResponse(cached)) return cached;
  try {
    const response = await fetch(request, { cache: "reload" });
    if (isJavaScriptResponse(response)) {
      const cache = await caches.open((await currentCacheName()) ?? SW_CACHES.JS_RUNTIME);
      await cache.put(request, response.clone());
      return response;
    }
  } catch {
    // Fall through to the explicit module error below.
  }
  return new Response('throw new Error("Failed to fetch dynamically imported module");', {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript; charset=utf-8",
    },
  });
}

export async function notifyClients(
  scope: ServiceWorkerGlobalScope,
  payload: Omit<BackgroundSyncNotice["payload"], "timestamp">
): Promise<void> {
  const windows = await scope.clients.matchAll({ type: "window", includeUncontrolled: true });
  const notice: BackgroundSyncNotice = {
    type: SW_REPLY.BACKGROUND_SYNC,
    payload: { ...payload, timestamp: Date.now() },
  };
  for (const client of windows) client.postMessage(notice);
}

/** Ask the browser for a sync event; browsers without Background Sync get told to flush now. */
export async function registerBackgroundSync(scope: ServiceWorkerGlobalScope): Promise<void> {
  const sync = syncManager(scope);
  if (!sync) {
    await notifyClients(scope, { tag: GREEN_GOODS_SYNC_TAG, fallback: true });
    return;
  }
  try {
    await sync.register(GREEN_GOODS_SYNC_TAG);
  } catch {
    await notifyClients(scope, { tag: GREEN_GOODS_SYNC_TAG, fallback: true });
  }
}

export function handleNotificationClick(
  scope: ServiceWorkerGlobalScope,
  event: NotificationEvent
): void {
  event.notification.close();
  const url = String((event.notification.data as { url?: string } | undefined)?.url || "/home");
  event.waitUntil(
    scope.clients.matchAll({ type: "window" }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return scope.clients.openWindow(url);
    })
  );
}
