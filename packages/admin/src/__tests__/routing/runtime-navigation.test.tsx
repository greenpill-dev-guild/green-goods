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
import { FabProvider, useFabConfigValue } from "@green-goods/shared/components/Canvas/FabContext";
import { NavigationBar } from "@green-goods/shared/components/Canvas/NavigationBar";
import { useViewActions } from "@green-goods/shared/components/Canvas/useViewActions";
import { buildHubViewActions } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { getAdminWorkspaceForPath } from "@green-goods/shared/utils/navigation/admin-routes";
import { adminCanvasRoutes } from "@/routes/views";
import { act, cleanup, renderWithProviders, screen, userEvent, waitFor } from "../test-utils";

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

function createAdminCanvasRouter(initialEntry: string) {
  return createMemoryRouter(
    [
      {
        path: "/",
        children: stubLazyRoutes(adminCanvasRoutes),
      },
    ],
    { initialEntries: [initialEntry] }
  );
}

function renderAdminCanvasRoute(initialEntry: string) {
  const router = createAdminCanvasRouter(initialEntry);

  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

const TestIcon = ({ className }: { className?: string }) => (
  <svg aria-hidden className={className} viewBox="0 0 16 16">
    <path d="M8 2 2 7h2v6h8V7h2L8 2Z" />
  </svg>
);

function HubMobileFabHarness({ navigate }: { navigate: (to: string) => void }) {
  const actions = buildHubViewActions("work", true, true, navigate, {
    gardenId: "0xAAA",
  });
  useViewActions({ actions, isDesktop: false });

  const fab = useFabConfigValue();

  return (
    <NavigationBar
      slots={[
        {
          id: "hub",
          label: "Hub",
          labelId: "cockpit.nav.hub",
          icon: TestIcon,
          path: "/hub",
          visible: true,
        },
        {
          id: "garden",
          label: "Garden",
          labelId: "cockpit.nav.garden",
          icon: TestIcon,
          path: "/garden",
          visible: true,
        },
      ]}
      activePath="/hub"
      onNavigate={vi.fn()}
      fab={fab}
    />
  );
}

describe("admin canvas runtime navigation", () => {
  it("route-gates only team campaign Cookies and Actions branches", () => {
    const topLevelRoutes = new Map(adminCanvasRoutes.map((route) => [route.path, route]));
    const cookiesRoute = topLevelRoutes.get("cookies");
    const actionsRoute = topLevelRoutes.get("actions");

    expect(cookiesRoute?.element).toBeTruthy();
    expect(cookiesRoute?.children?.map((route) => (route.index ? "index" : route.path))).toEqual([
      "index",
      "deploy",
    ]);
    expect(actionsRoute?.element).toBeTruthy();
    expect(actionsRoute?.children?.map((route) => (route.index ? "index" : route.path))).toEqual([
      "index",
      "create",
      ":id",
      ":id/edit",
    ]);
    expect(topLevelRoutes.has("actions/create")).toBe(false);
    expect(topLevelRoutes.get("community")?.element).toBeUndefined();
  });

  it("redirects /hub to canonical work mode while preserving shareable context", async () => {
    const router = renderAdminCanvasRoute("/hub?view=history&gardenAddress=0xAAA&sort=oldest");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/hub/work");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&sort=oldest");
  });

  it("redirects /garden to health and drops retired view query state", async () => {
    const router = renderAdminCanvasRoute(
      "/garden?view=impact&gardenAddress=0xAAA&range=30d&section=activity"
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/garden/health");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&range=30d&section=activity");
  });

  it("redirects /community to members and drops retired card/pool query state", async () => {
    const router = renderAdminCanvasRoute(
      "/community?gardenAddress=0xAAA&card=vault&pool=hypercert&item=deposit-1"
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/community/members");
    });

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&item=deposit-1");
  });

  it("serves Manage Members from the Community workspace and redirects the legacy garden path", async () => {
    // Canonical route renders in place — no redirect, workspace stays Community.
    const canonical = renderAdminCanvasRoute("/community/members?gardenId=0xAAA");
    await waitFor(() => {
      expect(canonical.state.location.pathname).toBe("/community/members");
    });
    expect(canonical.state.location.search).toBe("?gardenId=0xAAA");
    expect(getAdminWorkspaceForPath(canonical.state.location.pathname)).toBe("community");

    // Legacy /garden/members deep links land on the canonical community route
    // with their garden context intact (membership is community-owned — the
    // NavigationBar tab must not flip to Garden).
    const legacy = renderAdminCanvasRoute("/garden/members?gardenId=0xAAA");
    await waitFor(() => {
      expect(legacy.state.location.pathname).toBe("/community/members");
    });
    expect(legacy.state.location.search).toBe("?gardenId=0xAAA");
    expect(getAdminWorkspaceForPath(legacy.state.location.pathname)).toBe("community");
  });

  it("mounts Hub create-flow routes from the shared action targets", async () => {
    const cases = [
      {
        id: "submit-work",
        expectedPath: "/hub/work/submit",
        expectedLeaf: "work/submit",
      },
      {
        id: "create-assessment",
        expectedPath: "/hub/assess/create",
        expectedLeaf: "assess/create",
      },
      {
        id: "create-hypercert",
        expectedPath: "/hub/certify/create",
        expectedLeaf: "certify/create",
      },
    ];

    for (const { id, expectedPath, expectedLeaf } of cases) {
      const router = renderAdminCanvasRoute("/hub/work?gardenId=0xAAA");
      const actions = buildHubViewActions("work", true, true, router.navigate, {
        gardenId: "0xAAA",
      });

      await act(async () => {
        actions.find((action) => action.id === id)?.onClick();
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(expectedPath);
      });
      expect(router.state.location.search).toBe("?gardenId=0xAAA");
      expect(screen.getByTestId("route-target")).toHaveTextContent(expectedLeaf);
      expect(getAdminWorkspaceForPath(router.state.location.pathname)).toBe("hub");
      cleanup();
    }
  });

  it("routes Hub mobile FAB speed-dial actions to mounted create-flow routes", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const cases = [
      {
        label: "Submit Work",
        expectedPath: "/hub/work/submit",
        expectedLeaf: "work/submit",
      },
      {
        label: "Create Assessment",
        expectedPath: "/hub/assess/create",
        expectedLeaf: "assess/create",
      },
      {
        label: "Create Hypercert",
        expectedPath: "/hub/certify/create",
        expectedLeaf: "certify/create",
      },
    ];

    for (const { label, expectedPath, expectedLeaf } of cases) {
      const user = userEvent.setup();
      const router = createAdminCanvasRouter("/hub/work?gardenId=0xAAA");

      renderWithProviders(
        <FabProvider>
          <HubMobileFabHarness navigate={(to) => void router.navigate(to)} />
          <RouterProvider router={router} />
        </FabProvider>
      );

      await user.click(await screen.findByRole("button", { name: "Open Actions" }));
      await user.click(await screen.findByRole("menuitem", { name: label }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(expectedPath);
      });
      expect(router.state.location.search).toBe("?gardenId=0xAAA");
      expect(screen.getByTestId("route-target")).toHaveTextContent(expectedLeaf);
      expect(getAdminWorkspaceForPath(router.state.location.pathname)).toBe("hub");
      cleanup();
    }
  });

  it("keeps endowment deposit and withdraw flows under the Community workspace", async () => {
    for (const path of [
      "/community/endowment/vault/deposit?gardenId=0xAAA&item=0xBBB",
      "/community/endowment/vault/withdraw?gardenId=0xAAA&item=0xBBB",
      "/community/resources/vault/deposit?gardenId=0xAAA&item=0xBBB",
      "/community/resources/vault/withdraw?gardenId=0xAAA&item=0xBBB",
      "/community/treasury/vault/deposit?gardenId=0xAAA&item=0xBBB",
      "/community/treasury/vault/withdraw?gardenId=0xAAA&item=0xBBB",
    ]) {
      const router = renderAdminCanvasRoute(path);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path.split("?")[0]);
      });

      expect(router.state.location.search).toBe("?gardenId=0xAAA&item=0xBBB");
      expect(getAdminWorkspaceForPath(router.state.location.pathname)).toBe("community");
    }
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
