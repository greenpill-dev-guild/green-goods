/// <reference lib="webworker" />
/**
 * Fetching shell assets and proving they are what the build wrote.
 *
 * Everything here is about one file: retrying it, refusing it when the server
 * answers with the wrong kind of thing, reusing a byte-identical copy from an
 * older shell, and hashing what landed. `shell.ts` owns which files a tier
 * holds and when they are installed; this owns getting each one intact.
 *
 * @module sw/shellAssets
 */

const FETCH_ATTEMPTS = 3;
const FETCH_CONCURRENCY = 4;

async function sha256Hex(scope: ServiceWorkerGlobalScope, value: BufferSource): Promise<string> {
  if (!scope.crypto?.subtle) throw new Error("PWA shell integrity verification is unavailable");
  const digest = await scope.crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The same digest the build computed: asset paths paired with their content hashes. */
/** The same digest the build computed: asset paths paired with their content hashes. */
export async function createShellDigest(
  scope: ServiceWorkerGlobalScope,
  assets: string[],
  contentDigests: string[]
): Promise<string> {
  const input = assets.map((asset, index) => `${asset}\0${contentDigests[index]}`).join("\n");
  return (await sha256Hex(scope, new TextEncoder().encode(input))).slice(0, 16);
}

function hasExpectedContentType(
  scope: ServiceWorkerGlobalScope,
  asset: string,
  response: Response | undefined
): response is Response {
  if (!response?.ok) return false;
  const pathname = new URL(asset, scope.location.origin).pathname.toLowerCase();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (pathname.endsWith(".js") || pathname.endsWith(".mjs"))
    return contentType.includes("javascript");
  if (pathname.endsWith(".css")) return contentType.includes("text/css");
  if (pathname.endsWith(".html")) return contentType.includes("text/html");
  return true;
}

function isContentAddressed(asset: string): boolean {
  return /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.[A-Za-z0-9]+$/.test(asset);
}

async function fetchShellAsset(
  scope: ServiceWorkerGlobalScope,
  asset: string,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(asset, { cache: "reload", signal });
      if (!hasExpectedContentType(scope, asset, response)) {
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

/** Copy one asset into the shell cache, reusing a byte-identical copy from an older shell. */
async function cacheShellAsset(
  scope: ServiceWorkerGlobalScope,
  shellCache: Cache,
  asset: string,
  reusableCacheNames: string[],
  signal?: AbortSignal
): Promise<string> {
  if (new URL(asset, scope.location.origin).origin !== scope.location.origin) {
    throw new Error(`PWA shell asset is cross-origin: ${asset}`);
  }
  let response: Response | undefined;
  if (isContentAddressed(asset)) {
    for (const cacheName of reusableCacheNames) {
      const reusable = await (await caches.open(cacheName)).match(asset);
      if (hasExpectedContentType(scope, asset, reusable)) {
        response = reusable;
        break;
      }
    }
  }
  response ??= await fetchShellAsset(scope, asset, signal);
  const contentDigest = await sha256Hex(scope, await response.clone().arrayBuffer());
  await shellCache.put(asset, response);
  return contentDigest;
}

export async function populateShellAssets(
  scope: ServiceWorkerGlobalScope,
  shellCache: Cache,
  assets: string[],
  reusableCacheNames: string[],
  signal?: AbortSignal
): Promise<string[]> {
  const contentDigests = new Array<string>(assets.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= assets.length) return;
      contentDigests[index] = await cacheShellAsset(
        scope,
        shellCache,
        assets[index],
        reusableCacheNames,
        signal
      );
    }
  };
  const lanes = Math.min(FETCH_CONCURRENCY, Math.max(assets.length, 1));
  await Promise.all(Array.from({ length: lanes }, worker));
  return contentDigests;
}
