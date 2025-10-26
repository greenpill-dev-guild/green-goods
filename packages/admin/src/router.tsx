import { createBrowserRouter, redirect } from "react-router-dom";

export const router = createBrowserRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
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
