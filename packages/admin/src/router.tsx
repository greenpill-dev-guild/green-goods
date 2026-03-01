import { HydrationFallback } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

// Root redirect component - prevents "empty page" warning
const RootRedirect = () => <Navigate to="/dashboard" replace />;

// Login redirect - preserves redirectTo param for bookmarked /login URLs
const LoginRedirect = () => {
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/dashboard";
  return <Navigate to={redirectTo} replace />;
};

export const router = createRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: (
      <HydrationFallback appName="Green Goods Admin" showIcon message="Loading..." />
    ),
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: "login",
        element: <LoginRedirect />,
      },
      {
        // DashboardShell renders for ALL routes — no auth wrapper
        lazy: async () => ({
          Component: (await import("@/routes/DashboardShell")).default,
        }),
        children: [
          // ── Public read-only routes ──
          {
            path: "dashboard",
            lazy: async () => ({ Component: (await import("@/views/Dashboard")).default }),
          },
          {
            path: "gardens",
            lazy: async () => ({ Component: (await import("@/views/Gardens")).default }),
          },
          {
            path: "gardens/:id",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/Detail")).default,
            }),
          },
          {
            path: "gardens/:id/work/:workId",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/WorkDetail")).default,
            }),
          },
          {
            path: "gardens/:id/assessments",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/Assessment")).default,
            }),
          },
          {
            path: "gardens/:id/hypercerts",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/Hypercerts")).default,
            }),
          },
          {
            path: "gardens/:id/hypercerts/:hypercertId",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/HypercertDetail")).default,
            }),
          },
          {
            path: "gardens/:id/vault",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/Vault")).default,
            }),
          },
          {
            path: "gardens/:id/strategies",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/Strategies")).default,
            }),
          },
          {
            path: "gardens/:id/signal-pool",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/SignalPool")).default,
            }),
          },
          {
            path: "gardens/:id/signal-pool/:poolType",
            lazy: async () => ({
              Component: (await import("@/views/Gardens/Garden/SignalPool")).default,
            }),
          },
          {
            path: "endowments",
            lazy: async () => ({ Component: (await import("@/views/Treasury")).default }),
          },
          {
            path: "actions",
            lazy: async () => ({ Component: (await import("@/views/Actions")).default }),
          },
          {
            path: "actions/:id",
            lazy: async () => ({
              Component: (await import("@/views/Actions/ActionDetail")).default,
            }),
          },

          // ── Auth-gated write routes ──
          {
            lazy: async () => ({ Component: (await import("@/routes/RequireAuth")).default }),
            children: [
              {
                path: "gardens/create",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/CreateGarden")).default,
                }),
              },
              {
                path: "gardens/:id/assessments/create",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/CreateAssessment")).default,
                }),
              },
              {
                path: "gardens/:id/hypercerts/create",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/CreateHypercert")).default,
                }),
              },
              {
                path: "actions/create",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireActionManager")).default,
                }),
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
                path: "actions/:id/edit",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireActionManager")).default,
                }),
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import("@/views/Actions/EditAction")).default,
                    }),
                  },
                ],
              },
              {
                lazy: async () => ({
                  Component: (await import("@/routes/RequireDeployer")).default,
                }),
                children: [
                  {
                    path: "contracts",
                    lazy: async () => ({
                      Component: (await import("@/views/Contracts")).default,
                    }),
                  },
                  {
                    path: "deployment",
                    lazy: async () => ({
                      Component: (await import("@/views/Deployment")).default,
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
