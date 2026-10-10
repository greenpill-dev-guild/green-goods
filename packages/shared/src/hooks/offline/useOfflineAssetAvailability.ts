import { useEffect, useState, useSyncExternalStore } from "react";
import { isMediaCached } from "../../modules/offline-content/media";
import { connectivityStore } from "../../stores/connectivity";

async function isCachedImage(url: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return Boolean(await caches.match(url, { cacheName: "image-cache", ignoreVary: true }));
  } catch {
    return false;
  }
}

/**
 * Whether each exact URL can open without a connection. Originals need their own
 * copy; a display-sized photo of the same file does not count. Only checked while
 * offline, the only time a screen asks.
 */
export function useOfflineAssetAvailability(urls: string[]): Record<string, boolean> {
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
    if (online) return;
    let cancelled = false;
    void (async () => {
      const values: Record<string, boolean> = {};
      for (const url of JSON.parse(key) as string[]) {
        values[url] =
          /^(blob:|data:)/.test(url) || (await isMediaCached(url)) || (await isCachedImage(url));
      }
      if (!cancelled) setVerified({ key, values });
    })();
    return () => {
      cancelled = true;
    };
  }, [key, online]);
  return verified.key === key ? verified.values : {};
}
