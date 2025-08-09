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
                    path: "home",
                    lazy: async () => ({ Component: (await import("@/views/Home")).default }),
                    loader: async (args) => (await import("@/views/Home/loader")).homeLoader(args),
                    children: [
                      {
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
      { path: "*", loader: () => redirect("/home") },
    ],
  },
]);
