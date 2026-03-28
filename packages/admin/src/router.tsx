import { HydrationFallback } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import {
  ActionCreateRedirect,
  ActionDetailRedirect,
  ActionEditRedirect,
  AssessmentsRedirect,
  ContractsRedirect,
  DashboardRedirect,
  DeploymentRedirect,
  EndowmentsRedirect,
  GardenAssessmentsRedirect,
  GardenCreateAssessmentRedirect,
  GardenCreateHypercertRedirect,
  GardenDetailRedirect,
  GardenHypercertDetailRedirect,
  GardenHypercertsRedirect,
  GardensCreateRedirect,
  GardensListRedirect,
  GardenSignalPoolRedirect,
  GardenSignalPoolTypeRedirect,
  GardenStrategiesRedirect,
  GardenSubmitWorkRedirect,
  GardenVaultRedirect,
  GardenWorkDetailRedirect,
} from "@/routes/LegacyRedirects";

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
            // while DashboardShell (sidebar/header) stays visible above
            errorElement: <RouteErrorBoundary />,
            children: [
              // ── Cockpit routes (Phase 1a) ──
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
                  Component: (await import("@/components/guards/RequireSpecificGarden"))
                    .RequireSpecificGarden,
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

              // ── Actions (survives consolidation as top-level route) ──
              {
                path: "actions",
                lazy: async () => ({ Component: (await import("@/views/Actions")).default }),
              },

              // ── Legacy redirect map (Phase 1b) ──────────────────────────
              // Simple redirects
              { path: "dashboard", element: <DashboardRedirect /> },
              { path: "gardens", element: <GardensListRedirect /> },
              { path: "assessments", element: <AssessmentsRedirect /> },
              { path: "endowments", element: <EndowmentsRedirect /> },
              { path: "gardens/create", element: <GardensCreateRedirect /> },

              // Redirects with toast messages
              { path: "contracts", element: <ContractsRedirect /> },
              { path: "deployment", element: <DeploymentRedirect /> },

              // Garden detail param-parsing redirects
              { path: "gardens/:id", element: <GardenDetailRedirect /> },
              { path: "gardens/:id/work/:workId", element: <GardenWorkDetailRedirect /> },
              { path: "gardens/:id/assessments", element: <GardenAssessmentsRedirect /> },
              {
                path: "gardens/:id/assessments/create",
                element: <GardenCreateAssessmentRedirect />,
              },
              { path: "gardens/:id/hypercerts", element: <GardenHypercertsRedirect /> },
              {
                path: "gardens/:id/hypercerts/:hypercertId",
                element: <GardenHypercertDetailRedirect />,
              },
              { path: "gardens/:id/hypercerts/create", element: <GardenCreateHypercertRedirect /> },
              { path: "gardens/:id/vault", element: <GardenVaultRedirect /> },
              { path: "gardens/:id/strategies", element: <GardenStrategiesRedirect /> },
              { path: "gardens/:id/signal-pool", element: <GardenSignalPoolRedirect /> },
              {
                path: "gardens/:id/signal-pool/:poolType",
                element: <GardenSignalPoolTypeRedirect />,
              },
              { path: "gardens/:id/submit-work", element: <GardenSubmitWorkRedirect /> },

              // Action legacy redirects
              { path: "actions/:id", element: <ActionDetailRedirect /> },
              { path: "actions/create", element: <ActionCreateRedirect /> },
              { path: "actions/:id/edit", element: <ActionEditRedirect /> },
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
