import type { Plugin } from "vite";

export const SUPPORTED_BROWSER_TARGETS: readonly string[];

export interface BrowserMinimumGateOptions {
  /** "hub" gates every page; "client" gates the installed App and the reporting pages. */
  surface: "hub" | "client";
  /** The image the update screen shows, as a URL the page can load. */
  logo: string;
  /** The surface's PostHog project key; without one the screen sends nothing. */
  posthogKey?: string;
}

export function browserMinimumGateScript(options: BrowserMinimumGateOptions): string;
export function browserMinimumGatePlugin(options: BrowserMinimumGateOptions): Plugin;
