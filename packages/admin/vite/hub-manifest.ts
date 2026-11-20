import designTokens from "@green-goods/shared/styles/design-md.generated.json";

/**
 * The installed Hub per environment (PRD-1517). Each environment brands its install apart from
 * the others and from the App: the icon's ground colour names the environment (white, beta's dark
 * green, alpha's violet), a "HUB" band along its bottom names the Hub, and its own manifest id lets
 * all three install side by side.
 */
export type HubFlavor = "production" | "beta" | "alpha";

interface HubManifestIcon {
  src: string;
  sizes: string;
  type: "image/png";
  purpose: "any" | "maskable";
}

interface HubWebManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  icons: HubManifestIcon[];
}

export interface HubInstallBranding {
  flavor: HubFlavor;
  manifest: HubWebManifest;
  /** The 180 px full-bleed icon iOS puts on the home screen. */
  appleTouchIcon: string;
  /** The tab icon. */
  browserIcon: string;
}

/** The Vercel branch that serves alpha.hub.greengoods.app; its builds always carry the alpha branding. */
const ALPHA_BRANCH = "alpha";
const DESCRIPTION =
  "A workspace for garden stewards to coordinate promises, review documented work, and manage garden access.";
// Every Hub opens on the linen splash chosen for the first Hub install (PRD-1533); the icon on it
// carries the environment's ground colour.
const LINEN = designTokens.colors.neutral;

const FLAVORS: Record<
  HubFlavor,
  { id: string; name: string; shortName: string; iconPrefix: string; apple: string }
> = {
  // The id is what a phone keys an installed app on: production keeps the one it shipped with,
  // so Hubs already installed update in place.
  production: {
    id: "./",
    name: "Green Goods Hub",
    shortName: "GG Hub",
    iconPrefix: "hub",
    apple: "apple-touch-icon.png",
  },
  beta: {
    id: "./?gg_hub=beta",
    name: "Green Goods Hub Beta",
    shortName: "Hub Beta",
    iconPrefix: "hub-beta",
    apple: "hub-beta-apple-touch-icon.png",
  },
  alpha: {
    id: "./?gg_hub=alpha",
    name: "Green Goods Hub Alpha",
    shortName: "Hub Alpha",
    iconPrefix: "hub-alpha",
    apple: "hub-alpha-apple-touch-icon.png",
  },
};

function normalizeFlavor(value: string | undefined): HubFlavor | undefined {
  const flavor = value?.trim().toLowerCase();
  if (!flavor) return undefined;
  if (["staging", "stage", "stg", "qa", "beta"].includes(flavor)) return "beta";
  if (["production", "prod"].includes(flavor)) return "production";
  if (flavor === "alpha") return "alpha";
  return undefined;
}

// Deployment signals choose only between beta and production: alpha comes from an explicit
// flavor or the alpha branch, so an `alpha` here falls through to the next signal.
function normalizeDeploymentFlavor(value: string | undefined): HubFlavor | undefined {
  const flavor = normalizeFlavor(value);
  return flavor === "alpha" ? undefined : flavor;
}

/**
 * Which Hub a build brands, decided as the App decides its own (`resolvePwaManifestFlavor` in
 * packages/client/src/config/pwaManifest.ts): an explicit flavor, then the alpha branch, then the
 * deployment target. Beta is develop's `staging` Vercel environment; anything else is production.
 */
export function resolveHubFlavor(env: Record<string, string | undefined>): HubFlavor {
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

  return deploymentFlavor === "beta" ? "beta" : "production";
}

export function createHubInstallBranding(flavor: HubFlavor): HubInstallBranding {
  const { id, name, shortName, iconPrefix, apple } = FLAVORS[flavor];
  return {
    flavor,
    manifest: {
      id,
      name,
      short_name: shortName,
      description: DESCRIPTION,
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: LINEN,
      theme_color: LINEN,
      icons: [
        { src: `${iconPrefix}-icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${iconPrefix}-icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        {
          src: `${iconPrefix}-maskable-icon-512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    appleTouchIcon: apple,
    browserIcon: `${iconPrefix}-icon-192.png`,
  };
}
