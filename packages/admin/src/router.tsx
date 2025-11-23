import { createBrowserRouter, redirect } from "react-router-dom";

const HydrationLoader = () => (
  <div
    className="min-h-screen bg-bg-white flex items-center justify-center"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="text-center">
      {/* Green Goods Icon */}
      <div className="mx-auto h-16 w-16 bg-green-100 rounded-xl flex items-center justify-center mb-4 animate-pulse">
        <svg className="h-10 w-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Spinner */}
      <div className="h-8 w-8 mx-auto border-3 border-green-200 border-t-green-600 rounded-full animate-spin" />

      <span className="sr-only">Loading Green Goods Admin</span>
      <p className="mt-4 text-sm text-text-soft">Loading...</p>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: <HydrationLoader />,
    children: [
      {
        path: "login",
        lazy: async () => ({ Component: (await import("@/views/Login")).default }),
      },
      {
        lazy: async () => ({ Component: (await import("@/routes/RequireAuth")).default }),
        children: [
          {
            lazy: async () => ({
              Component: (await import("@/routes/RequireOperatorOrDeployer")).default,
            }),
            children: [
              {
                lazy: async () => ({
                  Component: (await import("@/routes/DashboardShell")).default,
                }),
                children: [
                  { index: true, loader: () => redirect("/dashboard") },
                  {
                    path: "dashboard",
                    lazy: async () => ({ Component: (await import("@/views/Dashboard")).default }),
                  },
                  {
                    path: "gardens",
                    lazy: async () => ({ Component: (await import("@/views/Gardens")).default }),
                  },
                  {
                    path: "gardens/create",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/CreateGarden")).default,
                    }),
                  },
                  {
                    path: "gardens/:id",
                    lazy: async () => ({
                      Component: (await import("@/views/Gardens/Garden/Detail")).default,
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
                    path: "actions",
                    lazy: async () => ({ Component: (await import("@/views/Actions")).default }),
                  },
                  {
                    path: "actions/create",
                    lazy: async () => ({
                      Component: (await import("@/views/Actions/CreateAction")).default,
                    }),
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
                      Component: (await import("@/views/Actions/EditAction")).default,
                    }),
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
        ],
      },
      { path: "*", loader: () => redirect("/dashboard") },
    ],
  },
]);
