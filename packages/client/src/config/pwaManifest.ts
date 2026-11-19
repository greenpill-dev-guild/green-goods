import designTokens from "@green-goods/shared/styles/design-md.generated.json";
import { PWA_MANIFEST_ID } from "./pwaRouting";

type PwaManifestFlavor = "production" | "staging" | "alpha";

interface PwaManifestIcon {
  src: string;
  sizes: string;
  type: "image/png";
  purpose?: "any" | "maskable";
}

interface PwaAppleTouchIcon {
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
  /** The status bar tint per scheme on the website, which paints white. */
  htmlThemeColorLight: string;
  htmlThemeColorDark: string;
  /** The status bar tint per scheme in the installed app, which paints its own ground. */
  appThemeColorLight: string;
  appThemeColorDark: string;
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
const ALPHA_MANIFEST_ID = "/?gg_pwa=alpha";
const STAGING_DARK_SURFACE = "#111b13";
/** The Vercel branch that serves alpha.greengoods.app; its builds always carry the alpha branding. */
const ALPHA_BRANCH = "alpha";
// The installed app's ground, serialized from the DesignMD canvas tokens: the
// linen canvas and the warm dark floor that shared theme.css paints as the app's
// bg-canvas in each theme.
const APP_GROUND_LIGHT = designTokens.colors.neutral;
const APP_GROUND_DARK = designTokens.colors["neutral-dark"];

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

// Alpha's icons are beta's artwork with the gold dot turned blue, under the same file layout.
const toAlphaAsset = (src: string) => src.replace("staging-", "alpha-");
const ALPHA_APPLE_TOUCH_ICONS = STAGING_APPLE_TOUCH_ICONS.map((icon) => ({
  ...icon,
  src: toAlphaAsset(icon.src),
}));
const ALPHA_MANIFEST_ICONS = STAGING_MANIFEST_ICONS.map((icon) => ({
  ...icon,
  src: toAlphaAsset(icon.src),
}));
const ALPHA_INCLUDE_ASSETS = STAGING_INCLUDE_ASSETS.map(toAlphaAsset);

function normalizeFlavor(value: string | undefined): PwaManifestFlavor | undefined {
  const flavor = value?.trim().toLowerCase();
  if (!flavor) return undefined;
  if (["staging", "stage", "stg", "qa"].includes(flavor)) return "staging";
  if (["production", "prod"].includes(flavor)) return "production";
  if (flavor === "alpha") return "alpha";
  return undefined;
}

// Deployment signals choose only between beta and production, as they did before alpha: alpha comes
// from an explicit flavor or the alpha branch, so an `alpha` here falls through to the next signal.
function normalizeDeploymentFlavor(value: string | undefined): PwaManifestFlavor | undefined {
  const flavor = normalizeFlavor(value);
  return flavor === "alpha" ? undefined : flavor;
}

export function resolvePwaManifestFlavor(
  env: Record<string, string | undefined>
): PwaManifestFlavor {
  const explicitFlavor =
    normalizeFlavor(env.PWA_MANIFEST_FLAVOR) ||
    normalizeFlavor(env.VITE_PWA_MANIFEST_FLAVOR) ||
    normalizeFlavor(env.GG_PWA_MANIFEST_FLAVOR);

  if (explicitFlavor) return explicitFlavor;

  // Vercel calls an alpha build a preview, so its branch is the only deployment signal it has.
  if (env.VERCEL_GIT_COMMIT_REF === ALPHA_BRANCH) return "alpha";

  const deploymentFlavor =
    normalizeDeploymentFlavor(env.VERCEL_TARGET_ENV) ||
    normalizeDeploymentFlavor(env.VITE_VERCEL_TARGET_ENV) ||
    normalizeDeploymentFlavor(env.SENTRY_ENVIRONMENT) ||
    normalizeDeploymentFlavor(env.VITE_SENTRY_ENVIRONMENT) ||
    normalizeDeploymentFlavor(env.APP_ENV) ||
    normalizeDeploymentFlavor(env.VITE_APP_ENV);

  return deploymentFlavor === "staging" ? "staging" : "production";
}

export function createPwaManifestBranding(flavor: PwaManifestFlavor): PwaManifestBranding {
  if (flavor === "alpha") {
    return {
      ...createPwaManifestBranding("staging"),
      flavor,
      // Its own install identity, so alpha installs beside beta and production on one phone.
      manifestId: ALPHA_MANIFEST_ID,
      name: "Green Goods Alpha",
      // Beta's home-screen label is plain, so this one names alpha to tell the two apart.
      shortName: "GG Alpha",
      description: "Green Goods Alpha: Experiments shared with a few testers before beta",
      msTileImage: toAlphaAsset("images/staging-ms-icon-144x144.png"),
      browserIcon: toAlphaAsset("staging-icon-192.png"),
      shortcutIcon: toAlphaAsset("staging-icon-192.png"),
      appleTouchIcons: ALPHA_APPLE_TOUCH_ICONS,
      manifestIcons: ALPHA_MANIFEST_ICONS,
      includeAssets: ALPHA_INCLUDE_ASSETS,
    };
  }

  if (flavor === "staging") {
    return {
      flavor,
      // The staging build is what we hand to beta users, so it reads as the
      // product rather than announcing itself as a QA surface. The full name
      // carries the Beta label wherever there is room for it; `shortName` is
      // the home-screen label and stays plain, with the dark green below doing
      // the distinguishing in the one place the text is truncated anyway.
      //
      // `manifestId` deliberately still says staging. It is the identity the
      // OS keys an installed app on, is never shown to anyone, and changing it
      // orphans every phone that already has this app: the rename would arrive
      // as a second icon beside the old one instead of updating in place.
      manifestId: STAGING_MANIFEST_ID,
      name: "Green Goods Beta",
      shortName: "Green Goods",
      description: "Green Goods Beta: Try and test new features before release",
      themeColor: STAGING_DARK_SURFACE,
      backgroundColor: STAGING_DARK_SURFACE,
      htmlThemeColorLight: STAGING_DARK_SURFACE,
      htmlThemeColorDark: STAGING_DARK_SURFACE,
      appThemeColorLight: STAGING_DARK_SURFACE,
      appThemeColorDark: STAGING_DARK_SURFACE,
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
    // The manifest belongs to the installed app, so its title bar and launch
    // splash take the app's linen ground.
    themeColor: APP_GROUND_LIGHT,
    backgroundColor: APP_GROUND_LIGHT,
    // The status bar tint per presentation and scheme, mirroring the page's
    // canvas (bg-canvas in shared theme.css) so the bar reads as part of the
    // page: white on the website, linen and the warm dark floor in the app.
    htmlThemeColorLight: "#ffffff",
    htmlThemeColorDark: "#0c0a09",
    appThemeColorLight: APP_GROUND_LIGHT,
    appThemeColorDark: APP_GROUND_DARK,
    msTileColor: "#ffffff",
    msTileImage: "images/ms-icon-144x144.png",
    browserIcon: "icon-192.png",
    shortcutIcon: "icon-192.png",
    appleTouchIcons: PRODUCTION_APPLE_TOUCH_ICONS,
    manifestIcons: PRODUCTION_MANIFEST_ICONS,
    includeAssets: PRODUCTION_INCLUDE_ASSETS,
  };
}
