import { ensureBaseLists, HydrationFallback } from "@green-goods/shared";
import { type LoaderFunctionArgs, type RouteObject, redirect } from "react-router-dom";
import {
  requirePwaPresentationLoader,
  requireWebsitePresentationLoader,
} from "./routes/presentation-mode";

export const CLIENT_ROUTE_IDS = {
  root: "root",
  publicShell: "public-shell",
  publicHome: "public-home",
  publicLanding: "public-landing",
  publicGardens: "public-gardens",
  publicFund: "public-fund",
  publicImpact: "public-impact",
  publicActions: "public-actions",
  home: "home",
  garden: "garden",
  gardenSubmit: "garden-submit",
} as const;

// Prefetch base lists before rendering home (non-blocking).
const homeLoader = (args: LoaderFunctionArgs) => {
  const modeRedirect = requirePwaPresentationLoader(args);
  if (modeRedirect) return modeRedirect;

  ensureBaseLists();
  return null;
};

export const appRoutes = [
  {
    id: CLIENT_ROUTE_IDS.root,
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: <HydrationFallback appName="Green Goods" />,
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
          },
          {
            path: "gardens/:id",
            lazy: async () => ({
              Component: (await import("@/views/Public/GardenDetail")).default,
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
        ],
      },

      // PWA routes. Browser/editorial mode redirects before auth/app shell render.
      {
        loader: requirePwaPresentationLoader,
        lazy: async () => ({ Component: (await import("@/routes/PwaRuntime")).default }),
        children: [
          {
            path: "login",
            lazy: async () => ({ Component: (await import("@/views/Login")).Login }),
          },

          // Auth-protected routes.
          {
            lazy: async () => ({ Component: (await import("@/routes/RequireAuth")).default }),
            children: [
              {
                lazy: async () => ({ Component: (await import("@/routes/AppShell")).default }),
                children: [
                  {
                    id: CLIENT_ROUTE_IDS.home,
                    path: "home",
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
                  {
                    id: CLIENT_ROUTE_IDS.gardenSubmit,
                    path: "garden",
                    lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                  },
                  {
                    path: "profile",
                    lazy: async () => ({ Component: (await import("@/views/Profile")).default }),
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
