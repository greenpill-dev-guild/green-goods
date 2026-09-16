/// <reference lib="webworker" />
import {
  OBSOLETE_RUNTIME_CACHES,
  SW_CACHES,
} from "@green-goods/shared/modules/app/service-worker-protocol";
import { createShellDigest, populateShellAssets } from "./shellAssets";

const MANIFEST_URL = "/pwa-shell-assets.json";
const ACTIVE_METADATA_URL = "/__gg_pwa_shell_active__";
const CANDIDATE_METADATA_URL = "/__gg_pwa_shell_candidate__";
const LEGACY_METADATA_URL = "/__gg_pwa_shell_current__";
/** Runtime caches retired workers left behind, removed on activation. */
const STALE_RUNTIME_CACHES = new Set<string>(OBSOLETE_RUNTIME_CACHES);
const DIGEST_PATTERN = /^[a-f0-9]{16}$/;

/**
 * What the build wrote next to the app: the shell in three tiers. The critical
 * set boots the app, the priority set is what an installed app needs to accept
 * work with no signal, and the tail is only ever read online.
 */
export interface ShellManifest {
  version: 3;
  digest: string;
  assets: string[];
  criticalDigest: string;
  criticalAssets: string[];
  priorityDigest: string;
  priorityAssets: string[];
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
  priorityDigest?: string;
  priorityAssets?: string[];
  priorityReady?: boolean;
  tailDigest?: string;
  tailAssets?: string[];
  tailReady?: boolean;
  previousCacheName?: string | null;
}

/** The two tiers that arrive after the critical set, each downloadable on its own. */
export type ShellTier = "priority" | "tail";

const TIER_FIELDS = {
  priority: { assets: "priorityAssets", digest: "priorityDigest", ready: "priorityReady" },
  tail: { assets: "tailAssets", digest: "tailDigest", ready: "tailReady" },
} as const satisfies Record<ShellTier, { assets: string; digest: string; ready: string }>;

function isShellManifest(value: unknown): value is ShellManifest {
  const manifest = value as Partial<ShellManifest> | null;
  if (!manifest || manifest.version !== 3) return false;
  const { assets, criticalAssets, priorityAssets, tailAssets } = manifest;
  if (
    !Array.isArray(assets) ||
    !Array.isArray(criticalAssets) ||
    !Array.isArray(priorityAssets) ||
    !Array.isArray(tailAssets)
  ) {
    return false;
  }
  const digests = [
    manifest.digest,
    manifest.criticalDigest,
    manifest.priorityDigest,
    manifest.tailDigest,
  ];
  if (!digests.every((digest) => typeof digest === "string" && DIGEST_PATTERN.test(digest))) {
    return false;
  }
  const isAssetPath = (asset: unknown) =>
    typeof asset === "string" && asset.startsWith("/") && !asset.startsWith("//");
  const tiered = [criticalAssets, priorityAssets, tailAssets];
  return (
    [...assets, ...tiered.flat()].every(isAssetPath) &&
    assets.length === tiered.reduce((total, tier) => total + tier.length, 0) &&
    assets.every((asset) => tiered.some((tier) => tier.includes(asset)))
  );
}

async function readShellManifest(): Promise<ShellManifest> {
  const response = await fetch(MANIFEST_URL, { cache: "reload" });
  if (!response.ok) throw new Error("PWA shell manifest unavailable");
  const manifest: unknown = await response.json();
  if (!isShellManifest(manifest)) throw new Error("PWA shell manifest is invalid");
  return manifest;
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
  private downloads = new Map<ShellTier, Promise<ShellMetadata | null>>();
  private aborts = new Map<ShellTier, AbortController>();
  /**
   * Both tiers write the same metadata record, so they take turns. Running
   * them together would let whichever finished last erase the other's
   * readiness flag and re-download a tier that was already on disk.
   */
  private queue: Promise<unknown> = Promise.resolve();

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
    // The record is not proof the cache is still there. A rolled-back worker
    // sweeps shell caches without touching this metadata, and the browser can
    // reclaim storage under either. Skipping the install on a record whose
    // cache is gone leaves nothing installed, and activation then sweeps the
    // shell the open page is actually running from.
    if (cacheName === active?.cacheName && active?.criticalReady && (await caches.has(cacheName))) {
      return;
    }
    try {
      // The digest is content-addressed, so an existing cache of this name can
      // only be an abandoned partial staging attempt.
      await caches.delete(cacheName);
      const shellCache = await caches.open(cacheName);
      // The legacy metadata cache shares the shell prefix but holds no assets;
      // leaving it in would open it once per content-addressed file for nothing.
      const reusable = (await caches.keys()).filter(
        (name) =>
          name.startsWith(SW_CACHES.SHELL_PREFIX) &&
          name !== cacheName &&
          name !== SW_CACHES.LEGACY_SHELL_METADATA
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
        priorityDigest: manifest.priorityDigest,
        priorityAssets: manifest.priorityAssets,
        priorityReady: manifest.priorityAssets.length === 0,
        tailDigest: manifest.tailDigest,
        tailAssets: manifest.tailAssets,
        tailReady: manifest.tailAssets.length === 0,
        previousCacheName: active?.cacheName ?? null,
      });
      // Reclaim candidates from updates the user never accepted. Without this
      // a deferred update leaves a whole shell behind per deploy, reclaimed
      // only when one is finally accepted. Done after staging, so this build
      // still reused their bytes. The active shell and the one an open page
      // may still be reading are kept, as is the legacy metadata record, which
      // shares the shell prefix and is retired during activation.
      const keep = new Set(
        [cacheName, active?.cacheName, active?.previousCacheName].filter(Boolean)
      );
      await Promise.all(
        (await caches.keys())
          .filter(
            (key) =>
              key.startsWith(SW_CACHES.SHELL_PREFIX) &&
              key !== SW_CACHES.LEGACY_SHELL_METADATA &&
              !keep.has(key)
          )
          .map((key) => caches.delete(key))
      );
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
    // With no metadata there is nothing to retain against, and sweeping would
    // delete every shell including the one serving this page. Leave them: the
    // next successful install writes a record and reclaims the rest.
    if (retained.size > 0) {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith(SW_CACHES.SHELL_PREFIX) && !retained.has(key))
          .map((key) => caches.delete(key))
      );
    }
    await caches.delete(SW_CACHES.LEGACY_SHELL_METADATA);
  }

  async currentCacheName(): Promise<string | null> {
    return (await this.activeMetadata())?.cacheName ?? null;
  }

  /** Download one deferred tier into the active shell; one run per tier, resumable after a pause. */
  prepare(tier: ShellTier): Promise<ShellMetadata | null> {
    const running = this.downloads.get(tier);
    if (running) return running;
    const abort = new AbortController();
    this.aborts.set(tier, abort);
    const run = this.queue.catch(() => undefined).then(() => this.downloadTier(tier, abort.signal));
    this.queue = run.catch(() => undefined);
    const tracked = run.finally(() => {
      this.downloads.delete(tier);
      this.aborts.delete(tier);
    });
    this.downloads.set(tier, tracked);
    return tracked;
  }

  /** Stop one tier, or every tier when a waiting worker needs the scope quiet. */
  pause(tier?: ShellTier): void {
    if (tier) this.aborts.get(tier)?.abort();
    else for (const abort of this.aborts.values()) abort.abort();
  }

  private async downloadTier(tier: ShellTier, signal: AbortSignal): Promise<ShellMetadata | null> {
    const fields = TIER_FIELDS[tier];
    const active = await readMetadata(SW_CACHES.SHELL_METADATA, ACTIVE_METADATA_URL);
    const assets = active?.[fields.assets] ?? [];
    if (!active || active[fields.ready] || assets.length === 0) return active;
    const shellCache = await caches.open(active.cacheName);
    const reusable = (await caches.keys()).filter((name) =>
      name.startsWith(SW_CACHES.SHELL_PREFIX)
    );
    const digests = await populateShellAssets(this.scope, shellCache, assets, reusable, signal);
    const installed = await createShellDigest(this.scope, assets, digests);
    const expected = active[fields.digest];
    if (installed !== expected) {
      throw new Error(
        `PWA ${tier} shell digest mismatch: expected ${expected}, received ${installed}`
      );
    }
    // Re-read: the other tier may have settled while this one downloaded.
    const latest = (await readMetadata(SW_CACHES.SHELL_METADATA, ACTIVE_METADATA_URL)) ?? active;
    const complete = { ...latest, [fields.ready]: true };
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
