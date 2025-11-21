import { createBrowserRouter, redirect } from "react-router-dom";

const HydrationLoader = () => (
  <div
    className="min-h-screen flex items-center justify-center bg-white"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="flex flex-col items-center gap-3">
      {/* Minimal spinner */}
      <div className="h-10 w-10 animate-spin rounded-full border-3 border-green-200 border-t-green-600" />
      <span className="sr-only">Loading Green Goods</span>
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
        index: true,
        lazy: async () => ({ Component: (await import("@/views/Landing")).default }),
      },
      {
        path: "landing",
        lazy: async () => ({ Component: (await import("@/views/Landing")).default }),
      },
      {
        path: "login",
        lazy: async () => ({ Component: (await import("@/views/Login")).default }),
        children: [
          {
            path: "recover",
            lazy: async () => ({ Component: (await import("@/views/Login/Recovery")).default }),
          },
        ],
      },
      {
        lazy: async () => ({ Component: (await import("@/routes/RequireInstalled")).default }),
        children: [
          {
            lazy: async () => ({ Component: (await import("@/routes/RequireAuth")).default }),
            children: [
              {
                lazy: async () => ({ Component: (await import("@/routes/AppShell")).default }),
                children: [
                  { index: true, loader: () => redirect("/home") },
                  {
                    id: "home",
                    path: "home",
                    lazy: async () => ({ Component: (await import("@/views/Home")).default }),
                    children: [
                      {
                        id: "garden",
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
                    id: "garden-submit",
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
      { path: "*", loader: () => redirect("/landing") },
    ],
  },
]);
