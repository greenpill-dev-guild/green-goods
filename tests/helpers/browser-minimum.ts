import type { Page } from "@playwright/test";

/** The update screen's English title (scripts/lib/browser-minimum-gate.js). */
export const UPDATE_SCREEN_TITLE = "Update your browser to use Green Goods";

/**
 * Makes this Chromium read as Chrome 101 to the browser minimum gate, before any page script
 * runs: no color-mix(), no range media queries and no String.prototype.isWellFormed, while
 * registered custom properties stay, as Chrome 101 has them. PRD-1490's steward phone ran 101.
 */
export async function emulateChrome101(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS) as (...args: string[]) => boolean;
    CSS.supports = ((...args: string[]) =>
      args.join(" ").includes("color-mix(") ? false : supports(...args)) as typeof CSS.supports;

    const matchMedia = window.matchMedia.bind(window);
    // A browser without range syntax reads a range query as "not all".
    window.matchMedia = (query: string) =>
      /[<>]/.test(query) ? matchMedia("not all") : matchMedia(query);

    delete (String.prototype as { isWellFormed?: unknown }).isWellFormed;
  });
}
