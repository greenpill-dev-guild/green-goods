import type { Garden } from "../../types/domain";

export const OFFLINE_READING_BUDGET = 150 * 1024 * 1024;
export const OFFLINE_MEDIA_CACHE = "gg-prepared-media-v1";
export const OFFLINE_REFRESH_MS = 5 * 60_000;
export type GardenVisit = { address: string; chainId: number; visitedAt: number };
export type PreparationTarget = GardenVisit & { limit: number; priority: number };

/** Stable priorities also own eviction order; no work history of the catalogue is read. */
export function selectPreparationTargets(
  gardens: Garden[],
  account: string,
  chainId: number,
  visits: GardenVisit[],
  active?: string
): PreparationTarget[] {
  const joined = gardens.filter(
    (garden) =>
      garden.chainId === chainId &&
      [...garden.gardeners, ...garden.stewards, ...garden.owners].some(
        (address) => address.toLowerCase() === account.toLowerCase()
      )
  );
  const byRecent = (a: GardenVisit, b: GardenVisit) =>
    b.visitedAt - a.visitedAt || a.address.localeCompare(b.address);
  const visitById = new Map(
    visits.filter((v) => v.chainId === chainId).map((v) => [v.address.toLowerCase(), v])
  );
  const joinedIds = new Set(joined.map((g) => g.id.toLowerCase()));
  const targets = joined.map((garden) => ({
    address: garden.id,
    chainId,
    visitedAt: visitById.get(garden.id.toLowerCase())?.visitedAt ?? 0,
    limit: 50,
    priority: 1,
  }));
  targets.push(
    ...[...visitById.values()]
      .filter((v) => !joinedIds.has(v.address.toLowerCase()))
      .sort(byRecent)
      .slice(0, 5)
      .map((v) => ({ ...v, limit: 20, priority: 2 }))
  );
  return targets
    .map((target) => ({
      ...target,
      priority: target.address.toLowerCase() === active?.toLowerCase() ? 0 : target.priority,
    }))
    .sort((a, b) => a.priority - b.priority || byRecent(a, b));
}

/** Match the same display variant the image component actually requests. */
export function displayImageUrl(url: string): string {
  try {
    const parsed = new URL(
      url,
      typeof location === "undefined" ? "https://green-goods.local" : location.origin
    );
    if (parsed.hostname.endsWith(".mypinata.cloud")) {
      parsed.searchParams.set("img-width", "800");
      parsed.searchParams.set("img-format", "auto");
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function serializeReadingData(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry
  );
}
export async function hashReadingData(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(serializeReadingData(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
