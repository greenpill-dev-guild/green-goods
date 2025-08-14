import { createBrowserRouter, redirect } from "react-router-dom";

export const router = createBrowserRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    children: [
      {
        path: "landing",
        lazy: async () => ({ Component: (await import("@/views/Landing")).default }),
      },
      {
        path: "login",
        lazy: async () => ({ Component: (await import("@/views/Login")).default }),
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
                    loader: async (args) => (await import("@/views/Home/loader")).homeLoader(args),
                    children: [
                      {
                        id: "garden",
                        path: ":id",
                        lazy: async () => ({
                          Component: (await import("@/views/Home/Garden")).Garden,
                        }),
                        loader: async (args) =>
                          (await import("@/views/Home/Garden/gardenLoader")).gardenRouteLoader(
                            args
                          ),
                        children: [
                          {
                            path: "work/:workId",
                            lazy: async () => ({
                              Component: (await import("@/views/Home/Garden/Work")).GardenWork,
                            }),
                            loader: async (args) =>
                              (await import("@/views/Home/Garden/loader")).workRouteLoader(args),
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
                    loader: async (args) =>
                      (await import("@/views/Garden/loader")).gardenSubmitLoader(args),
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
      { path: "*", loader: () => redirect("/home") },
    ],
  },
]);
