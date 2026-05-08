import type { RouteObject } from "react-router-dom";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { useMemo } from "react";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";

export const ADMIN_ROUTE_STORY_QUERY_OPTIONS = { timeout: 5000 } as const;

function StorybookCanvasHydrateFallback() {
  return (
    <div
      aria-label="Loading workspace"
      className="flex h-full min-h-[320px] items-center justify-center p-6"
      data-testid="storybook-canvas-hydrate-fallback"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stroke-sub border-t-primary-base" />
    </div>
  );
}

function withHydrateFallback(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => ({
    ...route,
    HydrateFallback: route.HydrateFallback ?? StorybookCanvasHydrateFallback,
    children: route.children ? withHydrateFallback(route.children) : undefined,
  }));
}

export function createStorybookAdminCanvasRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        element: <CanvasLayout />,
        HydrateFallback: StorybookCanvasHydrateFallback,
        children: withHydrateFallback(adminCanvasRoutes),
      },
    ],
    { initialEntries: [initialPath] }
  );
}

export function StorybookAdminCanvasRoute({ initialPath }: { initialPath: string }) {
  const router = useMemo(() => createStorybookAdminCanvasRouter(initialPath), [initialPath]);
  return <RouterProvider router={router} />;
}
