/**
 * Storybook fixture helpers.
 *
 * Deterministic values used across admin stories. Never read wall-clock
 * time, never point at external media (picsum.photos, ipfs://, etc).
 * Changing a value here should regenerate every dependent story in the
 * same way every run.
 */

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
 * Earth-tone square SVG encoded as a data URL. Used for Story image
 * fixtures so everything is offline, deterministic, and small.
 */
function makeDataUrl(fill: string, accent: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
  <rect width='120' height='120' fill='${fill}' />
  <circle cx='60' cy='52' r='22' fill='${accent}' />
  <path d='M20 100 Q60 70 100 100 L100 120 L20 120 Z' fill='${accent}' fill-opacity='0.75' />
  <text x='60' y='112' text-anchor='middle' font-family='sans-serif' font-size='9' fill='#ffffff' font-weight='600'>${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Deterministic fixture images. */
export const FIXTURE_IMAGE_AGROFORESTRY = makeDataUrl("#d9ead3", "#6aaa64", "Agroforestry");
export const FIXTURE_IMAGE_SOLAR = makeDataUrl("#fff2cc", "#e6a700", "Solar");
export const FIXTURE_IMAGE_EDU = makeDataUrl("#d0e6ff", "#3d7abf", "Education");
export const FIXTURE_IMAGE_WASTE = makeDataUrl("#f3d1c7", "#c04a1e", "Waste");
export const FIXTURE_IMAGE_BANNER = makeDataUrl("#f1ead2", "#7a8a6b", "Garden");

/** Fixed media URLs array, keyed by index for stable `key` props. */
export const FIXTURE_WORK_MEDIA = [
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_SOLAR,
  FIXTURE_IMAGE_EDU,
  FIXTURE_IMAGE_WASTE,
];
