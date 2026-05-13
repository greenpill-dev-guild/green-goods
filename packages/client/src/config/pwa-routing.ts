export const PWA_MANIFEST_ID = "/";
export const PWA_APP_SCOPE = "/home";
export const PWA_IPFS_SCOPE = "./";

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

export const PUBLIC_PWA_LAUNCH_URL = `https://www.greengoods.app${APP_ROUTES.home}`;

export interface PwaRoutingConfig {
  assetBasePath: "/" | "./";
  manifestId: typeof PWA_MANIFEST_ID;
  manifestScope: typeof PWA_APP_SCOPE | typeof PWA_IPFS_SCOPE;
  serviceWorkerScriptUrl: "/sw.js" | "./sw.js";
  startUrl: string;
  shortcutUrl: (path: string) => string;
}

export function createPwaRoutingConfig(isIPFSBuild: boolean): PwaRoutingConfig {
  const shortcutUrl = (path: string) => (isIPFSBuild ? `./#${path}` : path);

  return {
    assetBasePath: isIPFSBuild ? "./" : "/",
    manifestId: PWA_MANIFEST_ID,
    manifestScope: isIPFSBuild ? PWA_IPFS_SCOPE : PWA_APP_SCOPE,
    serviceWorkerScriptUrl: isIPFSBuild ? "./sw.js" : "/sw.js",
    startUrl: shortcutUrl(APP_ROUTES.home),
    shortcutUrl,
  };
}
