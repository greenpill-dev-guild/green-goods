/**
 * Shared harness for the commitment-pooling route tests: the admin canvas
 * routes with every lazy view replaced by a leaf that names its path, so a
 * test proves the path is mounted under the right workspace branch without
 * loading the view modules.
 */

import type React from "react";
import {
  createMemoryRouter,
  type IndexRouteObject,
  type NonIndexRouteObject,
  type RouteObject,
  RouterProvider,
} from "react-router-dom";
import { adminCanvasRoutes } from "@/routes/views";
import { renderWithProviders } from "../test-utils";

type TestRouteObject = RouteObject & { children?: TestRouteObject[] };

function createLeafElement(path: string | undefined): React.ReactElement {
  return <div data-testid="route-target">{path ?? "index"}</div>;
}

export function stubLazyRoutes(routes: RouteObject[]): TestRouteObject[] {
  return routes.map((route) => {
    if (route.index) {
      const next: IndexRouteObject = { ...route };
      if (next.lazy) {
        delete next.lazy;
        next.element = createLeafElement("index");
      }
      return next;
    }
    const next: NonIndexRouteObject = {
      ...route,
      children: route.children ? stubLazyRoutes(route.children) : undefined,
    };
    if (next.lazy) {
      delete next.lazy;
      next.element = createLeafElement(next.path);
    }
    return next;
  });
}

export function renderAdminCanvasRoute(initialEntry: string) {
  const router = createMemoryRouter([{ path: "/", children: stubLazyRoutes(adminCanvasRoutes) }], {
    initialEntries: [initialEntry],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

/** Walk the route tree to the object at a slash-separated path of segments. */
export function findRoute(segments: string[]): RouteObject | undefined {
  let current: RouteObject[] = adminCanvasRoutes;
  let found: RouteObject | undefined;
  for (const segment of segments) {
    found = current.find((route) => route.path === segment);
    if (!found) return undefined;
    current = found.children ?? [];
  }
  return found;
}

/** The lazy loader a route (or its index child) resolves through. */
export function lazyOf(route: RouteObject | undefined) {
  if (!route) return undefined;
  if (route.lazy) return route.lazy;
  return route.children?.find((child) => child.index)?.lazy;
}
