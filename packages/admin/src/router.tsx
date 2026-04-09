import { HydrationFallback } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

// Root redirect component - cockpit default is /work
const RootRedirect = () => <Navigate to="/work" replace />;

// Login redirect - preserves redirectTo param for bookmarked /login URLs
const LoginRedirect = () => {
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/work";
  return <Navigate to={redirectTo} replace />;
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
          {
            // Pathless error-catching wrapper: child errors render here
            // while DashboardShell and the cockpit shell stay visible above
            errorElement: <RouteErrorBoundary />,
            children: [
              // ── Cockpit primary routes ──
              {
                path: "work",
                lazy: async () => ({ Component: (await import("@/views/Work")).default }),
              },
              {
                path: "garden",
                lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
              },
              {
                path: "community",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireSpecificGarden")).RequireSpecificGarden,
                }),
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import("@/views/Community")).default,
                    }),
                  },
                ],
              },

              // ── Actions cockpit surface + secondary flows ──
              {
                path: "actions",
                lazy: async () => ({ Component: (await import("@/views/Actions")).default }),
              },
              {
                path: "actions/create",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireDeployer")).default,
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
                path: "actions/:id",
                lazy: async () => ({
                  Component: (await import("@/views/Actions/ActionDetail")).default,
                }),
              },
              {
                path: "actions/:id/edit",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireDeployer")).default,
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

              // ── Garden secondary routes ──
              {
                path: "gardens/create",
                lazy: async () => ({
                  Component: (await import("@/routes/RequireDeployer")).default,
                }),
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/CreateGarden")).default,
                    }),
                  },
                ],
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
                path: "gardens/:id/assessments/create",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/CreateAssessment")).default,
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
                path: "gardens/:id/hypercerts/create",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/CreateHypercert")).default,
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
                element: <Navigate to="../signal-pool/hypercert" replace relative="path" />,
              },
              {
                path: "gardens/:id/signal-pool/:poolType",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/SignalPool")).default,
                }),
              },
              {
                path: "gardens/:id/submit-work",
                lazy: async () => ({
                  Component: (await import("@/views/Gardens/Garden/SubmitWork")).default,
                }),
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
