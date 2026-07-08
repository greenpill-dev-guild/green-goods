import { PWA_MANIFEST_ID } from "./pwa-routing";

export type PwaManifestFlavor = "production" | "staging";

export interface PwaManifestIcon {
  src: string;
  sizes: string;
  type: "image/png";
  purpose?: "any" | "maskable";
}

export interface PwaAppleTouchIcon {
  sizes: string;
  src: string;
}

export interface PwaManifestBranding {
  flavor: PwaManifestFlavor;
  manifestId: string;
  name: string;
  shortName: string;
  description?: string;
  themeColor: string;
  backgroundColor: string;
  htmlThemeColorLight: string;
  htmlThemeColorDark: string;
  msTileColor: string;
  msTileImage: string;
  browserIcon: string;
  shortcutIcon: string;
  appleTouchIcons: PwaAppleTouchIcon[];
  manifestIcons: PwaManifestIcon[];
  includeAssets: string[];
}

const COMMON_PWA_ASSETS = ["favicon.ico"];
const STAGING_MANIFEST_ID = "/?gg_pwa=staging";
const STAGING_DARK_SURFACE = "#111b13";

const PRODUCTION_APPLE_TOUCH_ICONS: PwaAppleTouchIcon[] = [
  { sizes: "57x57", src: "images/apple-icon-57x57.png" },
  { sizes: "60x60", src: "images/apple-icon-60x60.png" },
  { sizes: "72x72", src: "images/apple-icon-72x72.png" },
  { sizes: "120x120", src: "images/apple-icon-120x120.png" },
  { sizes: "144x144", src: "images/apple-icon-144x144.png" },
  { sizes: "180x180", src: "apple-icon.png" },
];

const STAGING_APPLE_TOUCH_ICONS: PwaAppleTouchIcon[] = [
  { sizes: "57x57", src: "images/staging-apple-icon-57x57.png" },
  { sizes: "60x60", src: "images/staging-apple-icon-60x60.png" },
  { sizes: "72x72", src: "images/staging-apple-icon-72x72.png" },
  { sizes: "120x120", src: "images/staging-apple-icon-120x120.png" },
  { sizes: "144x144", src: "images/staging-apple-icon-144x144.png" },
  { sizes: "180x180", src: "staging-apple-icon.png" },
];

const PRODUCTION_MANIFEST_ICONS: PwaManifestIcon[] = [
  { src: "images/android-icon-72x72.png", sizes: "72x72", type: "image/png" },
  { src: "images/android-icon-144x144.png", sizes: "144x144", type: "image/png" },
  { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "maskable-icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

const STAGING_MANIFEST_ICONS: PwaManifestIcon[] = [
  { src: "images/staging-android-icon-72x72.png", sizes: "72x72", type: "image/png" },
  { src: "images/staging-android-icon-144x144.png", sizes: "144x144", type: "image/png" },
  { src: "staging-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "staging-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "staging-maskable-icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

const PRODUCTION_INCLUDE_ASSETS = [
  ...COMMON_PWA_ASSETS,
  "apple-icon.png",
  "icon-192.png",
  "icon.png",
  "icon-512.png",
  "maskable-icon-512.png",
  "images/android-icon-36x36.png",
  "images/android-icon-48x48.png",
  "images/android-icon-72x72.png",
  "images/android-icon-144x144.png",
  ...PRODUCTION_APPLE_TOUCH_ICONS.filter((icon) => icon.sizes !== "180x180").map(
    (icon) => icon.src
  ),
  "images/ms-icon-70x70.png",
  "images/ms-icon-144x144.png",
  "images/ms-icon-310x310.png",
];

const STAGING_INCLUDE_ASSETS = [
  ...COMMON_PWA_ASSETS,
  "staging-apple-icon.png",
  "staging-icon-192.png",
  "staging-icon.png",
  "staging-icon-512.png",
  "staging-maskable-icon-512.png",
  "images/staging-android-icon-36x36.png",
  "images/staging-android-icon-48x48.png",
  "images/staging-android-icon-72x72.png",
  "images/staging-android-icon-144x144.png",
  ...STAGING_APPLE_TOUCH_ICONS.filter((icon) => icon.sizes !== "180x180").map((icon) => icon.src),
  "images/staging-ms-icon-70x70.png",
  "images/staging-ms-icon-144x144.png",
  "images/staging-ms-icon-310x310.png",
];

function normalizeFlavor(value: string | undefined): PwaManifestFlavor | undefined {
  const flavor = value?.trim().toLowerCase();
  if (!flavor) return undefined;
  if (["staging", "stage", "stg", "qa"].includes(flavor)) return "staging";
  if (["production", "prod"].includes(flavor)) return "production";
  return undefined;
}

export function resolvePwaManifestFlavor(
  env: Record<string, string | undefined>
): PwaManifestFlavor {
  const explicitFlavor =
    normalizeFlavor(env.PWA_MANIFEST_FLAVOR) ||
    normalizeFlavor(env.VITE_PWA_MANIFEST_FLAVOR) ||
    normalizeFlavor(env.GG_PWA_MANIFEST_FLAVOR);

  if (explicitFlavor) return explicitFlavor;

  const deploymentFlavor =
    normalizeFlavor(env.VERCEL_TARGET_ENV) ||
    normalizeFlavor(env.VITE_VERCEL_TARGET_ENV) ||
    normalizeFlavor(env.SENTRY_ENVIRONMENT) ||
    normalizeFlavor(env.VITE_SENTRY_ENVIRONMENT) ||
    normalizeFlavor(env.APP_ENV) ||
    normalizeFlavor(env.VITE_APP_ENV);

  return deploymentFlavor === "staging" ? "staging" : "production";
}

export function createPwaManifestBranding(flavor: PwaManifestFlavor): PwaManifestBranding {
  if (flavor === "staging") {
    return {
      flavor,
      manifestId: STAGING_MANIFEST_ID,
      name: "Green Goods Staging",
      shortName: "GG Staging",
      description: "Staging PWA for Green Goods QA.",
      themeColor: STAGING_DARK_SURFACE,
      backgroundColor: STAGING_DARK_SURFACE,
      htmlThemeColorLight: STAGING_DARK_SURFACE,
      htmlThemeColorDark: STAGING_DARK_SURFACE,
      msTileColor: STAGING_DARK_SURFACE,
      msTileImage: "images/staging-ms-icon-144x144.png",
      browserIcon: "staging-icon-192.png",
      shortcutIcon: "staging-icon-192.png",
      appleTouchIcons: STAGING_APPLE_TOUCH_ICONS,
      manifestIcons: STAGING_MANIFEST_ICONS,
      includeAssets: STAGING_INCLUDE_ASSETS,
    };
  }

  return {
    flavor,
    manifestId: PWA_MANIFEST_ID,
    name: "Green Goods",
    shortName: "Green Goods",
    themeColor: "#fff",
    backgroundColor: "#fff",
    htmlThemeColorLight: "#ffffff",
    htmlThemeColorDark: "#171717",
    msTileColor: "#ffffff",
    msTileImage: "images/ms-icon-144x144.png",
    browserIcon: "icon-192.png",
    shortcutIcon: "icon-192.png",
    appleTouchIcons: PRODUCTION_APPLE_TOUCH_ICONS,
    manifestIcons: PRODUCTION_MANIFEST_ICONS,
    includeAssets: PRODUCTION_INCLUDE_ASSETS,
  };
}
