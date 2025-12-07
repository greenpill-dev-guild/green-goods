import { HydrationFallback } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, redirect } from "react-router-dom";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    id: "root",
    lazy: async () => ({ Component: (await import("@/routes/Root")).default }),
    hydrateFallbackElement: <HydrationFallback appName="Green Goods" />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("@/routes/PlatformRouter")).default }),
      },
      {
        path: "landing",
        lazy: async () => ({ Component: (await import("@/views/Landing")).default }),
      },
      {
        path: "login",
        lazy: async () => ({ Component: (await import("@/views/Login")).default }),
        // children: [
        //   {
        //     path: "recover",
        //     lazy: async () => ({ Component: (await import("@/views/Login/Recovery")).default }),
        //   },
        // ],
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
      { path: "*", loader: () => redirect("/") },
    ],
  },
]);
