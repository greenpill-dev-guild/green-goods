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

function isJavaScriptAssetRequest(request) {
  try {
    const url = new URL(request.url);
    return (
      request.method === "GET" &&
      url.origin === self.location.origin &&
      url.pathname.startsWith("/assets/") &&
      url.pathname.endsWith(".js")
    );
  } catch {
    return false;
  }
}

function isJavaScriptResponse(response) {
  return response?.headers?.get("content-type")?.includes("javascript") === true;
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
    keys
      .filter((key) => STALE_RUNTIME_CACHES.includes(key))
      .map((key) => caches.delete(key))
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

async function fetchJavaScriptAsset(request) {
  const cached = await caches.match(request);
  if (isJavaScriptResponse(cached)) return cached;

  try {
    const response = await fetch(request, { cache: "reload" });
    if (isJavaScriptResponse(response)) return response;
  } catch {
    // Fall through to the reload shim below.
  }

  return new Response(
    'try{var k="gg-script-reload-attempt";if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");location.reload();}else{document.dispatchEvent(new CustomEvent("gg-module-load-failed"));}}catch(_){location.reload();}',
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/javascript; charset=utf-8",
      },
    }
  );
}

async function activateServiceWorker() {
  await claimClients();
  await Promise.all([clearStaleRuntimeCaches(), refreshPublicWebsiteClients()]);
}

// Activate new app workers immediately. The installed app can otherwise stay
// on an old cached shell that points at a deleted hashed entry bundle.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Public website navigations must never be fulfilled from an old app-shell cache.
self.addEventListener("fetch", (event) => {
  if (!isNavigationRequest(event.request) || !isPublicWebsiteUrl(event.request.url)) return;

  event.respondWith(fetchPublicNavigationFromNetwork(event.request));
  event.stopImmediatePropagation?.();
});

// If a stale shell requests an old JS asset and Vercel falls through to HTML,
// return a tiny JS shim that refreshes once instead of caching HTML as a script.
self.addEventListener("fetch", (event) => {
  if (!isJavaScriptAssetRequest(event.request)) return;

  event.respondWith(fetchJavaScriptAsset(event.request));
  event.stopImmediatePropagation?.();
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
        data: { url: "/home/profile", slug },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
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
