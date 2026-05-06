const GREEN_GOODS_SYNC_TAG = "green-goods-sync";
const PUBLIC_WEBSITE_PATHS = new Set([
  "/",
  "/actions",
  "/cookies",
  "/fund",
  "/gardens",
  "/glossary",
  "/impact",
  "/landing",
]);
const PUBLIC_WEBSITE_PREFIXES = ["/gardens/"];
const STALE_RUNTIME_CACHES = ["js-cache", "indexer-cache", "graphql-cache"];

function normalizePathname(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isPublicWebsiteUrl(urlString) {
  try {
    const url = new URL(urlString);
    const pathname = normalizePathname(url.pathname);
    return (
      PUBLIC_WEBSITE_PATHS.has(pathname) ||
      PUBLIC_WEBSITE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    );
  } catch {
    return false;
  }
}

function isNavigationRequest(request) {
  if (request.method && request.method !== "GET") return false;

  const acceptsHtml =
    typeof request.headers?.get === "function" &&
    request.headers.get("accept")?.includes("text/html");

  return request.mode === "navigate" || request.destination === "document" || acceptsHtml;
}

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

async function clearStaleRuntimeCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => STALE_RUNTIME_CACHES.includes(key)).map((key) => caches.delete(key))
  );
}

async function claimClients() {
  if (typeof self.clients.claim === "function") {
    await self.clients.claim();
  }
}

async function refreshPublicWebsiteClients() {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await Promise.all(
    windowClients.map((client) => {
      if (!isPublicWebsiteUrl(client.url)) return Promise.resolve();

      if (typeof client.navigate === "function") {
        return client.navigate(client.url);
      }

      client.postMessage?.({ type: "PUBLIC_WEBSITE_CACHE_REFRESH" });
      return Promise.resolve();
    })
  );
}

async function fetchPublicNavigationFromNetwork(request) {
  try {
    return await fetch(request, { cache: "reload" });
  } catch {
    return (await caches.match(request)) || caches.match("/index.html") || Response.error();
  }
}

async function activateServiceWorker() {
  await claimClients();
  await Promise.all([clearStaleRuntimeCaches(), refreshPublicWebsiteClients()]);
}

// Public website navigations must never be fulfilled from an old app-shell cache.
self.addEventListener("fetch", (event) => {
  if (!isNavigationRequest(event.request) || !isPublicWebsiteUrl(event.request.url)) return;

  event.respondWith(fetchPublicNavigationFromNetwork(event.request));
  event.stopImmediatePropagation?.();
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

// Clear stale runtime caches and refresh public website tabs when a new worker activates.
self.addEventListener("activate", (event) => {
  event.waitUntil(activateServiceWorker());
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
