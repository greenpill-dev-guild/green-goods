/**
 * @vitest-environment happy-dom
 */

import { GOVERNANCE_ENABLED } from "@green-goods/shared/config/app";
import { createMemoryRouter, RouterProvider, matchRoutes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FabProvider, useFabConfigValue } from "@green-goods/shared/components/Canvas/FabContext";
import { NavigationBar } from "@green-goods/shared/components/Canvas/NavigationBar";
import { useViewActions } from "@green-goods/shared/components/Canvas/useViewActions";
import { buildHubViewActions } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { getAdminWorkspaceForPath } from "@green-goods/shared/utils/navigation/admin-routes";
import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import { getCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { adminCanvasRoutes } from "@/routes/views";
import { act, cleanup, renderWithProviders, screen, userEvent, waitFor } from "../test-utils";

vi.mock("@/routes/RequireRole", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    default: () => <Outlet />,
  };
});

const mockCommunityPermission = vi.hoisted(() => ({ allowed: true }));
vi.mock("@green-goods/shared/hooks/roles/useEffectiveToolbarPermissions", () => ({
  useEffectiveToolbarPermissions: () => ({
    showCommunity: mockCommunityPermission.allowed,
    isLoading: false,
  }),
}));

// Keep the production lazy loaders: distinct module markers detect a route importing the wrong view.
vi.mock("@/views/Hub", () => ({ default: () => <div data-testid="route-target">Hub</div> }));
vi.mock("@/views/Garden", () => ({ default: () => <div data-testid="route-target">Garden</div> }));
vi.mock("@/views/Community", () => ({
  default: () => <div data-testid="route-target">Community</div>,
}));
vi.mock("@/views/Actions", () => ({
  default: () => <div data-testid="route-target">Actions</div>,
}));
vi.mock("@/views/Profile", () => ({
  default: () => <div data-testid="route-target">Profile</div>,
}));
vi.mock("@/views/Hub/CreateAssessment", () => ({
  default: () => <div data-testid="route-target">Create Assessment</div>,
}));
vi.mock("@/views/Hub/CreateHypercert", () => ({
  default: () => <div data-testid="route-target">Create Hypercert</div>,
}));
vi.mock("@/views/Garden/SubmitWork", () => ({
  default: () => <div data-testid="route-target">Submit Work</div>,
}));

const routers = new Set<ReturnType<typeof createMemoryRouter>>();
function createAdminCanvasRouter(initialEntry: string) {
  const router = createMemoryRouter([{ path: "/", children: adminCanvasRoutes }], {
    initialEntries: [initialEntry],
  });
  routers.add(router);
  return router;
}

async function renderAdminCanvasRoute(initialEntry: string) {
  const router = createAdminCanvasRouter(initialEntry);
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByTestId("route-target");
  expect(router.state.errors).toBeNull();
  return router;
}

const hubCreateActions = [
  ["submit-work", "Submit Work", "/hub/work/submit"],
  ["create-assessment", "Create Assessment", "/hub/assess/create"],
  ["create-hypercert", "Create Hypercert", "/hub/certify/create"],
] as const;

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
  beforeEach(() => {
    mockCommunityPermission.allowed = true;
  });

  afterEach(() => {
    cleanup();
    for (const router of routers) router.dispose();
    routers.clear();
  });

  it("route-gates Community along with team campaign Cookies and Actions branches", () => {
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
    expect(topLevelRoutes.get("community")?.element).toBeTruthy();
  });

  it.each([
    "/community",
    "/community/members",
    "/community/endowment/vault/deposit?gardenId=0xAAA&item=0xBBB",
    "/garden/members?gardenId=0xAAA",
  ])("redirects an evaluator away from %s to Hub", async (entry) => {
    mockCommunityPermission.allowed = false;
    const router = await renderAdminCanvasRoute(entry);

    expect(router.state.location.pathname).toBe("/hub/work");
    expect(screen.getByTestId("route-target")).toHaveTextContent("Hub");
  });

  it.each([
    ["/cookies", "campaigns"],
    ["/cookies/deploy", "create-campaign-jar"],
  ])("sends %s to the protocol garden's campaign cookie jars on Payouts", async (entry, item) => {
    const rootGarden = getNetworkConfig(getCurrentChain()).rootGarden?.address;
    const router = await renderAdminCanvasRoute(entry);

    expect(router.state.location.pathname).toBe("/community/payouts");
    const search = new URLSearchParams(router.state.location.search);
    expect(search.get("gardenId")?.toLowerCase()).toBe(rootGarden?.toLowerCase());
    expect(search.get("item")).toBe(item);
  });

  it("redirects /hub to canonical work mode while preserving shareable context", async () => {
    const router = await renderAdminCanvasRoute(
      "/hub?view=history&gardenAddress=0xAAA&sort=oldest"
    );

    expect(router.state.location.pathname).toBe("/hub/work");

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&sort=oldest");
  });

  it("redirects /garden to health and drops retired view query state", async () => {
    const router = await renderAdminCanvasRoute(
      "/garden?view=impact&gardenAddress=0xAAA&range=30d&section=activity"
    );

    expect(router.state.location.pathname).toBe("/garden/health");

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&range=30d&section=activity");
  });

  it("redirects /community to members and drops retired card/pool query state", async () => {
    const router = await renderAdminCanvasRoute(
      "/community?gardenAddress=0xAAA&card=vault&pool=hypercert&item=deposit-1"
    );

    expect(router.state.location.pathname).toBe("/community/members");

    expect(router.state.location.search).toBe("?gardenAddress=0xAAA&item=deposit-1");
  });

  it("serves Manage Members from the Community workspace and redirects the legacy garden path", async () => {
    // Canonical route renders in place — no redirect, workspace stays Community.
    const canonical = await renderAdminCanvasRoute("/community/members?gardenId=0xAAA");
    await waitFor(() => {
      expect(canonical.state.location.pathname).toBe("/community/members");
    });
    expect(canonical.state.location.search).toBe("?gardenId=0xAAA");
    expect(getAdminWorkspaceForPath(canonical.state.location.pathname)).toBe("community");

    // Legacy /garden/members deep links land on the canonical community route
    // with their garden context intact (membership is community-owned — the
    // NavigationBar tab must not flip to Garden).
    cleanup();
    const legacy = await renderAdminCanvasRoute("/garden/members?gardenId=0xAAA");
    await waitFor(() => {
      expect(legacy.state.location.pathname).toBe("/community/members");
    });
    expect(legacy.state.location.search).toBe("?gardenId=0xAAA");
    expect(getAdminWorkspaceForPath(legacy.state.location.pathname)).toBe("community");
  });

  it("opens Edit Garden over Health from its old address, keeping the URL's context", async () => {
    const router = await renderAdminCanvasRoute("/garden/settings?gardenId=0xAAA&range=90d");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/garden/health");
    });
    expect(router.state.location.search).toBe("?gardenId=0xAAA&range=90d&item=edit-garden");
    expect(screen.getByTestId("route-target")).toHaveTextContent("Garden");
  });

  it("mounts Hub create-flow routes from the shared action targets", async () => {
    for (const [id, label, expectedPath] of hubCreateActions) {
      const router = await renderAdminCanvasRoute("/hub/work?gardenId=0xAAA");
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
      expect(screen.getByTestId("route-target")).toHaveTextContent(label);
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

    for (const [, label, expectedPath] of hubCreateActions) {
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
      expect(screen.getByTestId("route-target")).toHaveTextContent(label);
      expect(getAdminWorkspaceForPath(router.state.location.pathname)).toBe("hub");
      cleanup();
    }
  });

  it.each([
    "/community/endowment/vault",
    "/community/endowment/vault/deposit",
    "/community/endowment/vault/withdraw",
    "/community/resources/vault",
    "/community/resources/vault/deposit",
    "/community/resources/vault/withdraw",
    "/community/treasury/vault",
    "/community/treasury/vault/deposit",
    "/community/treasury/vault/withdraw",
  ])("keeps %s under the Community workspace with garden context", async (path) => {
    const router = await renderAdminCanvasRoute(`${path}?gardenId=0xAAA&item=0xBBB`);
    expect(router.state.location.pathname).toBe(path);
    expect(router.state.location.search).toBe("?gardenId=0xAAA&item=0xBBB");
    expect(screen.getByTestId("route-target")).toHaveTextContent("Community");
    expect(getAdminWorkspaceForPath(router.state.location.pathname)).toBe("community");
  });

  it("keeps /actions as the canonical action registry with shareable filters", async () => {
    const router = await renderAdminCanvasRoute(
      "/actions?sort=recent&domain=1&search=solar&lifecycle=active"
    );

    expect(router.state.location.pathname).toBe("/actions");

    expect(router.state.location.search).toBe(
      "?sort=recent&domain=1&search=solar&lifecycle=active"
    );
  });

  it.each([
    "create",
    "action%3A0xabc%2F1",
    "action%3A0xabc%2F1/edit",
  ])("keeps /actions/%s under Actions with shareable filters", async (child) => {
    const router = await renderAdminCanvasRoute(`/actions/${child}?sort=recent&search=solar`);
    expect(router.state.location.pathname).toBe(`/actions/${child}`);
    expect(router.state.location.search).toBe("?sort=recent&search=solar");
    expect(screen.getByTestId("route-target")).toHaveTextContent("Actions");
  });

  it.each([
    ["/hub/work/work-7", "/hub/work/work-7", "Hub", { workId: "work-7" }],
    ["/hub/confirm", "/hub/confirm", "Hub", {}],
    ["/hub/confirm/9", "/hub/confirm/9", "Hub", { commitmentId: "9" }],
    ["/garden/pool", "/garden/pool", "Garden", {}],
    ["/garden/pool/seed", "/garden/pool/seed", "Garden", {}],
    ["/garden/pool/9", "/garden/pool/9", "Garden", { commitmentId: "9" }],
    ["/community/pools", "/community/coordination", "Community", {}],
    ["/hub/assess", "/hub/assess", "Hub", {}],
    [
      "/hub/assess/assessment-7",
      "/hub/assess/assessment-7",
      "Hub",
      { assessmentId: "assessment-7" },
    ],
    ["/hub/certify", "/hub/certify", "Hub", {}],
    [
      "/hub/certify/assessment-7",
      "/hub/assess/assessment-7",
      "Hub",
      { assessmentId: "assessment-7" },
    ],
    ["/hub/history", "/hub/work", "Hub", {}],
    ["/hub/history/event-7", "/hub/work", "Hub", {}],
    [
      "/garden/impact/hypercerts/cert-7",
      "/garden/impact/hypercerts/cert-7",
      "Garden",
      { hypercertId: "cert-7" },
    ],
    ["/profile", "/profile", "Profile", {}],
    ...[
      "coordination/strategies",
      "coordination/signal-pool/0",
      "governance",
      "governance/strategies",
      "governance/signal-pool/action",
      "coordination/signal-pool/hypercert",
      "governance/signal-pool/0",
    ].map(
      (path) =>
        [
          `/community/${path}`,
          GOVERNANCE_ENABLED ? `/community/${path}` : "/community/coordination",
          "Community",
          GOVERNANCE_ENABLED && path.includes("signal-pool")
            ? { poolType: path.split("/").at(-1) }
            : {},
        ] as const
    ),
  ] as const)("resolves %s to its owning view and preserves context", async (entry, pathname, view, params) => {
    const router = await renderAdminCanvasRoute(`${entry}?gardenId=0xAAA&sort=oldest`);
    expect(router.state.location.pathname).toBe(pathname);
    expect(router.state.location.search).toBe("?gardenId=0xAAA&sort=oldest");
    expect(router.state.matches.at(-1)?.params).toEqual(params);
    expect(screen.getByTestId("route-target")).toHaveTextContent(view);
  });

  it.each([
    "/assessments",
    "/endowments",
    "/gardens",
  ])("does not mount the retired %s route family", (path) => {
    expect(matchRoutes(adminCanvasRoutes, path)).toBeNull();
  });
});
