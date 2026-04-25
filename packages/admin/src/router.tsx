import { HydrationFallback, adminRoutes } from "@green-goods/shared";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { adminCanvasRoutes } from "@/routes/views";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

// Login redirect - preserves redirectTo param for bookmarked /login URLs
const LoginRedirect = () => {
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || adminRoutes.hub();
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
        path: "login",
        element: <LoginRedirect />,
      },
      {
        path: "gardens",
        lazy: async () => ({
          Component: (await import("@/routes/PublicGardenRedirect")).default,
        }),
      },
      {
        path: "gardens/:gardenId",
        lazy: async () => ({
          Component: (await import("@/routes/PublicGardenRedirect")).default,
        }),
      },
      {
        path: "gardens/:gardenId/*",
        lazy: async () => ({
          Component: (await import("@/routes/PublicGardenRedirect")).default,
        }),
      },
      {
        // Home — explicit terminal states (spinner / redirect / no-access /
        // connect prompt). Lives outside CanvasShell because none of those
        // states need the hub chrome; IndexRoute provides its own visual shell.
        index: true,
        lazy: async () => ({
          Component: (await import("@/routes/IndexRoute")).default,
        }),
      },
      {
        // CanvasShell renders for all in-app routes — access control happens
        // inside the shell and route guards.
        lazy: async () => ({
          Component: (await import("@/routes/CanvasShell")).default,
        }),
        children: [
          {
            // Pathless error-catching wrapper: child errors render here
            // while CanvasShell and the canvas shell stay visible above.
            errorElement: <RouteErrorBoundary />,
            children: [...adminCanvasRoutes],
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
