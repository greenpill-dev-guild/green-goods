import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getOfflineContentSnapshot,
  subscribeOfflineContent,
} from "../../modules/offline-content/store";
import { connectivityStore } from "../../stores/connectivity";

/** Originals must have their own verified response; a display photo is insufficient. */
export function useOfflineAssetAvailability(urls: string[]): Record<string, boolean> {
  const manifest = useSyncExternalStore(
    subscribeOfflineContent,
    getOfflineContentSnapshot,
    getOfflineContentSnapshot
  );
  const online = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot
  );
  const key = JSON.stringify([...new Set(urls)].sort());
  const [verified, setVerified] = useState<{ key: string; values: Record<string, boolean> }>({
    key: "",
    values: {},
  });
  useEffect(() => {
    let cancelled = false;
    const sources = JSON.parse(key) as string[];
    void (async () => {
      const values: Record<string, boolean> = {};
      for (const url of sources) {
        values[url] = /^(blob:|data:)/.test(url);
        if (values[url] || typeof caches === "undefined") continue;
        for (const name of ["image-cache", "ipfs-cache"]) {
          try {
            const cache = await caches.open(name);
            const response = await cache.match(url);
            if (name === "image-cache" && response) {
              const metadata = await caches.open("gg-image-cache-meta");
              const saved = await metadata.match(url);
              const cachedAt = saved
                ? Number(await saved.text())
                : Date.parse(response.headers.get("date") ?? "");
              if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > 30 * 24 * 60 * 60 * 1000)
                continue;
            }
            if (response?.ok && response.type !== "opaque" && (await response.blob()).size > 0) {
              values[url] = true;
              break;
            }
          } catch {
            /* Missing or inaccessible storage is unavailable. */
          }
        }
      }
      if (!cancelled) setVerified({ key, values });
    })();
    return () => {
      cancelled = true;
    };
  }, [key, online, manifest]);
  return verified.key === key ? verified.values : {};
}
