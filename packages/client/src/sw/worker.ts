import {
  CONNECTIVITY_CHECK_PATH,
  GREEN_GOODS_SYNC_TAG,
} from "@green-goods/shared/modules/app/service-worker-protocol";
import { BackgroundWork } from "./background-work";
import { isMediaRequest, MediaCache } from "./media";
import { createMessageHandler } from "./messages";
import {
  fetchJavaScriptAsset,
  handleNotificationClick,
  isJavaScriptAssetRequest,
  notifyClients,
} from "./runtime";
import { isShareTargetRequest, receiveShareTarget } from "./share-target";
import { PwaShell } from "./shell";

/** Background Sync is not in the worker type library yet. */
interface SyncEventLike extends ExtendableEvent {
  readonly tag: string;
}

function isConnectivityProbe(request: Request): boolean {
  try {
    return new URL(request.url).pathname === CONNECTIVITY_CHECK_PATH;
  } catch {
    return false;
  }
}

/** Answer here and keep Workbox's router from seeing the request. */
function answer(event: FetchEvent, response: Promise<Response>): void {
  event.respondWith(response);
  event.stopImmediatePropagation();
}

/**
 * Wire the Green Goods behaviour into a worker scope: the installed shell,
 * the photo cache, the share target, the JS module shim, the connectivity
 * probe, and the page's message protocol. Register it before any Workbox
 * route so these listeners run first.
 */
export function installGreenGoodsWorker(scope: ServiceWorkerGlobalScope): void {
  const isDevWorker = new URL(scope.location.href).searchParams.has("dev-sw");
  const work = new BackgroundWork();
  const shell = new PwaShell(scope, isDevWorker);
  const media = new MediaCache(work);

  scope.addEventListener("install", (event) => event.waitUntil(shell.install()));
  // Activation is controlled by the app's update prompt, never forced here.
  scope.addEventListener("activate", (event) => event.waitUntil(shell.activate()));

  scope.addEventListener("fetch", (event) => {
    const { request } = event;
    if (isShareTargetRequest(request)) return answer(event, receiveShareTarget(scope, request));
    if (isJavaScriptAssetRequest(scope, request)) {
      return answer(
        event,
        fetchJavaScriptAsset(request, () => shell.currentCacheName())
      );
    }
    // Probes must prove a network round trip, including with an old app shell.
    if (isConnectivityProbe(request)) {
      return answer(event, fetch(new Request(request, { cache: "no-store" })));
    }
    if (isMediaRequest(request)) return answer(event, media.respond(event));
  });

  scope.addEventListener("message", createMessageHandler({ scope, shell, media, work }));
  scope.addEventListener("notificationclick", (event) => handleNotificationClick(scope, event));
  (scope as EventTarget).addEventListener("sync", (event) => {
    const sync = event as SyncEventLike;
    if (sync.tag !== GREEN_GOODS_SYNC_TAG) return;
    sync.waitUntil(notifyClients(scope, { tag: GREEN_GOODS_SYNC_TAG }));
  });
}
