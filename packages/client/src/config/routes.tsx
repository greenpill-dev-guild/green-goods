import { type LoaderFunctionArgs, type RouteObject, redirect } from "react-router-dom";
import type { RecoveryView } from "@/components/Errors/ErrorRecovery";
import { RouteErrorBoundary } from "@/components/Errors/RouteErrorBoundary";
import { APP_ROUTES, LEGACY_APP_ROUTES } from "./pwaRouting";
import { getSharedRecordPath, takePendingSharedLink } from "./sharedLink";
import {
  requirePwaPresentationLoader,
  requireWebsitePresentationLoader,
} from "@/routes/presentationMode";
import { PresentationHydrationFallback } from "@/routes/PresentationHydrationFallback";

export const CLIENT_ROUTE_IDS = {
  root: "root",
  pwaRuntime: "pwa-runtime",
  sessionGate: "session-gate",
  appShell: "app-shell",
  publicShell: "public-shell",
  publicHome: "public-home",
  publicLanding: "public-landing",
  publicGardens: "public-gardens",
  publicGardenDetail: "public-garden-detail",
  publicCookies: "public-cookies",
  publicFund: "public-fund",
  publicVaults: "public-vaults",
  publicImpact: "public-impact",
  publicActions: "public-actions",
  publicGlossary: "public-glossary",
  publicReporting: "public-reporting",
  publicReportingRecovery: "public-reporting-recovery",
  publicReportingPermissions: "public-reporting-permissions",
  login: "login",
  home: "home",
  garden: "garden",
  gardenSubmit: "garden-submit",
  profile: "profile",
} as const;

// Prefetch base lists before rendering home (non-blocking).
const homeLoader = async (args: LoaderFunctionArgs) => {
  const modeRedirect = requirePwaPresentationLoader(args);
  if (modeRedirect) return modeRedirect;

  // An explicit app destination wins over an earlier install handoff.
  const pending = takePendingSharedLink();
  if (pending && new URL(args.request.url).pathname.replace(/\/$/, "") === APP_ROUTES.home) {
    return redirect(pending);
  }

  const { ensureBaseLists } = await import("@green-goods/shared/hooks/blockchain/prefetch");
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

/**
 * A route with no path, no code and no element of its own: it only carries the error state for
 * the routes inside it. A failed loader, a failed `lazy` import or a render error in any of them
 * replaces what is inside, and the layout routes above (the site's header, the app's bottom bar)
 * stay on screen. A failure in a layout route itself reaches the root's error state.
 *
 * The state cannot sit on the page's own route: React Router does not render a route whose
 * `lazy` import failed, its `errorElement` included, so the page would be blank.
 */
function errorFrame(view: RecoveryView, children: RouteObject[]): RouteObject {
  return { errorElement: <RouteErrorBoundary view={view} />, children };
}

const combinedAppRoutes = [
  {
    id: CLIENT_ROUTE_IDS.root,
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: <PresentationHydrationFallback />,
    // A failure in a layout route (the root, a shell, the session gate) leaves no frame to keep.
    // Which screen that is, the website's or the app's, comes from the entry's recovery views.
    errorElement: <RouteErrorBoundary view="frame" />,
    children: [
      // Public routes (no auth required).
      {
        id: CLIENT_ROUTE_IDS.publicShell,
        loader: requireWebsitePresentationLoader,
        lazy: async () => ({ Component: (await import("@/routes/PublicShell")).default }),
        children: [
          errorFrame("page", [
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
            // Sibling of the archive, not a child: the Garden page is an ordinary
            // editorial page with its own footer, not a modal over the grid.
            {
              id: CLIENT_ROUTE_IDS.publicGardenDetail,
              path: "gardens/:id",
              lazy: async () => ({
                Component: (await import("@/views/Public/GardenDetail")).default,
              }),
            },
            {
              path: "gardens/:id/work/:workId",
              lazy: async () => ({
                Component: (await import("@/views/Public/WorkDetail")).default,
              }),
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
          ]),
          // The reporting ceremony pages use the focused shell and are drawn as the app draws.
          errorFrame("ceremony", [
            // Static before dynamic: the permissions page must never be read as a locator.
            {
              id: CLIENT_ROUTE_IDS.publicReportingPermissions,
              path: "agent/reporting/permissions",
              lazy: async () => ({
                Component: (await import("@/views/Public/AgentReporting/PermissionsPage")).default,
              }),
            },
            {
              id: CLIENT_ROUTE_IDS.publicReportingRecovery,
              path: "agent/reporting/recover/:requestId",
              lazy: async () => ({
                Component: (await import("@/views/Public/AgentReporting")).ReportingRecoveryPage,
              }),
            },
            {
              id: CLIENT_ROUTE_IDS.publicReporting,
              path: "agent/reporting/:requestId",
              lazy: async () => ({
                Component: (await import("@/views/Public/AgentReporting")).ReportingCeremonyPage,
              }),
            },
          ]),
        ],
      },

      // PWA routes. Browser/editorial mode redirects before auth/app shell render.
      {
        id: CLIENT_ROUTE_IDS.pwaRuntime,
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
            id: CLIENT_ROUTE_IDS.sessionGate,
            lazy: async () => ({ Component: (await import("@/routes/SessionGate")).default }),
            children: [
              {
                id: CLIENT_ROUTE_IDS.appShell,
                lazy: async () => ({ Component: (await import("@/routes/AppShell")).default }),
                children: [
                  errorFrame("screen", [
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
                              // Declared before the dynamic sibling so "new" is a
                              // destination rather than a commitment id.
                              path: "commitments/new",
                              lazy: async () => ({
                                Component: (await import("@/views/Home/Garden/Compose"))
                                  .ComposeCommitment,
                              }),
                            },
                            {
                              // A group of promises, by its display-group id; static
                              // beside the dynamic sibling, so "group" is never an id.
                              path: "commitments/group/:groupId",
                              lazy: async () => ({
                                Component: (await import("@/views/Home/Garden/PromiseGroup"))
                                  .GardenPromiseGroup,
                              }),
                            },
                            {
                              path: "commitments/:commitmentId",
                              lazy: async () => ({
                                Component: (await import("@/views/Home/Garden/Commitment"))
                                  .GardenCommitment,
                              }),
                            },
                            {
                              path: "commitments/:commitmentId/proof",
                              lazy: async () => ({
                                Component: (await import("@/views/Home/Garden/Proof"))
                                  .ProofComposer,
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
                  ]),
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

const combinedRoot = combinedAppRoutes[0] as RouteObject;
const publicShell = combinedRoot.children?.find(
  (route) => route.id === CLIENT_ROUTE_IDS.publicShell
);
const pwaRuntime = combinedRoot.children?.find((route) => route.id === CLIENT_ROUTE_IDS.pwaRuntime);

if (!publicShell || !pwaRuntime) {
  throw new Error("Client route trees are missing their presentation roots");
}

export const publicAppRoutes: RouteObject[] = [
  {
    ...combinedRoot,
    children: [
      publicShell,
      {
        path: "*",
        loader: ({ request }) => {
          const url = new URL(request.url);
          return redirect(getSharedRecordPath(url.pathname, "gardens") ?? "/");
        },
      },
    ],
  } as RouteObject,
];

export const pwaAppRoutes: RouteObject[] = [
  {
    ...combinedRoot,
    children: [
      { index: true, loader: legacyPwaRouteLoader(APP_ROUTES.home) },
      pwaRuntime,
      { path: "*", loader: () => redirect(APP_ROUTES.home) },
    ],
  } as RouteObject,
];

/** Combined route inventory retained for route-contract tests and Storybook. */
export const appRoutes = combinedAppRoutes;
