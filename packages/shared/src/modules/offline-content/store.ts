import { createStore, get, set } from "idb-keyval";
import type { QueryClient } from "@tanstack/react-query";
import { OFFLINE_MEDIA_CACHE, OFFLINE_READING_BUDGET, hashReadingData } from "./policy";
import { emptyDownloadManifest, type DownloadManifest } from "./types";

const MANIFEST_KEY = "__gg_download_manifest_v1__";
let idbStore: ReturnType<typeof createStore> | undefined;
function database() {
  return (idbStore ??= createStore("gg-react-query", "rq"));
}
let snapshot = emptyDownloadManifest();
let restored: Promise<void> | undefined;
let writing = Promise.resolve();
let flushQueries: (() => Promise<void>) | undefined;
export function configureOfflineQueryFlush(flush: () => Promise<void>): void {
  flushQueries = flush;
}
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

export function readingBytes(manifest: DownloadManifest): number {
  return (
    new TextEncoder().encode(JSON.stringify(manifest)).byteLength +
    Object.values(manifest.assets).reduce((sum, asset) => sum + asset.bytes, 0) +
    Object.values(manifest.queries).reduce((sum, query) => sum + query.bytes, 0)
  );
}
export function subscribeOfflineContent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getOfflineContentSnapshot(): DownloadManifest {
  return snapshot;
}
export function reportOfflineStorageFailure(): void {
  snapshot = { ...snapshot, storageFailure: true, essentialReady: false };
  notify();
}
export async function restoreDownloadManifest(): Promise<void> {
  return (restored ??= (async () => {
    try {
      const loaded = await get<DownloadManifest>(MANIFEST_KEY, database());
      if (
        loaded?.version === 1 &&
        loaded.gardens &&
        loaded.assets &&
        loaded.queries &&
        Array.isArray(loaded.visits)
      ) {
        snapshot = {
          ...loaded,
          essentialReady: false,
          gardens: Object.fromEntries(
            Object.entries(loaded.gardens).map(([key, garden]) => [
              key,
              { ...garden, state: "partial" },
            ])
          ),
        };
        notify();
      }
    } catch {
      reportOfflineStorageFailure();
    }
  })());
}
/** Serial manifest commits prevent concurrent downloads from losing each other's coverage. */
export async function updateDownloadManifest(
  update: (manifest: DownloadManifest) => DownloadManifest
): Promise<void> {
  const operation = writing.then(async () => {
    const next = update(snapshot);
    try {
      await set(MANIFEST_KEY, next, database());
      snapshot = next;
      notify();
    } catch (error) {
      reportOfflineStorageFailure();
      throw error;
    }
  });
  writing = operation.catch(() => {});
  return operation;
}

/** Verify local records AND response bodies before restoring availability labels. */
export async function verifyPreparedContent(client: QueryClient): Promise<void> {
  await restoreDownloadManifest();
  try {
    const media = await caches.open(OFFLINE_MEDIA_CACHE);
    const missingAssets = new Set<string>();
    for (const [url, asset] of Object.entries(snapshot.assets)) {
      const response = await media.match(url);
      if (!response || !response.ok || (await response.blob()).size !== asset.bytes)
        missingAssets.add(url);
    }
    const missingQueries = new Set<string>();
    for (const [hash, query] of Object.entries(snapshot.queries)) {
      const data = client.getQueryData(query.key);
      if (data === undefined || (await hashReadingData(data)) !== query.contentHash)
        missingQueries.add(hash);
    }
    // An interrupted eviction may leave old prepared flags in the query snapshot.
    // The verified manifest owns retention; orphaned flags never retain data forever.
    for (const query of client.getQueryCache().getAll()) {
      if (
        query.meta?.offlinePrepared &&
        (!snapshot.queries[query.queryHash] || missingQueries.has(query.queryHash))
      ) {
        query.setOptions({ ...query.options, meta: { ...query.meta, offlinePrepared: false } });
        if (!query.getObserversCount())
          client.removeQueries({ queryKey: query.queryKey, exact: true });
      }
    }
    await updateDownloadManifest((manifest) => {
      const assets = Object.fromEntries(
        Object.entries(manifest.assets).filter(([url]) => !missingAssets.has(url))
      );
      const queries = Object.fromEntries(
        Object.entries(manifest.queries).filter(([key]) => !missingQueries.has(key))
      );
      for (const entry of Object.values(queries)) {
        const query = client.getQueryCache().find({ queryKey: entry.key, exact: true });
        if (query)
          query.setOptions({
            ...query.options,
            gcTime: Infinity,
            meta: { ...query.meta, offlinePrepared: true },
          });
      }
      const gardens = Object.fromEntries(
        Object.entries(manifest.gardens).map(([key, garden]) => {
          const missing =
            garden.assets.filter((url) => missingAssets.has(url)).length +
            garden.queries.filter((hash) => missingQueries.has(hash)).length;
          return [
            key,
            {
              ...garden,
              state:
                missing || garden.failures ? "partial" : garden.updatedAt ? "ready" : "unavailable",
              failures: garden.failures + missing,
            },
          ];
        })
      ) as DownloadManifest["gardens"];
      return {
        ...manifest,
        assets,
        queries,
        gardens,
        essentialReady:
          Boolean(manifest.essentialUpdatedAt) &&
          manifest.essentialFailures === 0 &&
          Boolean(manifest.essentialAssets?.length && manifest.essentialQueries?.length) &&
          manifest.essentialAssets!.every((url) => Boolean(assets[url])) &&
          manifest.essentialQueries!.every((hash) => Boolean(queries[hash])),
      };
    });
    await flushQueries?.();
  } catch {
    reportOfflineStorageFailure();
  }
}

/** Evict browsing owners in priority/LRU order; no draft or submission store is opened. */
export async function evictPreparedContent(
  client: QueryClient,
  incomingBytes = 0,
  budget = OFFLINE_READING_BUDGET,
  keepOwner?: string,
  incomingWorkIds?: string[]
): Promise<boolean> {
  const cache = await caches.open(OFFLINE_MEDIA_CACHE);
  const overHistoryLimit = () =>
    incomingWorkIds &&
    new Set([
      ...Object.entries(snapshot.gardens)
        .filter(([key]) => key !== keepOwner)
        .flatMap(([, garden]) => garden.workIds),
      ...incomingWorkIds,
    ]).size > 500;
  // Superseded profile reads can be orphaned even when no garden has ever been prepared.
  for (const [hash, entry] of Object.entries(snapshot.queries)) {
    if (readingBytes(snapshot) + incomingBytes <= budget && !overHistoryLimit()) break;
    if (entry.protected || entry.owners.length) continue;
    await updateDownloadManifest((manifest) => {
      const queries = { ...manifest.queries };
      delete queries[hash];
      return { ...manifest, queries };
    });
    const query = client.getQueryCache().find({ queryKey: entry.key, exact: true });
    if (query)
      query.setOptions({ ...query.options, meta: { ...query.meta, offlinePrepared: false } });
    if (!query?.getObserversCount()) client.removeQueries({ queryKey: entry.key, exact: true });
  }
  const incomingPriority = keepOwner ? snapshot.gardens[keepOwner]?.priority : undefined;
  const candidates = Object.entries(snapshot.gardens)
    .filter(
      ([key, garden]) =>
        key !== keepOwner && (incomingPriority === undefined || garden.priority >= incomingPriority)
    )
    .sort(([, a], [, b]) => b.priority - a.priority || a.visitedAt - b.visitedAt);
  for (const [owner] of candidates) {
    if (readingBytes(snapshot) + incomingBytes <= budget && !overHistoryLimit()) break;
    const toDelete = Object.values(snapshot.assets).filter(
      (asset) => !asset.protected && asset.owners.every((id) => id === owner)
    );
    for (const asset of toDelete) await cache.delete(asset.url);
    await updateDownloadManifest((manifest) => {
      const assets = { ...manifest.assets };
      const queries = { ...manifest.queries };
      for (const [url, asset] of Object.entries(assets)) {
        const owners = asset.owners.filter((id) => id !== owner);
        if (!owners.length && !asset.protected) delete assets[url];
        else assets[url] = { ...asset, owners };
      }
      for (const [hash, entry] of Object.entries(queries)) {
        const owners = entry.owners.filter((id) => id !== owner);
        if (!owners.length && !entry.protected) {
          delete queries[hash];
          const query = client.getQueryCache().find({ queryKey: entry.key, exact: true });
          if (query)
            query.setOptions({ ...query.options, meta: { ...query.meta, offlinePrepared: false } });
          if (!query?.getObserversCount())
            client.removeQueries({ queryKey: entry.key, exact: true });
        } else queries[hash] = { ...entry, owners };
      }
      const garden = manifest.gardens[owner];
      return {
        ...manifest,
        assets,
        queries,
        gardens: {
          ...manifest.gardens,
          [owner]: {
            ...garden,
            state: "unavailable",
            workIds: [],
            assets: [],
            queries: [],
            failures: 1,
          },
        },
      };
    });
  }
  // Superseded essential assets are ordinary reading content once another account/photo is active.
  for (const asset of Object.values(snapshot.assets)
    .filter(
      (asset) => !asset.protected && asset.owners.every((owner) => owner.startsWith("essential:"))
    )
    .sort((a, b) => a.accessedAt - b.accessedAt)) {
    if (readingBytes(snapshot) + incomingBytes <= budget && !overHistoryLimit()) break;
    await cache.delete(asset.url);
    await updateDownloadManifest((manifest) => {
      const assets = { ...manifest.assets };
      delete assets[asset.url];
      return {
        ...manifest,
        assets,
        essentialReady: asset.owners.some((owner) => owner.startsWith("essential:"))
          ? false
          : manifest.essentialReady,
      };
    });
  }
  await flushQueries?.();
  return readingBytes(snapshot) + incomingBytes <= budget && !overHistoryLimit();
}

/** Detach superseded coverage. Unshared photos and metadata are evictable first. */
export async function releasePreparedContent(
  client: QueryClient,
  owner: string,
  keepQueries: Set<string>,
  keepAssets: Set<string>
): Promise<void> {
  const cache = await caches.open(OFFLINE_MEDIA_CACHE);
  for (const [url, asset] of Object.entries(snapshot.assets)) {
    if (
      !keepAssets.has(url) &&
      asset.owners.includes(owner) &&
      asset.owners.length === 1 &&
      !asset.protected
    )
      await cache.delete(url);
  }
  await updateDownloadManifest((manifest) => {
    const assets = { ...manifest.assets };
    const queries = { ...manifest.queries };
    for (const [url, asset] of Object.entries(assets)) {
      if (keepAssets.has(url)) continue;
      const owners = asset.owners.filter((id) => id !== owner);
      if (!owners.length && !asset.protected) delete assets[url];
      else assets[url] = { ...asset, owners };
    }
    for (const [hash, query] of Object.entries(queries)) {
      if (keepQueries.has(hash)) continue;
      const owners = query.owners.filter((id) => id !== owner);
      if (!owners.length && !query.protected) {
        delete queries[hash];
        const cached = client.getQueryCache().find({ queryKey: query.key, exact: true });
        if (cached)
          cached.setOptions({
            ...cached.options,
            meta: { ...cached.meta, offlinePrepared: false },
          });
        if (!cached?.getObserversCount())
          client.removeQueries({ queryKey: query.key, exact: true });
      } else queries[hash] = { ...query, owners };
    }
    return { ...manifest, assets, queries };
  });
  await flushQueries?.();
}
