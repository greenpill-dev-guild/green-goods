import type { Garden } from "../../types/domain";
import { gardenMembership, isMyGarden } from "../garden/membership";

/** The photo cache removes its oldest unprotected copies above this size. */
export const OFFLINE_MEDIA_BUDGET_BYTES = 150 * 1024 * 1024;
/** Background refreshes skip lists fetched more recently than this. */
export const OFFLINE_REFRESH_MS = 15 * 60_000;

export interface OfflinePlan {
  /** Gardens whose work lists and details are kept offline, in download order. */
  lists: string[];
  /** The gardens whose photos are downloaded too, besides the account's own work. */
  photoGardens: string[];
}

/** The gardens the member is in, which decide whose photos are kept. */
export interface OfflineFocus {
  /** The garden on screen, which can be any garden. */
  gardenInView?: string;
}

const sameGarden = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/** The gardens whose photos are kept, in download order. */
export function offlinePhotoGardens({ gardenInView }: OfflineFocus): string[] {
  return gardenInView ? [gardenInView] : [];
}

/**
 * Tiered preparation: work lists, approvals and details for every garden that is
 * the account's own (`modules/garden/membership`), plus photos for the garden in
 * view and the account's own work. Garden identifiers keep the gardens list's
 * spelling, which is what the screens use in their query keys. Content is public,
 * so nothing here is keyed by account; the account only decides what comes first.
 */
export function planOfflineContent(
  gardens: Garden[],
  account: string,
  chainId: number,
  focus: OfflineFocus = {}
): OfflinePlan {
  const onChain = gardens.filter((garden) => garden.chainId === chainId);
  const joined = onChain
    .filter((garden) => isMyGarden(gardenMembership(garden, account)))
    .map((garden) => garden.id);
  const photoGardens = offlinePhotoGardens(focus).map(
    (photoGarden) => onChain.find((garden) => sameGarden(garden.id, photoGarden))?.id ?? photoGarden
  );
  const others = joined.filter(
    (id) => !photoGardens.some((photoGarden) => sameGarden(photoGarden, id))
  );
  return { lists: [...photoGardens, ...others], photoGardens };
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
