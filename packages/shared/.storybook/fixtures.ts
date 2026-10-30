/**
 * Storybook fixture helpers.
 *
 * Deterministic values used across admin stories. Never read wall-clock
 * time, never point at external media (picsum.photos, ipfs://, etc).
 * Changing a value here should regenerate every dependent story in the
 * same way every run.
 */
import AGROFORESTRY_JPEG from "./fixture-art/agroforestry-coffee.jpg?inline";
import COMMUNITY_GARDEN_JPEG from "./fixture-art/community-garden.jpg?inline";
import COMPOST_JPEG from "./fixture-art/compost-bins.jpg?inline";
import OUTDOOR_CLASSROOM_JPEG from "./fixture-art/outdoor-classroom.jpg?inline";
import SOLAR_JPEG from "./fixture-art/solar-array.jpg?inline";
import SUNFLOWER_JPEG from "./fixture-art/sunflower.jpg?inline";

/**
 * Fixed "now" for every Storybook render. Picked so relative-time
 * helpers ("2 hours ago", "Jan 16, 2026") format predictably in
 * snapshots and visual review. 2026-01-16T00:00:00.000Z.
 * Verify: `new Date(1_768_521_600 * 1000).toISOString()`.
 */
export const STORYBOOK_NOW_SECONDS = 1_768_521_600; // 2026-01-16T00:00:00.000Z

/**
 * Subtract `hoursAgo` from the fixed Storybook clock. Returns a Unix
 * timestamp in seconds so domain helpers (`formatRelativeTime`,
 * `formatDate`) can consume it directly.
 */
export function hoursAgo(hoursAgo: number): number {
  return STORYBOOK_NOW_SECONDS - hoursAgo * 3_600;
}

export function daysAgo(daysAgo: number): number {
  return STORYBOOK_NOW_SECONDS - daysAgo * 86_400;
}

/**
 * Return a Unix timestamp `days` ahead of the fixed Storybook clock.
 * Use for expiry fixtures (marketplace listings, action end times)
 * that need to still be "active" when the component compares against
 * `Date.now()` — which is itself frozen to the Storybook clock via
 * `installFrozenClock()` in `decorators.tsx`.
 */
export function daysFromNow(days: number): number {
  return STORYBOOK_NOW_SECONDS + days * 86_400;
}

/**
 * Deterministic fixture images: small public-domain and CC0 photos, inlined
 * as data URLs so stories stay offline and draw the same every run. Sources
 * and licenses are in `fixture-art/LICENSES.md`.
 */
export const FIXTURE_IMAGE_AGROFORESTRY = AGROFORESTRY_JPEG;
export const FIXTURE_IMAGE_SOLAR = SOLAR_JPEG;
export const FIXTURE_IMAGE_EDU = OUTDOOR_CLASSROOM_JPEG;
export const FIXTURE_IMAGE_WASTE = COMPOST_JPEG;
export const FIXTURE_IMAGE_BANNER = COMMUNITY_GARDEN_JPEG;
export const FIXTURE_IMAGE_PROFILE = SUNFLOWER_JPEG;

/** Fixed media URLs array, keyed by index for stable `key` props. */
export const FIXTURE_WORK_MEDIA = [
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_SOLAR,
  FIXTURE_IMAGE_EDU,
  FIXTURE_IMAGE_WASTE,
];
