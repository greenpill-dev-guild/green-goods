const GREEN_GOODS_SYNC_TAG = "green-goods-sync";
const STALE_RUNTIME_CACHES = ["js-cache", "indexer-cache", "graphql-cache"];
const PWA_SHELL_CACHE_PREFIX = "gg-pwa-shell-";
const PWA_SHELL_META_CACHE = "gg-pwa-shell-meta";
const PWA_SHELL_META_URL = "/__gg_pwa_shell_current__";
const PWA_SHELL_MANIFEST_URL = "/pwa-shell-assets.json";
const SHARE_TARGET_PATH = "/home/share";
const SHARE_INBOX_CACHE = "gg-share-inbox-v1";
const SHARE_ENVELOPE_PREFIX = "/__gg_share_envelope__/";
const SHARE_FILE_PREFIX = "/__gg_share_file__/";
const SHARE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const SHARE_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SHARE_MAX_FILES = 5;
const SHARE_MAX_FILE_BYTES = 20 * 1024 * 1024;
const SHARE_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const SHARE_EXTENSION_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
]);

function normalizePathname(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

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

function isShareTargetRequest(request) {
  if (request.method !== "POST") return false;
  try {
    return new URL(request.url).pathname === SHARE_TARGET_PATH;
  } catch {
    return false;
  }
}

async function readShellManifest() {
  const response = await fetch(PWA_SHELL_MANIFEST_URL, { cache: "reload" });
  if (!response.ok) throw new Error("PWA shell manifest unavailable");
  const manifest = await response.json();
  if (
    manifest?.version !== 1 ||
    typeof manifest.digest !== "string" ||
    !/^[a-f0-9]{16}$/.test(manifest.digest) ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.some(
      (asset) =>
        typeof asset !== "string" || !asset.startsWith("/") || asset.startsWith("//")
    )
  ) {
    throw new Error("PWA shell manifest is invalid");
  }
  return manifest;
}

async function sha256Hex(value) {
  if (!self.crypto?.subtle) throw new Error("PWA shell integrity verification is unavailable");
  const digest = await self.crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createShellDigest(assets, contentDigests) {
  const digestInput = assets
    .map((asset, index) => `${asset}\0${contentDigests[index]}`)
    .join("\n");
  return (await sha256Hex(new TextEncoder().encode(digestInput))).slice(0, 16);
}

function hasExpectedShellContentType(asset, response) {
  if (!response?.ok) return false;
  const pathname = new URL(asset, self.location.origin).pathname.toLowerCase();
  const contentType = response.headers?.get("content-type")?.toLowerCase() ?? "";
  if (pathname.endsWith(".js") || pathname.endsWith(".mjs")) {
    return contentType.includes("javascript");
  }
  if (pathname.endsWith(".css")) return contentType.includes("text/css");
  if (pathname.endsWith(".html")) return contentType.includes("text/html");
  return true;
}

async function cacheShellAsset(shellCache, asset) {
  const assetUrl = new URL(asset, self.location.origin);
  if (assetUrl.origin !== self.location.origin) {
    throw new Error(`PWA shell asset is cross-origin: ${asset}`);
  }
  const response = await fetch(asset, { cache: "reload" });
  if (!hasExpectedShellContentType(asset, response)) {
    throw new Error(`PWA shell asset has invalid content type: ${asset}`);
  }
  const contentDigest = await sha256Hex(await response.clone().arrayBuffer());
  await shellCache.put(asset, response);
  return contentDigest;
}

async function populatePwaShell() {
  const manifest = await readShellManifest();
  const cacheName = `${PWA_SHELL_CACHE_PREFIX}${manifest.digest}`;
  const currentCacheName = await getCurrentShellCacheName();
  if (cacheName === currentCacheName) return;

  try {
    // The digest is content-addressed, so this can only be an abandoned partial
    // staging cache from an earlier failed attempt.
    await caches.delete(cacheName);
    const shellCache = await caches.open(cacheName);
    const contentDigests = [];
    for (const asset of manifest.assets) {
      contentDigests.push(await cacheShellAsset(shellCache, asset));
    }
    const installedDigest = await createShellDigest(manifest.assets, contentDigests);
    if (installedDigest !== manifest.digest) {
      throw new Error(
        `PWA shell digest mismatch: expected ${manifest.digest}, received ${installedDigest}`
      );
    }
    const metaCache = await caches.open(PWA_SHELL_META_CACHE);
    await metaCache.put(
      PWA_SHELL_META_URL,
      new Response(JSON.stringify({ cacheName, digest: manifest.digest }), {
        headers: { "content-type": "application/json" },
      })
    );
  } catch (error) {
    if (cacheName !== currentCacheName) await caches.delete(cacheName);
    throw error;
  }
}

async function getCurrentShellCacheName() {
  try {
    const response = await caches.match(PWA_SHELL_META_URL);
    const metadata = await response?.json();
    return typeof metadata?.cacheName === "string" ? metadata.cacheName : null;
  } catch {
    return null;
  }
}

async function clearOldPwaShellCaches() {
  const currentCacheName = await getCurrentShellCacheName();
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(
        (key) => key.startsWith(PWA_SHELL_CACHE_PREFIX) && key !== currentCacheName
      )
      .map((key) => caches.delete(key))
  );
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
    if (isJavaScriptResponse(response)) {
      const cacheName = (await getCurrentShellCacheName()) ?? "gg-js-runtime";
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      return response;
    }
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
  await clearStaleRuntimeCaches();
  await clearOldPwaShellCaches();
}

function shareErrorRedirect(reason) {
  return new Response(null, {
    status: 303,
    headers: { location: `/home/garden?shareTargetError=${encodeURIComponent(reason)}` },
  });
}

function parseSharedUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length > 2048) throw new Error("url-too-long");
  const parsed = new URL(text);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url-invalid");
  }
  return parsed.toString();
}

function normalizeSharedImageType(file) {
  const suppliedType = String(file.type || "").toLowerCase();
  if (SHARE_ALLOWED_TYPES.has(suppliedType)) return suppliedType;
  if (suppliedType && suppliedType !== "application/octet-stream") return null;

  const name = String(file.name || "").toLowerCase();
  const extension = [...SHARE_EXTENSION_TYPES.keys()].find((candidate) =>
    name.endsWith(candidate)
  );
  return extension ? SHARE_EXTENSION_TYPES.get(extension) : null;
}

async function cleanupExpiredShareEnvelopes(cache) {
  const now = Date.now();
  const requests = await cache.keys();
  for (const request of requests) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(SHARE_ENVELOPE_PREFIX)) continue;
    try {
      const envelope = await (await cache.match(request)).json();
      if (Number(envelope?.expiresAt) > now) continue;
      await cache.delete(request);
      await Promise.all(
        (envelope?.files ?? []).map((file) => cache.delete(file.cacheKey))
      );
    } catch {
      await cache.delete(request);
    }
  }
}

async function receiveShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    const sharedUrl = parseSharedUrl(formData.get("url"));
    if (title.length > 300 || text.length > 10_000) throw new Error("text-too-long");

    const files = formData.getAll("images").filter((value) => value instanceof File);
    if (files.length > SHARE_MAX_FILES) throw new Error("too-many-files");
    let totalBytes = 0;
    const normalizedFiles = [];
    for (const file of files) {
      totalBytes += file.size;
      const type = normalizeSharedImageType(file);
      if (!type || file.size > SHARE_MAX_FILE_BYTES) {
        throw new Error("file-invalid");
      }
      normalizedFiles.push({ file, type });
    }
    if (totalBytes > SHARE_MAX_TOTAL_BYTES) throw new Error("share-too-large");
    if (!title && !text && !sharedUrl && normalizedFiles.length === 0) {
      throw new Error("share-empty");
    }

    const token = self.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cache = await caches.open(SHARE_INBOX_CACHE);
    await cleanupExpiredShareEnvelopes(cache);
    const storedFiles = [];
    const writtenKeys = [];

    try {
      for (let index = 0; index < normalizedFiles.length; index += 1) {
        const { file, type } = normalizedFiles[index];
        const cacheKey = `${SHARE_FILE_PREFIX}${token}/${index}`;
        await cache.put(
          cacheKey,
          new Response(file, {
            headers: {
              "content-type": type,
              "x-gg-file-name": encodeURIComponent(file.name || `shared-${index}`),
            },
          })
        );
        writtenKeys.push(cacheKey);
        storedFiles.push({ cacheKey, name: file.name, type, size: file.size });
      }

      const now = Date.now();
      const envelope = {
        version: 1,
        token,
        createdAt: now,
        expiresAt: now + SHARE_EXPIRY_MS,
        title,
        text,
        url: sharedUrl,
        files: storedFiles,
      };
      const envelopeKey = `${SHARE_ENVELOPE_PREFIX}${token}`;
      await cache.put(
        envelopeKey,
        new Response(JSON.stringify(envelope), {
          headers: { "content-type": "application/json" },
        })
      );
      writtenKeys.push(envelopeKey);
    } catch (error) {
      await Promise.all(writtenKeys.map((key) => cache.delete(key)));
      throw error;
    }

    return new Response(null, {
      status: 303,
      headers: { location: `/home/garden?shareTarget=${encodeURIComponent(token)}` },
    });
  } catch {
    return shareErrorRedirect("invalid");
  }
}

self.addEventListener("install", (event) => {
  // Vite's development worker does not emit the production shell manifest.
  // Requiring it here rejects the install and leaves CI without an active
  // worker, even though the dev worker's own Workbox precache is valid.
  if (self.location.pathname === "/dev-sw.js") return;
  event.waitUntil(populatePwaShell());
});

self.addEventListener("fetch", (event) => {
  if (!isShareTargetRequest(event.request)) return;
  event.respondWith(receiveShareTarget(event.request));
  event.stopImmediatePropagation?.();
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

// Clear stale runtime caches when a new worker activates. Activation is controlled
// by the app update prompt so startup is not interrupted by a forced takeover.
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
