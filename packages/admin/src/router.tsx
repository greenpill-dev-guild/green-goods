import { HydrationFallback } from "@green-goods/shared";
import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
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

const LegacyHubRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/work${location.search}`} replace />;
};

const LegacyHubWorkDetailRedirect = () => {
  const location = useLocation();
  const { workId } = useParams<{ workId: string }>();
  return <Navigate to={`/work/${encodeURIComponent(workId ?? "")}${location.search}`} replace />;
};

const LegacyHubWorkSubmitRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/work/submit${location.search}`} replace />;
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
                path: "hub",
                element: <LegacyHubRedirect />,
              },
              {
                path: "hub/work/submit",
                element: <LegacyHubWorkSubmitRedirect />,
              },
              {
                path: "hub/work/:workId",
                element: <LegacyHubWorkDetailRedirect />,
              },
              {
                path: "work",
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await import("@/views/Work")).default }),
                  },
                  {
                    path: ":workId",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/WorkDetail")).default,
                    }),
                  },
                  {
                    path: "submit",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/SubmitWork")).default,
                    }),
                  },
                ],
              },
              {
                path: "garden",
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await import("@/views/Garden")).default }),
                  },
                  {
                    path: "create",
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
                    path: "assessments/create",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/CreateAssessment")).default,
                    }),
                  },
                  {
                    path: "hypercerts/create",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/CreateHypercert")).default,
                    }),
                  },
                  {
                    path: "hypercerts/:hypercertId",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/HypercertDetail")).default,
                    }),
                  },
                ],
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
                  {
                    path: "vault",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/Vault")).default,
                    }),
                  },
                  {
                    path: "strategies",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/Strategies")).default,
                    }),
                  },
                  {
                    path: "signal-pool/:poolType",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/SignalPool")).default,
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
                path: "profile",
                lazy: async () => ({ Component: (await import("@/views/Profile")).default }),
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
                path: "actions/:id",
                lazy: async () => ({
                  Component: (await import("@/views/Actions/ActionDetail")).default,
                }),
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
