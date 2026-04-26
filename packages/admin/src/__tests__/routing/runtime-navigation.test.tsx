/**
 * @vitest-environment jsdom
 */

import type React from "react";
import {
  createMemoryRouter,
  RouterProvider,
  type IndexRouteObject,
  type NonIndexRouteObject,
  type RouteObject,
} from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { adminCanvasRoutes } from "@/routes/views";
import { renderWithProviders, waitFor } from "../test-utils";

vi.mock("@/routes/RequireRole", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    default: () => <Outlet />,
  };
});

type TestRouteObject = RouteObject & {
  children?: TestRouteObject[];
};

function createLeafElement(path: string | undefined): React.ReactElement {
  return <div data-testid="route-target">{path ?? "index"}</div>;
}

function stubLazyRoutes(routes: RouteObject[]): TestRouteObject[] {
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

function renderAdminCanvasRoute(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        children: stubLazyRoutes(adminCanvasRoutes),
      },
    ],
    { initialEntries: [initialEntry] }
  );

  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe("admin canvas runtime navigation", () => {
  it("redirects /hub to canonical work mode while preserving shareable context", async () => {
    const router = renderAdminCanvasRoute("/hub?view=history&gardenAddress=0xAAA&sort=oldest");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/hub/work");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&sort=oldest");
  });

  it("redirects /garden to overview and drops retired view query state", async () => {
    const router = renderAdminCanvasRoute(
      "/garden?view=impact&gardenAddress=0xAAA&range=30d&section=activity"
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/garden/overview");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&range=30d&section=activity");
  });

  it("redirects /community to treasury and drops retired card/pool query state", async () => {
    const router = renderAdminCanvasRoute(
      "/community?gardenAddress=0xAAA&card=vault&pool=hypercert&item=deposit-1"
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/community/treasury");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&item=deposit-1");
  });

  it("keeps /actions as the canonical action registry with shareable filters", async () => {
    const router = renderAdminCanvasRoute(
      "/actions?sort=recent&domain=1&search=solar&lifecycle=active"
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/actions");
    });

    expect(router.state.location.search).toBe(
      "?sort=recent&domain=1&search=solar&lifecycle=active"
    );
  });

  it("keeps Actions child routes under the Actions workspace family", async () => {
    const actionId = "action%3A0xabc%2F1";

    for (const path of [
      `/actions/create?sort=recent&search=solar`,
      `/actions/${actionId}?sort=recent&search=solar`,
      `/actions/${actionId}/edit?sort=recent&search=solar`,
    ]) {
      const router = renderAdminCanvasRoute(path);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path.split("?")[0]);
      });

      expect(router.state.location.search).toBe("?sort=recent&search=solar");
    }
  });
});
