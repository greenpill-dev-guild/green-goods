import {
  OBSOLETE_RUNTIME_CACHES,
  SW_CACHES,
} from "@green-goods/shared/modules/app/service-worker-protocol";

const MANIFEST_URL = "/pwa-shell-assets.json";
const FETCH_ATTEMPTS = 3;
const FETCH_CONCURRENCY = 4;
const ACTIVE_METADATA_URL = "/__gg_pwa_shell_active__";
const CANDIDATE_METADATA_URL = "/__gg_pwa_shell_candidate__";
const LEGACY_METADATA_URL = "/__gg_pwa_shell_current__";
/** Runtime caches retired workers left behind, removed on activation. */
const STALE_RUNTIME_CACHES = new Set<string>([...OBSOLETE_RUNTIME_CACHES, "gg-image-cache-meta"]);
const DIGEST_PATTERN = /^[a-f0-9]{16}$/;

/** What the build wrote next to the app: the shell split into a critical set and a tail. */
export interface ShellManifest {
  version: 2;
  digest: string;
  assets: string[];
  criticalDigest: string;
  criticalAssets: string[];
  tailDigest: string;
  tailAssets: string[];
}

/** What the worker remembers about an installed shell, kept in Cache Storage. */
export interface ShellMetadata {
  cacheName: string;
  digest?: string;
  criticalDigest?: string;
  criticalAssets?: string[];
  criticalReady?: boolean;
  tailDigest?: string;
  tailAssets?: string[];
  tailReady?: boolean;
  previousCacheName?: string | null;
}

function isShellManifest(value: unknown): value is ShellManifest {
  const manifest = value as Partial<ShellManifest> | null;
  if (!manifest || manifest.version !== 2) return false;
  const { assets, criticalAssets, tailAssets } = manifest;
  if (!Array.isArray(assets) || !Array.isArray(criticalAssets) || !Array.isArray(tailAssets)) {
    return false;
  }
  const digests = [manifest.digest, manifest.criticalDigest, manifest.tailDigest];
  if (!digests.every((digest) => typeof digest === "string" && DIGEST_PATTERN.test(digest))) {
    return false;
  }
  const isAssetPath = (asset: unknown) =>
    typeof asset === "string" && asset.startsWith("/") && !asset.startsWith("//");
  return (
    [...assets, ...criticalAssets, ...tailAssets].every(isAssetPath) &&
    assets.length === criticalAssets.length + tailAssets.length &&
    assets.every((asset) => criticalAssets.includes(asset) || tailAssets.includes(asset))
  );
}

async function readShellManifest(): Promise<ShellManifest> {
  const response = await fetch(MANIFEST_URL, { cache: "reload" });
  if (!response.ok) throw new Error("PWA shell manifest unavailable");
  const manifest: unknown = await response.json();
  if (!isShellManifest(manifest)) throw new Error("PWA shell manifest is invalid");
  return manifest;
}

async function sha256Hex(scope: ServiceWorkerGlobalScope, value: BufferSource): Promise<string> {
  if (!scope.crypto?.subtle) throw new Error("PWA shell integrity verification is unavailable");
  const digest = await scope.crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The same digest the build computed: asset paths paired with their content hashes. */
async function createShellDigest(
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

async function populateShellAssets(
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

async function readMetadata(cacheName: string, url: string): Promise<ShellMetadata | null> {
  try {
    const response = await (await caches.open(cacheName)).match(url);
    const metadata: unknown = await response?.json();
    const candidate = metadata as Partial<ShellMetadata> | null;
    return typeof candidate?.cacheName === "string" ? (candidate as ShellMetadata) : null;
  } catch {
    return null;
  }
}

async function writeMetadata(url: string, metadata: ShellMetadata): Promise<void> {
  const cache = await caches.open(SW_CACHES.SHELL_METADATA);
  await cache.put(
    url,
    new Response(JSON.stringify(metadata), { headers: { "content-type": "application/json" } })
  );
}

/**
 * The installed app shell: every module the signed-in app needs, kept in a
 * content-addressed cache. Installation writes the critical set and refuses
 * to proceed on any mismatch; the tail follows once the page is idle.
 */
export class PwaShell {
  private tailDownload?: Promise<ShellMetadata | null>;
  private tailAbort?: AbortController;

  constructor(
    private readonly scope: ServiceWorkerGlobalScope,
    private readonly isDevWorker: boolean
  ) {}

  /** Stage the critical shell as a candidate; activation promotes it. */
  async install(): Promise<void> {
    if (this.isDevWorker) return;
    const manifest = await readShellManifest();
    const cacheName = `${SW_CACHES.SHELL_PREFIX}${manifest.digest}`;
    const active = await this.activeMetadata();
    if (cacheName === active?.cacheName && active?.criticalReady) return;
    try {
      // The digest is content-addressed, so an existing cache of this name can
      // only be an abandoned partial staging attempt.
      await caches.delete(cacheName);
      const shellCache = await caches.open(cacheName);
      const reusable = (await caches.keys()).filter(
        (name) => name.startsWith(SW_CACHES.SHELL_PREFIX) && name !== cacheName
      );
      const digests = await populateShellAssets(
        this.scope,
        shellCache,
        manifest.criticalAssets,
        reusable
      );
      const installed = await createShellDigest(this.scope, manifest.criticalAssets, digests);
      if (installed !== manifest.criticalDigest) {
        throw new Error(
          `PWA critical shell digest mismatch: expected ${manifest.criticalDigest}, received ${installed}`
        );
      }
      await writeMetadata(CANDIDATE_METADATA_URL, {
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

  /** Promote the candidate shell, then drop caches no shell still uses. */
  async activate(): Promise<void> {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => STALE_RUNTIME_CACHES.has(key)).map((key) => caches.delete(key))
    );
    await caches.delete(SW_CACHES.JS_RUNTIME);
    const candidate = await readMetadata(SW_CACHES.SHELL_METADATA, CANDIDATE_METADATA_URL);
    const active = candidate ?? (await this.activeMetadata());
    if (candidate) {
      await writeMetadata(ACTIVE_METADATA_URL, candidate);
      await (await caches.open(SW_CACHES.SHELL_METADATA)).delete(CANDIDATE_METADATA_URL);
    } else if (active) {
      await writeMetadata(ACTIVE_METADATA_URL, active);
    }
    const retained = new Set([active?.cacheName, active?.previousCacheName].filter(Boolean));
    await Promise.all(
      (await caches.keys())
        .filter((key) => key.startsWith(SW_CACHES.SHELL_PREFIX) && !retained.has(key))
        .map((key) => caches.delete(key))
    );
    await caches.delete(SW_CACHES.LEGACY_SHELL_METADATA);
  }

  async currentCacheName(): Promise<string | null> {
    return (await this.activeMetadata())?.cacheName ?? null;
  }

  /** Download the tail into the active shell; one download at a time, resumable after a pause. */
  prepareTail(): Promise<ShellMetadata | null> {
    if (this.tailDownload) return this.tailDownload;
    const abort = new AbortController();
    this.tailAbort = abort;
    this.tailDownload = this.downloadTail(abort.signal).finally(() => {
      this.tailDownload = undefined;
      this.tailAbort = undefined;
    });
    return this.tailDownload;
  }

  pauseTail(): void {
    this.tailAbort?.abort();
  }

  private async downloadTail(signal: AbortSignal): Promise<ShellMetadata | null> {
    const active = await readMetadata(SW_CACHES.SHELL_METADATA, ACTIVE_METADATA_URL);
    const tailAssets = active?.tailAssets ?? [];
    if (!active || active.tailReady || tailAssets.length === 0) return active;
    const shellCache = await caches.open(active.cacheName);
    const reusable = (await caches.keys()).filter((name) =>
      name.startsWith(SW_CACHES.SHELL_PREFIX)
    );
    const digests = await populateShellAssets(this.scope, shellCache, tailAssets, reusable, signal);
    const installed = await createShellDigest(this.scope, tailAssets, digests);
    if (installed !== active.tailDigest) {
      throw new Error(
        `PWA tail digest mismatch: expected ${active.tailDigest}, received ${installed}`
      );
    }
    const complete = { ...active, tailReady: true };
    await writeMetadata(ACTIVE_METADATA_URL, complete);
    return complete;
  }

  private async activeMetadata(): Promise<ShellMetadata | null> {
    return (
      (await readMetadata(SW_CACHES.SHELL_METADATA, ACTIVE_METADATA_URL)) ??
      readMetadata(SW_CACHES.LEGACY_SHELL_METADATA, LEGACY_METADATA_URL)
    );
  }
}
