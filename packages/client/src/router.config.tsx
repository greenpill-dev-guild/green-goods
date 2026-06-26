import { ensureBaseLists, HydrationFallback } from "@green-goods/shared";
import { type LoaderFunctionArgs, type RouteObject, redirect } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/Errors";
import {
  requirePwaPresentationLoader,
  requireWebsitePresentationLoader,
} from "./routes/presentation-mode";
import { APP_ROUTES, LEGACY_APP_ROUTES } from "./config/pwa-routing";

export const CLIENT_ROUTE_IDS = {
  root: "root",
  publicShell: "public-shell",
  publicHome: "public-home",
  publicLanding: "public-landing",
  publicGardens: "public-gardens",
  publicCookies: "public-cookies",
  publicFund: "public-fund",
  publicVaults: "public-vaults",
  publicImpact: "public-impact",
  publicActions: "public-actions",
  publicGlossary: "public-glossary",
  login: "login",
  home: "home",
  garden: "garden",
  gardenSubmit: "garden-submit",
  profile: "profile",
} as const;

// Prefetch base lists before rendering home (non-blocking).
const homeLoader = (args: LoaderFunctionArgs) => {
  const modeRedirect = requirePwaPresentationLoader(args);
  if (modeRedirect) return modeRedirect;

  ensureBaseLists();
  return null;
};

const legacyPwaRouteLoader =
  (canonicalRoute: string) =>
  (args: LoaderFunctionArgs): Response | null => {
    const modeRedirect = requirePwaPresentationLoader(args);
    if (modeRedirect) return modeRedirect;

    const url = new URL(args.request.url);
    return redirect(`${canonicalRoute}${url.search}${url.hash}`);
  };

export const appRoutes = [
  {
    id: CLIENT_ROUTE_IDS.root,
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: <HydrationFallback appName="Green Goods" />,
    // Catch loader / lazy-chunk / route-render throws here so users never see
    // React Router's default "Unexpected Application Error!" screen with raw
    // "Minified React error #..." text. RouteErrorBoundary auto-reloads on
    // chunk-load failures (the dominant post-SW-update failure mode), surfaces
    // friendly copy for everything else, and reports the exception to PostHog
    // (which Router's default UI does not).
    errorElement: <RouteErrorBoundary />,
    children: [
      // Public routes (no auth required).
      {
        id: CLIENT_ROUTE_IDS.publicShell,
        loader: requireWebsitePresentationLoader,
        lazy: async () => ({ Component: (await import("@/routes/PublicShell")).default }),
        children: [
          {
            id: CLIENT_ROUTE_IDS.publicHome,
            index: true,
            lazy: async () => ({ Component: (await import("@/views/Public/Home")).default }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicLanding,
            path: "landing",
            loader: (args) => requireWebsitePresentationLoader(args) || redirect("/"),
          },
          {
            id: CLIENT_ROUTE_IDS.publicGardens,
            path: "gardens",
            lazy: async () => ({
              Component: (await import("@/views/Public/Gardens")).default,
            }),
            children: [
              {
                path: ":id",
                lazy: async () => ({
                  Component: (await import("@/views/Public/GardenDialog")).default,
                }),
              },
            ],
          },
          {
            id: CLIENT_ROUTE_IDS.publicCookies,
            path: "cookies",
            lazy: async () => ({
              Component: (await import("@/views/Public/Cookies")).default,
            }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicFund,
            path: "fund",
            lazy: async () => ({
              Component: (await import("@/views/Public/Fund")).default,
            }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicVaults,
            path: "vaults",
            lazy: async () => ({
              Component: (await import("@/views/Public/Vaults")).default,
            }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicImpact,
            path: "impact",
            lazy: async () => ({
              Component: (await import("@/views/Public/Impact")).default,
            }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicActions,
            path: "actions",
            lazy: async () => ({
              Component: (await import("@/views/Public/Actions")).default,
            }),
          },
          {
            id: CLIENT_ROUTE_IDS.publicGlossary,
            path: "glossary",
            lazy: async () => ({
              Component: (await import("@/views/Public/Glossary")).default,
            }),
          },
        ],
      },

      // PWA routes. Browser/editorial mode redirects before auth/app shell render.
      {
        loader: requirePwaPresentationLoader,
        lazy: async () => ({ Component: (await import("@/routes/PwaRuntime")).default }),
        children: [
          {
            id: CLIENT_ROUTE_IDS.login,
            path: APP_ROUTES.login.slice(1),
            lazy: async () => ({ Component: (await import("@/views/Login")).Login }),
          },
          {
            path: LEGACY_APP_ROUTES.login.slice(1),
            loader: legacyPwaRouteLoader(APP_ROUTES.login),
          },
          {
            path: `${LEGACY_APP_ROUTES.login.slice(1)}/*`,
            loader: legacyPwaRouteLoader(APP_ROUTES.login),
          },
          {
            path: LEGACY_APP_ROUTES.garden.slice(1),
            loader: legacyPwaRouteLoader(APP_ROUTES.garden),
          },
          {
            path: `${LEGACY_APP_ROUTES.garden.slice(1)}/*`,
            loader: legacyPwaRouteLoader(APP_ROUTES.garden),
          },
          {
            path: LEGACY_APP_ROUTES.profile.slice(1),
            loader: legacyPwaRouteLoader(APP_ROUTES.profile),
          },
          {
            path: `${LEGACY_APP_ROUTES.profile.slice(1)}/*`,
            loader: legacyPwaRouteLoader(APP_ROUTES.profile),
          },

          // Auth-protected routes.
          {
            lazy: async () => ({ Component: (await import("@/routes/RequireAuth")).default }),
            children: [
              {
                lazy: async () => ({ Component: (await import("@/routes/AppShell")).default }),
                children: [
                  {
                    id: CLIENT_ROUTE_IDS.gardenSubmit,
                    path: APP_ROUTES.garden.slice(1),
                    lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                  },
                  {
                    id: CLIENT_ROUTE_IDS.profile,
                    path: APP_ROUTES.profile.slice(1),
                    lazy: async () => ({ Component: (await import("@/views/Profile")).default }),
                  },
                  {
                    id: CLIENT_ROUTE_IDS.home,
                    path: APP_ROUTES.home.slice(1),
                    loader: homeLoader,
                    lazy: async () => ({ Component: (await import("@/views/Home")).default }),
                    children: [
                      {
                        id: CLIENT_ROUTE_IDS.garden,
                        path: ":id",
                        lazy: async () => ({
                          Component: (await import("@/views/Home/Garden")).Garden,
                        }),
                        children: [
                          {
                            path: "work/:workId",
                            lazy: async () => ({
                              Component: (await import("@/views/Home/Garden/Work")).GardenWork,
                            }),
                          },
                          {
                            path: "assessments/:assessmentId",
                            lazy: async () => ({
                              Component: (await import("@/views/Home/Garden/Assessment"))
                                .GardenAssessment,
                            }),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", loader: () => redirect("/") },
    ],
  },
] satisfies RouteObject[];
