import type { Address } from "@green-goods/shared";

/**
 * Curated content for the public browser editorial homepage.
 *
 * Curation uses Garden ids/addresses as canonical keys; slugs are display/
 * routing aliases only because they derive from mutable Garden names. If a
 * curated id/address is missing from live data, fall back to recent active
 * Gardens via `usePublicGardens`.
 *
 * Contact configuration only carries the public Agent subscription path and
 * the Google appointment booking URL; provider details stay server-side in
 * `packages/agent`.
 */

export type CuratedGardenKey = string | Address;

/** Browser-mode views that get their own hero image when curated. */
export type PublicCurationViewKey = "gardens" | "impact" | "fund" | "actions" | "cookies";

export interface PublicCuration {
  /** Ordered featured garden keys (id or address) for the lead-plus-two layout. */
  featuredGardens: readonly CuratedGardenKey[];
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

const fallbackAppointmentUrl = "https://calendar.app.google/" as const;

export const publicCuration: PublicCuration = {
  featuredGardens: [],
  heroImagePath: "/images/hero-home.webp",
  viewHeroImages: {
    gardens: "/images/hero-garden.webp",
    impact: "/images/hero-impact.webp",
    fund: "/images/hero-fund.webp",
    actions: "/images/hero-actions.webp",
    cookies: "/images/hero-cookie.webp",
  },
  fallbackImagePaths: ["/images/no-image-placeholder.png"],
  subscribeRoute: "/public/subscribe",
  appointmentUrl: import.meta.env.VITE_GOOGLE_APPOINTMENT_URL || fallbackAppointmentUrl,
} as const;

/**
 * Returns the hero image for a given browser-mode view, falling back to the
 * shared `heroImagePath` when no per-view override exists.
 */
export function getPublicHeroImage(view: PublicCurationViewKey): string {
  return publicCuration.viewHeroImages[view] ?? publicCuration.heroImagePath;
}
