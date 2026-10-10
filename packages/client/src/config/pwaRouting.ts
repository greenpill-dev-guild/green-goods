export const PWA_MANIFEST_ID = "/";
// Include the existing /home route as well as its /home/ descendants.
export const PWA_APP_SCOPE = "/home";
export const PWA_APP_ENTRY_PATH = "/home/";
const PWA_IPFS_SCOPE = "./";
/**
 * URL vite-plugin-pwa serves the worker from in dev, transformed from src/sw as
 * an ES module. The production worker lives at /sw.js; in dev that path returns
 * index.html, so registering it throws an "unsupported MIME type" error.
 */
export const PWA_DEV_SERVICE_WORKER_SCRIPT = "/dev-sw.js?dev-sw";

export const APP_ROUTES = {
  home: "/home",
  login: "/home/login",
  garden: "/home/garden",
  profile: "/home/profile",
} as const;

export const LEGACY_APP_ROUTES = {
  login: "/login",
  garden: "/garden",
  profile: "/profile",
} as const;

/** The /home children that are tabs or the login rather than a garden's id. */
const HOME_TAB_SEGMENTS: ReadonlySet<string> = new Set(
  [APP_ROUTES.login, APP_ROUTES.garden, APP_ROUTES.profile].map((route) =>
    route.slice(APP_ROUTES.home.length + 1)
  )
);

/**
 * Whether a route owns its chrome, so the bottom AppBar never shows there: the
 * work submission flow, and a garden's pages (`/home/:id/**`), whose banner
 * carries back and whose work, promise and proof pages carry their own fixed
 * bars exactly where the nav would sit.
 */
export function isImmersiveAppRoute(pathname: string): boolean {
  const isWithin = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  if (isWithin(APP_ROUTES.garden) || isWithin(LEGACY_APP_ROUTES.garden)) return true;
  if (!pathname.startsWith(`${APP_ROUTES.home}/`)) return false;
  const segment = pathname.slice(APP_ROUTES.home.length + 1).split("/")[0];
  return segment !== "" && !HOME_TAB_SEGMENTS.has(segment);
}

export const PUBLIC_PWA_ORIGIN = "https://www.greengoods.app";

export function createPwaLaunchUrl(origin: string): string {
  return new URL(PWA_APP_ENTRY_PATH, origin).toString();
}

export const PUBLIC_PWA_LAUNCH_URL = createPwaLaunchUrl(PUBLIC_PWA_ORIGIN);

export interface PwaRoutingConfig {
  assetBasePath: "/" | "./";
  manifestId: typeof PWA_MANIFEST_ID;
  manifestScope: typeof PWA_APP_SCOPE | typeof PWA_IPFS_SCOPE;
  /**
   * The manifest's own URL as `related_applications` should declare it, relative to
   * the manifest so it resolves to whichever host served it. Chromium answers
   * `navigator.getInstalledRelatedApps()` for the page's own WebAPK only when this
   * equals the manifest URL it fetched; an absolute production URL left every
   * beta, preview, and tunnel host reporting its installed app as absent.
   */
  relatedApplicationManifestUrl: "/manifest.webmanifest" | "./manifest.webmanifest";
  serviceWorkerScriptUrl: "/sw.js" | "./sw.js";
  startUrl: string;
  shortcutUrl: (path: string) => string;
}

export function createPwaRoutingConfig(isIPFSBuild: boolean): PwaRoutingConfig {
  const shortcutUrl = (path: string) =>
    isIPFSBuild ? `./#${path}` : path === APP_ROUTES.home ? PWA_APP_ENTRY_PATH : path;

  return {
    assetBasePath: isIPFSBuild ? "./" : "/",
    manifestId: PWA_MANIFEST_ID,
    manifestScope: isIPFSBuild ? PWA_IPFS_SCOPE : PWA_APP_SCOPE,
    relatedApplicationManifestUrl: isIPFSBuild ? "./manifest.webmanifest" : "/manifest.webmanifest",
    serviceWorkerScriptUrl: isIPFSBuild ? "./sw.js" : "/sw.js",
    startUrl: shortcutUrl(APP_ROUTES.home),
    shortcutUrl,
  };
}
