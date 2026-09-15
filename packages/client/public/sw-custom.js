const GREEN_GOODS_SYNC_TAG = "green-goods-sync";
const STALE_RUNTIME_CACHES = ["js-cache", "indexer-cache", "graphql-cache", "gg-image-cache-meta"];
const OFFLINE_CONTENT_VERSION = 3;
const IPFS_MEDIA_CACHE = "ipfs-cache";
const MEDIA_POLICY_CACHE = "gg-media-policy-v1";
const MEDIA_POLICY_URL = "/__gg_media_policy_v1__";
const LEGACY_PREPARED_MEDIA_CACHE = "gg-prepared-media-v1";
const IPFS_GATEWAY_HOSTS = new Set([
  "greengoods.mypinata.cloud",
  "gateway.pinata.cloud",
  "ipfs.io",
]);
const MEDIA_STORED_AT_HEADER = "x-gg-stored-at";
const MEDIA_KEPT_HEADERS = ["content-type", "cache-control", "etag", "last-modified"];
const MEDIA_STORES_PER_SWEEP = 25;
const PWA_SHELL_CACHE_PREFIX = "gg-pwa-shell-";
const LEGACY_PWA_SHELL_META_CACHE = "gg-pwa-shell-meta";
const LEGACY_PWA_SHELL_META_URL = "/__gg_pwa_shell_current__";
const PWA_SHELL_META_CACHE = "gg-pwa-metadata-v2";
const PWA_SHELL_ACTIVE_META_URL = "/__gg_pwa_shell_active__";
const PWA_SHELL_CANDIDATE_META_URL = "/__gg_pwa_shell_candidate__";
const PWA_SHELL_MANIFEST_URL = "/pwa-shell-assets.json";
const PWA_SHELL_FETCH_ATTEMPTS = 3;
const PWA_SHELL_FETCH_CONCURRENCY = 4;
const PWA_SHELL_RUNTIME_CACHE = "gg-js-runtime";
const IS_DEV_SERVICE_WORKER = new URL(self.location.href).searchParams.has("dev-sw");
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
let acceptingBackgroundWork = true;
const backgroundWork = new Set();
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
    manifest?.version !== 2 ||
    typeof manifest.digest !== "string" ||
    !/^[a-f0-9]{16}$/.test(manifest.digest) ||
    !Array.isArray(manifest.assets) ||
    typeof manifest.criticalDigest !== "string" ||
    !/^[a-f0-9]{16}$/.test(manifest.criticalDigest) ||
    !Array.isArray(manifest.criticalAssets) ||
    typeof manifest.tailDigest !== "string" ||
    !/^[a-f0-9]{16}$/.test(manifest.tailDigest) ||
    !Array.isArray(manifest.tailAssets) ||
    [...manifest.assets, ...manifest.criticalAssets, ...manifest.tailAssets].some(
      (asset) =>
        typeof asset !== "string" || !asset.startsWith("/") || asset.startsWith("//")
    ) ||
    manifest.assets.length !== manifest.criticalAssets.length + manifest.tailAssets.length ||
    manifest.assets.some(
      (asset) => !manifest.criticalAssets.includes(asset) && !manifest.tailAssets.includes(asset)
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

function isContentAddressedShellAsset(asset) {
  return /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.[A-Za-z0-9]+$/.test(asset);
}

async function fetchShellAsset(asset, signal) {
  let lastError;
  for (let attempt = 1; attempt <= PWA_SHELL_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(asset, { cache: "reload", signal });
      if (!hasExpectedShellContentType(asset, response)) {
        throw new Error(`PWA shell asset has invalid content type: ${asset}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
  }
  throw lastError;
}

async function cacheShellAsset(shellCache, asset, reusableCacheNames = [], signal) {
  const assetUrl = new URL(asset, self.location.origin);
  if (assetUrl.origin !== self.location.origin) {
    throw new Error(`PWA shell asset is cross-origin: ${asset}`);
  }

  let response;
  if (isContentAddressedShellAsset(asset)) {
    for (const cacheName of reusableCacheNames) {
      const reusable = await (await caches.open(cacheName)).match(asset);
      if (hasExpectedShellContentType(asset, reusable)) {
        response = reusable;
        break;
      }
    }
  }
  response ??= await fetchShellAsset(asset, signal);
  const contentDigest = await sha256Hex(await response.clone().arrayBuffer());
  await shellCache.put(asset, response);
  return contentDigest;
}

async function populateShellAssets(shellCache, assets, reusableCacheNames, signal) {
  const contentDigests = new Array(assets.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= assets.length) return;
      contentDigests[index] = await cacheShellAsset(
        shellCache,
        assets[index],
        reusableCacheNames,
        signal
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(PWA_SHELL_FETCH_CONCURRENCY, Math.max(assets.length, 1)) },
      worker
    )
  );
  return contentDigests;
}

async function readShellMetadata(url) {
  try {
    const response = await (await caches.open(PWA_SHELL_META_CACHE)).match(url);
    const metadata = await response?.json();
    return typeof metadata?.cacheName === "string" ? metadata : null;
  } catch {
    return null;
  }
}

async function writeShellMetadata(url, metadata) {
  const metaCache = await caches.open(PWA_SHELL_META_CACHE);
  await metaCache.put(
    url,
    new Response(JSON.stringify(metadata), {
      headers: { "content-type": "application/json" },
    })
  );
}

async function readLegacyShellMetadata() {
  try {
    const response = await (await caches.open(LEGACY_PWA_SHELL_META_CACHE)).match(
      LEGACY_PWA_SHELL_META_URL
    );
    const metadata = await response?.json();
    return typeof metadata?.cacheName === "string" ? metadata : null;
  } catch {
    return null;
  }
}

async function getActiveShellMetadata() {
  return (await readShellMetadata(PWA_SHELL_ACTIVE_META_URL)) ?? readLegacyShellMetadata();
}

async function populatePwaShell() {
  if (IS_DEV_SERVICE_WORKER) return;

  const manifest = await readShellManifest();
  const cacheName = `${PWA_SHELL_CACHE_PREFIX}${manifest.digest}`;
  const active = await getActiveShellMetadata();
  if (cacheName === active?.cacheName && active?.criticalReady) return;

  try {
    // The digest is content-addressed, so this can only be an abandoned partial
    // staging cache from an earlier failed attempt.
    await caches.delete(cacheName);
    const shellCache = await caches.open(cacheName);
    const reusableCacheNames = (await caches.keys()).filter(
      (name) => name.startsWith(PWA_SHELL_CACHE_PREFIX) && name !== cacheName
    );
    const contentDigests = await populateShellAssets(
      shellCache,
      manifest.criticalAssets,
      reusableCacheNames
    );
    const installedDigest = await createShellDigest(manifest.criticalAssets, contentDigests);
    if (installedDigest !== manifest.criticalDigest) {
      throw new Error(
        `PWA critical shell digest mismatch: expected ${manifest.criticalDigest}, received ${installedDigest}`
      );
    }
    await writeShellMetadata(PWA_SHELL_CANDIDATE_META_URL, {
      cacheName,
      digest: manifest.digest,
      criticalDigest: manifest.criticalDigest,
      criticalAssets: manifest.criticalAssets,
      criticalReady: true,
      tailDigest: manifest.tailDigest,
      tailAssets: manifest.tailAssets,
      tailReady: manifest.tailAssets.length === 0,
      previousCacheName: active?.cacheName ?? null,
    });
  } catch (error) {
    if (cacheName !== active?.cacheName) await caches.delete(cacheName);
    throw error;
  }
}

async function getCurrentShellCacheName() {
  return (await getActiveShellMetadata())?.cacheName ?? null;
}

async function clearOldPwaShellCaches(active) {
  const retained = new Set([active?.cacheName, active?.previousCacheName].filter(Boolean));
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(PWA_SHELL_CACHE_PREFIX) && !retained.has(key))
      .map((key) => caches.delete(key))
  );
}

let tailDownload;
let tailDownloadAbort;

async function preparePwaShellTail() {
  const active = await readShellMetadata(PWA_SHELL_ACTIVE_META_URL);
  if (!active || active.tailReady || active.tailAssets.length === 0) return active;
  if (tailDownload) return tailDownload;

  tailDownloadAbort = new AbortController();
  tailDownload = (async () => {
    const shellCache = await caches.open(active.cacheName);
    const reusableCacheNames = (await caches.keys()).filter((name) =>
      name.startsWith(PWA_SHELL_CACHE_PREFIX)
    );
    const contentDigests = await populateShellAssets(
      shellCache,
      active.tailAssets,
      reusableCacheNames,
      tailDownloadAbort.signal
    );
    const installedDigest = await createShellDigest(active.tailAssets, contentDigests);
    if (installedDigest !== active.tailDigest) {
      throw new Error(
        `PWA tail digest mismatch: expected ${active.tailDigest}, received ${installedDigest}`
      );
    }
    const complete = { ...active, tailReady: true };
    await writeShellMetadata(PWA_SHELL_ACTIVE_META_URL, complete);
    return complete;
  })().finally(() => {
    tailDownload = undefined;
    tailDownloadAbort = undefined;
  });
  return tailDownload;
}

function pausePwaShellTail() {
  tailDownloadAbort?.abort();
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

function trackBackgroundWork(promise) {
  const tracked = Promise.resolve(promise).finally(() => backgroundWork.delete(tracked));
  backgroundWork.add(tracked);
  return tracked;
}

async function quietBackgroundWork() {
  acceptingBackgroundWork = false;
  pausePwaShellTail();
  await Promise.allSettled([...backgroundWork]);
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
    // Fall through to an explicit module error below.
  }

  return new Response(
    'throw new Error("Failed to fetch dynamically imported module");',
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
  await caches.delete(PWA_SHELL_RUNTIME_CACHE);
  const candidate = await readShellMetadata(PWA_SHELL_CANDIDATE_META_URL);
  const active = candidate ?? (await getActiveShellMetadata());
  if (candidate) {
    await writeShellMetadata(PWA_SHELL_ACTIVE_META_URL, candidate);
    await (await caches.open(PWA_SHELL_META_CACHE)).delete(PWA_SHELL_CANDIDATE_META_URL);
  } else if (active) {
    await writeShellMetadata(PWA_SHELL_ACTIVE_META_URL, active);
  }
  await clearOldPwaShellCaches(active);
  await caches.delete(LEGACY_PWA_SHELL_META_CACHE);
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

// Probes must prove a network round trip, including with an old app shell.
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).pathname !== "/connectivity-check.txt") return;
  event.respondWith(fetch(new Request(event.request, { cache: "no-store" })));
  event.stopImmediatePropagation?.();
});

function isIpfsMediaRequest(request) {
  if (request.method !== "GET" || request.headers?.get?.("range")) return false;
  try {
    const url = new URL(request.url);
    return (
      url.protocol === "https:" &&
      IPFS_GATEWAY_HOSTS.has(url.hostname) &&
      url.pathname.startsWith("/ipfs/")
    );
  } catch {
    return false;
  }
}

// Stored copies carry their own size and age, and no Vary header, so an <img>
// request and the app's download of the same URL always find each other.
async function storedMediaCopy(response) {
  const body = await response.blob();
  const headers = new Headers();
  for (const name of MEDIA_KEPT_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-length", String(body.size));
  headers.set(MEDIA_STORED_AT_HEADER, String(Date.now()));
  return { bytes: body.size, response: () => new Response(body, { status: 200, headers }) };
}

let mediaStoresSinceSweep = 0;
let mediaPolicy;
let mediaStoreTail = Promise.resolve();

async function readMediaPolicy() {
  if (mediaPolicy) return mediaPolicy;
  try {
    const response = await (await caches.open(MEDIA_POLICY_CACHE)).match(MEDIA_POLICY_URL);
    const stored = response ? await response.json() : undefined;
    if (
      stored &&
      Number.isFinite(stored.budgetBytes) &&
      stored.budgetBytes > 0 &&
      Array.isArray(stored.keep)
    ) {
      mediaPolicy = {
        budgetBytes: stored.budgetBytes,
        keep: stored.keep.map(String),
      };
    }
  } catch {
    // The app will send the policy again on its next preparation run.
  }
  return mediaPolicy ?? { budgetBytes: Number.POSITIVE_INFINITY, keep: [] };
}

async function writeMediaPolicy(policy) {
  mediaPolicy = policy;
  await (await caches.open(MEDIA_POLICY_CACHE)).put(
    MEDIA_POLICY_URL,
    new Response(JSON.stringify(policy), { headers: { "content-type": "application/json" } })
  );
}

async function scanMediaCache(cache) {
  const entries = [];
  let bytes = 0;
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    const size = Number(response?.headers.get("content-length")) || 0;
    const storedAt = Number(response?.headers.get(MEDIA_STORED_AT_HEADER)) || 0;
    entries.push({ request, url: request.url, bytes: size, storedAt });
    bytes += size;
  }
  return { entries, bytes };
}

// Oldest unprotected copies go first. Copies without a recorded size came from
// an older worker, so they are removed before any photo the app sized itself.
async function sweepMediaCache(options = {}) {
  const currentPolicy = await readMediaPolicy();
  const budgetBytes = options.budgetBytes ?? currentPolicy.budgetBytes;
  const keep = options.keep ?? currentPolicy.keep;
  if (options.persistPolicy) await writeMediaPolicy({ budgetBytes, keep });
  const cache = await caches.open(IPFS_MEDIA_CACHE);
  const { entries, bytes } = await scanMediaCache(cache);
  const protectedUrls = new Set(keep);
  let total = bytes;
  let count = entries.length;
  const evictable = entries
    .filter((entry) => !protectedUrls.has(entry.url))
    .sort((a, b) => a.storedAt - b.storedAt);
  for (const entry of evictable) {
    if (total <= budgetBytes) break;
    if (await cache.delete(entry.request)) {
      total -= entry.bytes;
      count -= 1;
    }
  }
  return { bytes: total, count };
}

async function storeMedia(url, response) {
  const cache = await caches.open(IPFS_MEDIA_CACHE);
  const copy = await storedMediaCopy(response);
  const policy = await readMediaPolicy();
  const existing = await cache.match(url, { ignoreVary: true });
  const existingBytes = Number(existing?.headers.get("content-length")) || 0;
  const before = await scanMediaCache(cache);
  const projectedBytes = before.bytes - existingBytes + copy.bytes;
  if (projectedBytes > policy.budgetBytes) {
    const availableForExisting = Math.max(0, policy.budgetBytes - copy.bytes);
    // Keep the current copy until the replacement is proven admissible. Two
    // overlapping fetches for the same URL can otherwise evict a good copy and
    // then reject the larger replacement.
    const keepDuringAdmission = policy.keep.includes(url) ? policy.keep : [...policy.keep, url];
    const swept = await sweepMediaCache({
      budgetBytes: availableForExisting,
      keep: keepDuringAdmission,
    });
    const retainedExisting = await cache.match(url, { ignoreVary: true });
    const retainedExistingBytes = Number(retainedExisting?.headers.get("content-length")) || 0;
    if (swept.bytes - retainedExistingBytes + copy.bytes > policy.budgetBytes) {
      const error = new Error("Offline photo budget is full");
      error.name = "QuotaExceededError";
      throw error;
    }
  }
  try {
    await cache.put(url, copy.response());
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    await sweepMediaCache({ budgetBytes: 0, keep: policy.keep });
    await cache.put(url, copy.response());
  }
  mediaStoresSinceSweep += 1;
  if (mediaStoresSinceSweep >= MEDIA_STORES_PER_SWEEP) {
    mediaStoresSinceSweep = 0;
    await sweepMediaCache({ budgetBytes: policy.budgetBytes, keep: policy.keep });
  }
}

function scheduleMediaStore(url, response) {
  const scheduled = mediaStoreTail.then(() => storeMedia(url, response));
  mediaStoreTail = scheduled.catch(() => {});
  return scheduled;
}

// Answer first, store afterwards: the page never waits on a cache write.
async function respondWithMedia(event) {
  const request = event.request;
  const url = request.url;
  const cache = await caches.open(IPFS_MEDIA_CACHE);
  const cached = await cache.match(url, { ignoreVary: true });
  if (cached) return cached;
  if (await caches.has(LEGACY_PREPARED_MEDIA_CACHE)) {
    const legacy = await (await caches.open(LEGACY_PREPARED_MEDIA_CACHE)).match(url, {
      ignoreVary: true,
    });
    if (legacy) {
      if (acceptingBackgroundWork) {
        event.waitUntil(trackBackgroundWork(scheduleMediaStore(url, legacy.clone()).catch(() => {})));
      }
      return legacy;
    }
  }
  let response;
  try {
    response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      headers: { accept: request.headers?.get?.("accept") || "*/*" },
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal?.aborted) throw error;
    // A gateway without CORS still displays; it just is not kept for offline.
    return fetch(request);
  }
  if (response.status === 200) {
    if (acceptingBackgroundWork) {
      event.waitUntil(trackBackgroundWork(scheduleMediaStore(url, response.clone()).catch(() => {})));
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (!isIpfsMediaRequest(event.request)) return;
  event.respondWith(respondWithMedia(event));
  event.stopImmediatePropagation?.();
});

// Clear stale runtime caches when a new worker activates. Activation is controlled
// by the app update prompt so startup is not interrupted by a forced takeover.
self.addEventListener("activate", (event) => {
  event.waitUntil(activateServiceWorker());
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "PREPARE_PWA_TAIL" || type === "PAUSE_PWA_TAIL") {
    const port = event.ports?.[0];
    if (type === "PAUSE_PWA_TAIL") {
      pausePwaShellTail();
      port?.postMessage({ status: "paused" });
      return;
    }
    if (!acceptingBackgroundWork) {
      port?.postMessage({ status: "blocked" });
      return;
    }
    const preparation = trackBackgroundWork(preparePwaShellTail());
    event.waitUntil(
      preparation.then(
        (metadata) => port?.postMessage({ status: metadata?.tailReady ? "ready" : "unavailable" }),
        (error) => port?.postMessage({ status: error?.name === "AbortError" ? "paused" : "failed" })
      )
    );
    return;
  }

  if (type === "PREPARE_TO_ACTIVATE_UPDATE") {
    const port = event.ports?.[0];
    event.waitUntil(
      quietBackgroundWork().then(
        () => port?.postMessage({ type: "GG_QUIET_ACK", status: "quiet" }),
        () => port?.postMessage({ type: "GG_QUIET_ACK", status: "failed" })
      )
    );
    return;
  }

  if (type === "RESUME_BACKGROUND_WORK") {
    acceptingBackgroundWork = true;
    event.ports?.[0]?.postMessage({ status: "resumed" });
    return;
  }

  if (type === "OFFLINE_CONTENT_CAPABILITIES") {
    event.ports?.[0]?.postMessage({ offlineContentVersion: OFFLINE_CONTENT_VERSION });
    return;
  }

  if (type === "MEDIA_POLICY") {
    const port = event.ports?.[0];
    const budgetBytes = Number(event.data?.budgetBytes);
    const keep = Array.isArray(event.data?.keep) ? event.data.keep.map(String) : [];
    if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
      port?.postMessage({ failed: true });
      return;
    }
    event.waitUntil(
      trackBackgroundWork(writeMediaPolicy({ budgetBytes, keep })).then(
        () => port?.postMessage({ ready: true }),
        () => port?.postMessage({ failed: true })
      )
    );
    return;
  }

  if (type === "MEDIA_STATS" || type === "MEDIA_SWEEP") {
    const port = event.ports?.[0];
    const budgetBytes = Number(event.data?.budgetBytes);
    const sweep =
      type === "MEDIA_SWEEP"
        ? Number.isFinite(budgetBytes) && budgetBytes > 0
          ? sweepMediaCache({
              budgetBytes,
              keep: Array.isArray(event.data?.keep) ? event.data.keep.map(String) : [],
              persistPolicy: true,
            })
          : Promise.reject(new Error("Invalid offline media budget"))
        : caches.open(IPFS_MEDIA_CACHE).then(scanMediaCache).then(({ bytes, entries }) => ({
            bytes,
            count: entries.length,
          }));
    event.waitUntil(
      trackBackgroundWork(sweep).then(
        (stats) => port?.postMessage(stats),
        () => port?.postMessage({ bytes: 0, count: 0, failed: true })
      )
    );
    return;
  }

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
    const port = event.ports?.[0];
    const reply = (status) => port?.postMessage({ type: "GG_UPDATE_ACK", status });
    reply("received");
    event.waitUntil(
      Promise.resolve().then(() => self.skipWaiting()).then(
        () => reply("requested"),
        () => reply("rejected")
      )
    );
    return;
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
