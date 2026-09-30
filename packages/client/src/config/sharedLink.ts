import { PWA_APP_ENTRY_PATH } from "./pwaRouting";

const PENDING_LINK_KEY = "gg-pending-shared-link";
const PENDING_LINK_TTL = 60 * 60 * 1000;
const RECORD_PATH = /^\/(home|gardens)\/(0x[\da-f]{40})(?:\/work\/(0x[\da-f]{64}))?\/?$/i;

/** Only record routes can cross the browser/install boundary; never arbitrary redirects. */
export function getSharedRecordPath(pathname: string, surface: "home" | "gardens"): string | null {
  const match = RECORD_PATH.exec(pathname);
  if (!match) return null;
  return `/${surface}/${match[2]}${match[3] ? `/work/${match[3]}` : ""}`;
}

export function rememberSharedLink(pathname: string): void {
  const path = getSharedRecordPath(pathname, "home");
  if (!path) return;
  try {
    localStorage.setItem(
      PENDING_LINK_KEY,
      JSON.stringify({ path, expiresAt: Date.now() + PENDING_LINK_TTL })
    );
  } catch {
    // The explicit record link remains usable when storage is unavailable.
  }
}

export function takePendingSharedLink(): string | null {
  try {
    const value = localStorage.getItem(PENDING_LINK_KEY);
    localStorage.removeItem(PENDING_LINK_KEY);
    if (!value) return null;
    const pending = JSON.parse(value);
    if (typeof pending.expiresAt !== "number" || pending.expiresAt <= Date.now()) return null;
    return typeof pending.path === "string" ? getSharedRecordPath(pending.path, "home") : null;
  } catch {
    return null;
  }
}

export function getSharedLinkLaunchPath(pathname: string): string {
  return getSharedRecordPath(pathname, "home") ?? PWA_APP_ENTRY_PATH;
}

/** Build a document navigation, including when the route itself lives in a fragment. */
export function createSharedLinkLaunchUrl(
  pathname: string,
  source: string,
  hashRouter: boolean
): string {
  const url = new URL(source);
  if (!hashRouter) return new URL(pathname, url.origin).href;
  const previousLaunch = url.searchParams.get("pwaLaunch");
  url.search = "";
  // A fragment-only change leaves the public router mounted. Change the document
  // URL as well, even when returning from an earlier app-opening attempt.
  url.searchParams.set("pwaLaunch", previousLaunch === "1" ? "0" : "1");
  url.hash = pathname === PWA_APP_ENTRY_PATH ? "/home" : pathname;
  return url.href;
}
