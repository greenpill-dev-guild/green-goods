/// <reference lib="webworker" />
import { SW_CACHES } from "@green-goods/shared/modules/app/service-worker-protocol";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { installGreenGoodsWorker } from "./worker";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
  __WB_DISABLE_DEV_LOGS?: boolean;
};

const RPC_QUEUE = { name: "rpc-queue", options: { maxRetentionTime: 24 * 60 } };

self.__WB_DISABLE_DEV_LOGS = true;

// Green Goods answers first: the share target, JS modules, the connectivity
// probe and gateway photos never reach Workbox's router.
const greenGoods = installGreenGoodsWorker(self);

// The precached entry document and stylesheet, plus the navigation fallback.
// The worker is scoped to /home, so public pages never see this fallback.
// It never claims open pages or skips waiting: the update prompt asks first.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Avatars and app images. Gateway media is answered above from its own cache.
// Both routes below wait on the network, so a stalled update hand-over counts
// their open responses along with the worker's own.
const images = new CacheFirst({
  cacheName: SW_CACHES.IMAGES,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 30 * 24 * 60 * 60,
      purgeOnQuotaError: true,
    }),
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});
registerRoute(
  ({ request, url, sameOrigin }) =>
    request.destination === "image" && (url.protocol === "https:" || sameOrigin),
  (options) => greenGoods.answering("image", images.handle(options))
);

// GraphQL reads use POST. Cache Storage cannot safely cache those by URL;
// TanStack Query's persisted reads own offline data. Critical POSTs retry
// through Background Sync instead.
const profileWrites = new NetworkOnly({
  plugins: [new BackgroundSyncPlugin("gg-api-queue", { maxRetentionTime: 24 * 60 })],
});
registerRoute(
  /\/users\/me$/,
  (options) => greenGoods.answering("api", profileWrites.handle(options)),
  "POST"
);

if (import.meta.env.VITE_ENABLE_RPC_BG_SYNC === "true") {
  const rpcSync = () =>
    new NetworkOnly({ plugins: [new BackgroundSyncPlugin(RPC_QUEUE.name, RPC_QUEUE.options)] });
  registerRoute(/https:\/\/api\.pimlico\.xyz\/.*\/rpc$/, rpcSync(), "POST");
  registerRoute(/https:\/\/(\w+\.)?alchemyapi\.io\/v2\/.*/, rpcSync(), "POST");
}
