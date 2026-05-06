const GREEN_GOODS_SYNC_TAG = "green-goods-sync";
const NAVIGATION_FALLBACK_URL = "/index.html";

async function getNavigationResponse(request) {
  try {
    return await fetch(new Request(request, { cache: "reload" }));
  } catch {
    const fallback = await caches.match(NAVIGATION_FALLBACK_URL);
    if (fallback) return fallback;
    throw new Error("navigation-network-and-cache-miss");
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(getNavigationResponse(event.request));
});

async function notifyClients(payload) {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  windowClients.forEach((client) => {
    client.postMessage({
      type: "BACKGROUND_SYNC",
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    });
  });
}

// Clear stale runtime caches on activation to prevent serving old JS/data after update
self.addEventListener("activate", (event) => {
  const STALE_CACHES = ["js-cache", "indexer-cache", "graphql-cache"];
  const STALE_CACHE_PREFIXES = ["workbox-precache"];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              STALE_CACHES.includes(key) ||
              STALE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
          )
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (type === "REGISTER_SYNC") {
    event.waitUntil(
      (async () => {
        if (!self.registration?.sync) {
          await notifyClients({ tag: GREEN_GOODS_SYNC_TAG, fallback: true });
          return;
        }

        try {
          await self.registration.sync.register(GREEN_GOODS_SYNC_TAG);
        } catch {
          await notifyClients({ tag: GREEN_GOODS_SYNC_TAG, fallback: true });
        }
      })()
    );
  }

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (type === "ENS_REGISTRATION_COMPLETE") {
    const slug = event.data?.slug ?? "";
    event.waitUntil(
      self.registration.showNotification("ENS Name Active", {
        body: `Your name ${slug}.greengoods.eth is now active!`,
        icon: "/icon-192.png",
        badge: "/images/android-icon-72x72.png",
        tag: `ens-complete-${slug}`,
        data: { url: "/profile", slug },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== GREEN_GOODS_SYNC_TAG) {
    return;
  }

  event.waitUntil(notifyClients({ tag: GREEN_GOODS_SYNC_TAG }));
});
