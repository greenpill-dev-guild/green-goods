import type { Address } from "@green-goods/shared/types/domain";

/**
 * Curated content for the public browser editorial homepage.
 *
 * Curation uses Garden ids/addresses as canonical keys; slugs are display/
 * routing aliases only because they derive from mutable Garden names. If a
 * curated id/address is missing from live data, fall back to recent active
 * Gardens via `usePublicGardens`.
 *
 * Contact configuration only carries the public Agent subscription path and
 * the Google appointment booking URL — Luma calendar/tag/provider details
 * stay server-side in `packages/agent`.
 */

export type CuratedGardenKey = string | Address;

/** Browser-mode views that get their own hero image when curated. */
export type PublicCurationViewKey =
  | "gardens"
  | "impact"
  | "fund"
  | "vaults"
  | "actions"
  | "cookies";

export interface PublicCuration {
  /** Ordered featured garden keys (id or address) for the lead-plus-two layout. */
  featuredGardens: readonly CuratedGardenKey[];
  /** Plain-language editorial summaries, keyed by the canonical Garden address. */
  gardenDescriptionIds: Readonly<Record<string, string>>;
  /** Curated local hero image path (relative to /public). Falls back if missing. */
  heroImagePath: string;
  /**
   * Per-view hero image overrides. When a view's key is set, that view uses
   * its own image; otherwise everyone falls back to `heroImagePath`. Drop
   * curated images into `packages/client/public/images/` and wire them here.
   */
  viewHeroImages: Partial<Record<PublicCurationViewKey, string>>;
  /** Fallback image set used when curated image fails to load. */
  fallbackImagePaths: readonly string[];
  /** Public Agent route for email subscription. */
  subscribeRoute: string;
  /** Google appointment booking URL for "Schedule a Call". */
  appointmentUrl: string;
}

export const publicCuration: PublicCuration = {
  featuredGardens: [
    "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3", // TAS HUB
    "0x51499A44BB7793647e67ed827bd17367d7e55314", // GreenSofa
    "0x26c32E54F23af9F9fcC757414c76E56e3fB176E2", // Vida Verde
    "0xFDa72CE1D75b735d6595E5814DDF23b97516caEf", // Rifai Sicilia
  ],
  gardenDescriptionIds: {
    "0xa2df8eb73444a3f3cf9b8e3749313c7471d7d5e3": "public.gardenNarrative.tas",
    "0x51499a44bb7793647e67ed827bd17367d7e55314": "public.gardenNarrative.greensofa",
    "0x26c32e54f23af9f9fcc757414c76e56e3fb176e2": "public.gardenNarrative.vida",
    "0xfda72ce1d75b735d6595e5814ddf23b97516caef": "public.gardenNarrative.rifai",
  },
  heroImagePath: "/images/hero-home.webp",
  viewHeroImages: {
    gardens: "/images/hero-garden.webp",
    impact: "/images/hero-impact.webp",
    fund: "/images/hero-fund.webp",
    vaults: "/images/hero-fund.webp",
    actions: "/images/hero-actions.webp",
    cookies: "/images/hero-cookie.webp",
  },
  fallbackImagePaths: ["/images/no-image-placeholder.png"],
  subscribeRoute: "/public/subscribe",
  appointmentUrl: import.meta.env.VITE_GOOGLE_APPOINTMENT_URL || "",
} as const;

/**
 * Returns the hero image for a given browser-mode view, falling back to the
 * shared `heroImagePath` when no per-view override exists.
 */
export function getPublicHeroImage(view: PublicCurationViewKey): string {
  return publicCuration.viewHeroImages[view] ?? publicCuration.heroImagePath;
}
