/// <reference lib="webworker" />
import {
  isKeptMediaUrl,
  type MediaStatsReply,
  SW_CACHES,
} from "@green-goods/shared/modules/app/service-worker-protocol";
import type { BackgroundWork } from "./background-work";

const POLICY_URL = "/__gg_media_policy_v1__";
const STORED_AT_HEADER = "x-gg-stored-at";
const KEPT_HEADERS = ["content-type", "cache-control", "etag", "last-modified"];
const STORES_PER_SWEEP = 25;

export interface MediaPolicy {
  budgetBytes: number;
  keep: string[];
}

export interface SweepOptions extends Partial<MediaPolicy> {
  persistPolicy?: boolean;
}

export type MediaStats = Pick<MediaStatsReply, "bytes" | "count">;

interface MediaEntry {
  request: Request;
  url: string;
  bytes: number;
  storedAt: number;
}

/** Gateway photos, whole responses only: range requests bypass the cache. */
export function isMediaRequest(request: Request): boolean {
  if (request.method !== "GET" || request.headers.get("range")) return false;
  return isKeptMediaUrl(request.url);
}

function sizeOf(response: Response | undefined): number {
  return Number(response?.headers.get("content-length")) || 0;
}

function quotaError(): Error {
  const error = new Error("Offline photo budget is full");
  error.name = "QuotaExceededError";
  return error;
}

// Stored copies carry their own size and age, and no Vary header, so an <img>
// request and the app's download of the same URL always find each other.
async function storedCopy(response: Response) {
  const body = await response.blob();
  const headers = new Headers();
  for (const name of KEPT_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-length", String(body.size));
  headers.set(STORED_AT_HEADER, String(Date.now()));
  return { bytes: body.size, response: () => new Response(body, { status: 200, headers }) };
}

/**
 * The sized photo cache. Requests are answered first and stored afterwards,
 * writes are serialised, and the running byte total is kept between writes
 * so admitting one photo does not rescan every stored one.
 */
export class MediaCache {
  private policy?: MediaPolicy;
  private storesSinceSweep = 0;
  private storeTail: Promise<void> = Promise.resolve();
  /** Bytes in the cache after the last scan or accounted write; unknown after a failed write. */
  private knownBytes?: number;

  constructor(private readonly work: BackgroundWork) {}

  async respond(event: FetchEvent): Promise<Response> {
    const { request } = event;
    const url = request.url;
    const cache = await caches.open(SW_CACHES.MEDIA);
    const cached = await cache.match(url, { ignoreVary: true });
    if (cached) return cached;
    if (await caches.has(SW_CACHES.LEGACY_PREPARED_MEDIA)) {
      const legacyCache = await caches.open(SW_CACHES.LEGACY_PREPARED_MEDIA);
      const legacy = await legacyCache.match(url, { ignoreVary: true });
      if (legacy) {
        this.keepInBackground(event, url, legacy.clone());
        return legacy;
      }
    }
    let response: Response;
    try {
      response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        headers: { accept: request.headers.get("accept") || "*/*" },
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
      // A gateway without CORS still displays; it just is not kept for offline.
      return fetch(request);
    }
    if (response.status === 200) this.keepInBackground(event, url, response.clone());
    return response;
  }

  async writePolicy(policy: MediaPolicy): Promise<void> {
    this.policy = policy;
    await (await caches.open(SW_CACHES.MEDIA_POLICY)).put(
      POLICY_URL,
      new Response(JSON.stringify(policy), { headers: { "content-type": "application/json" } })
    );
  }

  async stats(): Promise<MediaStats> {
    const { entries, bytes } = await this.scan(await caches.open(SW_CACHES.MEDIA));
    return { bytes, count: entries.length };
  }

  // Oldest unprotected copies go first. Copies without a recorded size came
  // from an older worker, so they leave before any photo the app sized itself.
  async sweep(options: SweepOptions = {}): Promise<MediaStats> {
    const current = await this.readPolicy();
    const budgetBytes = options.budgetBytes ?? current.budgetBytes;
    const keep = options.keep ?? current.keep;
    if (options.persistPolicy) await this.writePolicy({ budgetBytes, keep });
    const cache = await caches.open(SW_CACHES.MEDIA);
    const { entries, bytes } = await this.scan(cache);
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
    this.knownBytes = total;
    return { bytes: total, count };
  }

  private keepInBackground(event: FetchEvent, url: string, response: Response): void {
    if (!this.work.isAccepting) return;
    event.waitUntil(this.work.track(this.schedule(url, response).catch(() => undefined)));
  }

  private schedule(url: string, response: Response): Promise<void> {
    const scheduled = this.storeTail.then(() => this.store(url, response));
    this.storeTail = scheduled.catch(() => undefined);
    return scheduled;
  }

  private async readPolicy(): Promise<MediaPolicy> {
    if (this.policy) return this.policy;
    try {
      const response = await (await caches.open(SW_CACHES.MEDIA_POLICY)).match(POLICY_URL);
      const stored = (response ? await response.json() : undefined) as
        | Partial<MediaPolicy>
        | undefined;
      if (
        stored &&
        typeof stored.budgetBytes === "number" &&
        Number.isFinite(stored.budgetBytes) &&
        stored.budgetBytes > 0 &&
        Array.isArray(stored.keep)
      ) {
        this.policy = { budgetBytes: stored.budgetBytes, keep: stored.keep.map(String) };
      }
    } catch {
      // The app sends the policy again on its next preparation run.
    }
    return this.policy ?? { budgetBytes: Number.POSITIVE_INFINITY, keep: [] };
  }

  private async scan(cache: Cache): Promise<{ entries: MediaEntry[]; bytes: number }> {
    const entries: MediaEntry[] = [];
    let bytes = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const size = sizeOf(response);
      const storedAt = Number(response?.headers.get(STORED_AT_HEADER)) || 0;
      entries.push({ request, url: request.url, bytes: size, storedAt });
      bytes += size;
    }
    this.knownBytes = bytes;
    return { entries, bytes };
  }

  private async store(url: string, response: Response): Promise<void> {
    const cache = await caches.open(SW_CACHES.MEDIA);
    const copy = await storedCopy(response);
    const policy = await this.readPolicy();
    const existingBytes = sizeOf(await cache.match(url, { ignoreVary: true }));
    const before = this.knownBytes ?? (await this.scan(cache)).bytes;
    if (before - existingBytes + copy.bytes > policy.budgetBytes) {
      // Keep the current copy until the replacement is proven admissible. Two
      // overlapping fetches for the same URL can otherwise evict a good copy
      // and then reject the larger replacement.
      const keepDuringAdmission = policy.keep.includes(url) ? policy.keep : [...policy.keep, url];
      const swept = await this.sweep({
        budgetBytes: Math.max(0, policy.budgetBytes - copy.bytes),
        keep: keepDuringAdmission,
      });
      const retainedBytes = sizeOf(await cache.match(url, { ignoreVary: true }));
      if (swept.bytes - retainedBytes + copy.bytes > policy.budgetBytes) throw quotaError();
    }
    const base = this.knownBytes ?? before;
    try {
      await cache.put(url, copy.response());
      this.knownBytes = base - existingBytes + copy.bytes;
    } catch (error) {
      this.knownBytes = undefined;
      if ((error as { name?: string })?.name !== "QuotaExceededError") throw error;
      await this.sweep({ budgetBytes: 0, keep: policy.keep });
      await cache.put(url, copy.response());
      this.knownBytes = undefined;
    }
    this.storesSinceSweep += 1;
    if (this.storesSinceSweep >= STORES_PER_SWEEP) {
      this.storesSinceSweep = 0;
      await this.sweep({ budgetBytes: policy.budgetBytes, keep: policy.keep });
    }
  }
}
