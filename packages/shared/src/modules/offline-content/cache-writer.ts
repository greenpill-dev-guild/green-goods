import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { EASWork } from "../../types/eas-responses";
import { OFFLINE_MEDIA_CACHE, hashReadingData, serializeReadingData } from "./policy";
import { getOfflineContentSnapshot, updateDownloadManifest, evictPreparedContent } from "./store";

export interface PreparedRead {
  key: QueryKey;
  data: unknown;
}
interface PreparationPorts {
  client: QueryClient;
  persistQueries(): Promise<void>;
  canRun(): boolean;
  getWorks(address: string, limit: number, chainId: number): Promise<EASWork[]>;
  gardenPhotos?(address: string): string[];
  getDetails(
    work: EASWork,
    signal: AbortSignal
  ): Promise<{ reads: PreparedRead[]; photos: string[] }>;
  getApprovals(works: EASWork[], chainId: number, gardenAddress: string): Promise<PreparedRead>;
  workKey(address: string, chainId: number): QueryKey;
  fetchMedia(url: string, signal: AbortSignal): Promise<Response>;
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(serializeReadingData(value)).byteLength;
}

/** Single run owns at most two downloads. Restart uses committed manifest coverage. */
export class PreparedContentWriter {
  private committing: Promise<unknown> = Promise.resolve();
  private commit<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.committing.then(operation);
    this.committing = result.catch(() => {});
    return result;
  }
  protected abort = new AbortController();
  constructor(protected ports: PreparationPorts) {}
  pause(): void {
    this.abort.abort();
  }
  protected check(): void {
    if (!this.ports.canRun() || this.abort.signal.aborted) throw new Error("Preparation paused");
  }
  protected async read(
    owner: string,
    key: QueryKey,
    data: unknown,
    protect = false
  ): Promise<string> {
    return this.commit(async () => {
      this.check();
      const hash = hashKey(key);
      const bytes = jsonBytes(data);
      const contentHash = await hashReadingData(data);
      const current = getOfflineContentSnapshot().queries[hash];
      const entry = {
        key,
        bytes,
        contentHash,
        protected: protect || Boolean(current?.protected),
        owners: [...new Set([...(current?.owners ?? []), owner])],
      };
      const growth =
        bytes -
        (current?.bytes ?? 0) +
        jsonBytes(entry) -
        (current ? jsonBytes(current) : 0) +
        (current ? 0 : jsonBytes(hash) + 2);
      if (!(await evictPreparedContent(this.ports.client, Math.max(0, growth), undefined, owner)))
        throw new Error("Reading budget reached");
      if (this.ports.client.getQueryData(key) !== data) this.ports.client.setQueryData(key, data);
      const query = this.ports.client.getQueryCache().find({ queryKey: key, exact: true });
      if (query)
        query.setOptions({
          ...query.options,
          gcTime: Infinity,
          meta: { ...query.meta, offlinePrepared: true },
        });
      try {
        await this.ports.persistQueries();
      } catch (error) {
        if (query && !current)
          query.setOptions({ ...query.options, meta: { ...query.meta, offlinePrepared: false } });
        throw error;
      }
      await updateDownloadManifest((manifest) => ({
        ...manifest,
        queries: {
          ...manifest.queries,
          [hash]: {
            key,
            bytes,
            contentHash,
            protected: protect || Boolean(manifest.queries[hash]?.protected),
            owners: [...new Set([...(manifest.queries[hash]?.owners ?? []), owner])],
          },
        },
      }));
      return hash;
    });
  }
  protected async media(owner: string, url: string, protect = false): Promise<string> {
    this.check();
    const cache = await caches.open(OFFLINE_MEDIA_CACHE);
    const existing = getOfflineContentSnapshot().assets[url];
    const cached = await cache.match(url);
    let downloaded: Response | undefined;
    let bytes = existing?.bytes;
    if (!existing || !cached?.ok) {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      this.abort.signal.addEventListener("abort", cancel, { once: true });
      const timeout = setTimeout(cancel, 15_000);
      try {
        downloaded = await this.ports.fetchMedia(url, controller.signal);
        if (!downloaded.ok || downloaded.type === "opaque")
          throw new Error("Media could not be verified");
        const type = downloaded.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) throw new Error("Display image unavailable");
        bytes = (await downloaded.clone().blob()).size;
        if (!bytes) throw new Error("Empty display image");
      } finally {
        clearTimeout(timeout);
        this.abort.signal.removeEventListener("abort", cancel);
      }
    }
    return this.commit(async () => {
      this.check();
      const current = getOfflineContentSnapshot().assets[url];
      const entry = {
        url,
        bytes: bytes!,
        accessedAt: Date.now(),
        owners: [...new Set([...(current?.owners ?? []), owner])],
        protected: protect || Boolean(current?.protected),
        intent: "display" as const,
      };
      const growth =
        bytes! -
        (current?.bytes ?? 0) +
        jsonBytes(entry) -
        (current ? jsonBytes(current) : 0) +
        (current ? 0 : jsonBytes(url) + 2);
      if (!(await evictPreparedContent(this.ports.client, Math.max(0, growth), undefined, owner)))
        throw new Error("Reading budget reached");
      if (downloaded) {
        await cache.put(url, downloaded);
        const verified = await cache.match(url);
        if (!verified?.ok || (await verified.blob()).size !== bytes)
          throw new Error("Media write was incomplete");
      }
      try {
        await updateDownloadManifest((manifest) => ({
          ...manifest,
          assets: {
            ...manifest.assets,
            [url]: {
              url,
              bytes: bytes!,
              accessedAt: Date.now(),
              owners: [...new Set([...(manifest.assets[url]?.owners ?? []), owner])],
              protected: protect || Boolean(manifest.assets[url]?.protected),
              intent: "display",
            },
          },
        }));
      } catch (error) {
        if (!current) await cache.delete(url);
        throw error;
      }
      return url;
    });
  }
}
