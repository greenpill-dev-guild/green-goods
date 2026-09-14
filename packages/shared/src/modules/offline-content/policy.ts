import type { Garden } from "../../types/domain";

/** The photo cache removes its oldest unprotected copies above this size. */
export const OFFLINE_MEDIA_BUDGET_BYTES = 150 * 1024 * 1024;
/** Background refreshes skip lists and approvals fetched more recently than this. */
export const OFFLINE_REFRESH_MS = 15 * 60_000;

export interface OfflinePlan {
  /** Gardens whose work lists and details are kept offline, in download order. */
  lists: string[];
  /** The garden whose photos are downloaded too, besides the account's own work. */
  photoGarden?: string;
}

/**
 * Tiered preparation: work lists, approvals and details for every garden the
 * account belongs to, plus photos for the garden in view and the account's own
 * work. Garden identifiers keep the gardens list's spelling, which is what the
 * screens use in their query keys. Content is public, so nothing here is keyed
 * by account; the account only decides what comes first.
 */
export function planOfflineContent(
  gardens: Garden[],
  account: string,
  chainId: number,
  activeGarden?: string
): OfflinePlan {
  const member = account.toLowerCase();
  const onChain = gardens.filter((garden) => garden.chainId === chainId);
  const joined = onChain
    .filter((garden) =>
      [...garden.gardeners, ...garden.stewards, ...garden.owners].some(
        (address) => address.toLowerCase() === member
      )
    )
    .map((garden) => garden.id);
  const active = activeGarden
    ? (onChain.find((garden) => garden.id.toLowerCase() === activeGarden.toLowerCase())?.id ??
      activeGarden)
    : undefined;
  if (!active) return { lists: joined };
  const others = joined.filter((id) => id.toLowerCase() !== active.toLowerCase());
  return { lists: [active, ...others], photoGarden: active };
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
