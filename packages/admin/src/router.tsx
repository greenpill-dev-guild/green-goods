import { HydrationFallback, SkeletonGrid, adminRoutes } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import RequireRole from "@/routes/RequireRole";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

function preserveSearch(search: string, omitKeys: string[] = []): string {
  if (!search) return "";

  const params = new URLSearchParams(search);
  for (const key of omitKeys) {
    params.delete(key);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

function RoleGateSkeleton() {
  return (
    <div className="p-6 space-y-6" data-testid="content-skeleton">
      <div className="h-9 w-48 rounded-md skeleton-shimmer" />
      <SkeletonGrid count={4} columns={2} />
    </div>
  );
}

// Login redirect - preserves redirectTo param for bookmarked /login URLs
const LoginRedirect = () => {
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || adminRoutes.hub();
  return <Navigate to={redirectTo} replace />;
};

const HubIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate to={`${adminRoutes.hubWork()}${preserveSearch(location.search, ["view"])}`} replace />
  );
};

const GardenIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate
      to={`${adminRoutes.gardenOverview()}${preserveSearch(location.search, ["view"])}`}
      replace
    />
  );
};

const CommunityIndexRedirect = () => {
  const location = useLocation();
  return (
    <Navigate
      to={`${adminRoutes.communityTreasury()}${preserveSearch(location.search, ["card", "pool"])}`}
      replace
    />
  );
};

export const router = createRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: (
      <HydrationFallback appName="Green Goods Admin" showIcon message="Loading..." />
    ),
    children: [
      {
        path: "login",
        element: <LoginRedirect />,
      },
      {
        // Home — explicit terminal states (spinner / redirect / no-access /
        // connect prompt). Lives outside CanvasShell because none of those
        // states need the hub chrome; IndexRoute provides its own visual shell.
        index: true,
        lazy: async () => ({
          Component: (await import("@/routes/IndexRoute")).default,
        }),
      },
      {
        // CanvasShell renders for all in-app routes — access control happens
        // inside the shell and route guards.
        lazy: async () => ({
          Component: (await import("@/routes/CanvasShell")).default,
        }),
        children: [
          {
            // Pathless error-catching wrapper: child errors render here
            // while CanvasShell and the canvas shell stay visible above.
            errorElement: <RouteErrorBoundary />,
            children: [
              // ── Canvas primary routes ──
              {
                path: "hub",
                children: [
                  {
                    index: true,
                    element: <HubIndexRedirect />,
                  },
                  {
                    path: "work",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                      {
                        path: ":workId",
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                      {
                        path: "submit",
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                    ],
                  },
                  {
                    path: "assess",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                      {
                        path: "create",
                        lazy: async () => ({
                          Component: (await import("@/views/Garden/CreateAssessment")).default,
                        }),
                      },
                    ],
                  },
                  {
                    path: "certify",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                      {
                        path: ":assessmentId",
                        lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                      },
                      {
                        path: "create",
                        lazy: async () => ({
                          Component: (await import("@/views/Garden/CreateHypercert")).default,
                        }),
                      },
                    ],
                  },
                  {
                    path: "history",
                    lazy: async () => ({ Component: (await import("@/views/Hub")).default }),
                  },
                ],
              },
              {
                path: "garden",
                children: [
                  {
                    index: true,
                    element: <GardenIndexRedirect />,
                  },
                  {
                    path: "overview",
                    lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                  },
                  {
                    path: "impact",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                      },
                      {
                        path: "hypercerts/:hypercertId",
                        lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                      },
                    ],
                  },
                  {
                    path: "settings",
                    lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                  },
                  {
                    path: "create",
                    element: (
                      <RequireRole
                        allowedRoles={["deployer"]}
                        loadingFallback={<RoleGateSkeleton />}
                      />
                    ),
                    children: [
                      {
                        index: true,
                        lazy: async () => ({
                          Component: (await import("@/views/Garden/CreateGarden")).default,
                        }),
                      },
                    ],
                  },
                ],
              },
              {
                path: "community",
                children: [
                  {
                    index: true,
                    element: <CommunityIndexRedirect />,
                  },
                  {
                    path: "treasury",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({
                          Component: (await import("@/views/Community")).default,
                        }),
                      },
                      {
                        path: "vault",
                        lazy: async () => ({
                          Component: (await import("@/views/Community")).default,
                        }),
                      },
                    ],
                  },
                  {
                    path: "governance",
                    children: [
                      {
                        index: true,
                        lazy: async () => ({
                          Component: (await import("@/views/Community")).default,
                        }),
                      },
                      {
                        path: "strategies",
                        lazy: async () => ({
                          Component: (await import("@/views/Community")).default,
                        }),
                      },
                      {
                        path: "signal-pool/:poolType",
                        lazy: async () => ({
                          Component: (await import("@/views/Community")).default,
                        }),
                      },
                    ],
                  },
                  {
                    path: "payouts",
                    lazy: async () => ({
                      Component: (await import("@/views/Community")).default,
                    }),
                  },
                  {
                    path: "members",
                    lazy: async () => ({
                      Component: (await import("@/views/Community")).default,
                    }),
                  },
                ],
              },

              // ── Actions canvas surface + secondary flows ──
              {
                path: "actions",
                lazy: async () => ({ Component: (await import("@/views/Actions")).default }),
              },
              {
                path: "profile",
                lazy: async () => ({ Component: (await import("@/views/Profile")).default }),
              },
              {
                path: "actions/create",
                element: (
                  <RequireRole
                    allowedRoles={["deployer", "operator"]}
                    loadingFallback={<RoleGateSkeleton />}
                  />
                ),
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import("@/views/Actions/CreateAction")).default,
                    }),
                  },
                ],
              },
              {
                path: "actions/:id",
                lazy: async () => ({
                  Component: (await import("@/views/Actions/ActionDetail")).default,
                }),
              },
              {
                path: "actions/:id/edit",
                element: (
                  <RequireRole
                    allowedRoles={["deployer", "operator"]}
                    loadingFallback={<RoleGateSkeleton />}
                  />
                ),
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import("@/views/Actions/EditAction")).default,
                    }),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: "*",
        lazy: async () => ({ Component: (await import("@/views/NotFound")).default }),
      },
    ],
  },
]);
