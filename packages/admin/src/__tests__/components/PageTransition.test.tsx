/**
 * PageTransition Tests — close-then-navigate sheet orchestration
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test-utils";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mockOrchestrator = vi.hoisted(() => ({
  activeSheet: null as "left" | "right" | null,
  activeContentId: null as string | null,
  isReceded: false,
  openSheet: vi.fn(),
  closeSheet: vi.fn(),
  onNavigateAway: vi.fn().mockResolvedValue(undefined),
  onNavigateArrive: vi.fn().mockReturnValue(null),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useSheetOrchestrator: () => mockOrchestrator,
  };
});

// Stub document.startViewTransition for jsdom
const mockStartViewTransition = vi.fn((callback: () => void) => {
  callback();
  return {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
  };
});

Object.defineProperty(document, "startViewTransition", {
  value: mockStartViewTransition,
  writable: true,
  configurable: true,
});

import { PageTransition } from "@/components/Layout/PageTransition";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function PageA() {
  return <div data-testid="page-a">Page A</div>;
}

function PageB() {
  return <div data-testid="page-b">Page B</div>;
}

function LazyPage() {
  return <div data-testid="lazy-page">Lazy Page</div>;
}

function NavButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid={`nav-${to}`} onClick={() => navigate(to)}>
      Go to {to}
    </button>
  );
}

function renderPageTransition(initialPath = "/page-a", navTargets = ["/page-a", "/page-b"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      {navTargets.map((target) => (
        <NavButton key={target} to={target} />
      ))}
      <Routes>
        <Route element={<PageTransition />}>
          <Route path="/page-a" element={<PageA />} />
          <Route path="/page-b" element={<PageB />} />
          <Route path="/hub/work/:workId" element={<PageB />} />
          <Route path="/hub/history" element={<PageB />} />
          <Route path="/hub/history/:historyEventId" element={<PageB />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function renderLazyPageTransition() {
  let resolveLazyRoute: ((module: { Component: typeof LazyPage }) => void) | undefined;
  const lazyRoute = new Promise<{ Component: typeof LazyPage }>((resolveLazy) => {
    resolveLazyRoute = resolveLazy;
  });
  const router = createMemoryRouter(
    [
      {
        element: <PageTransition />,
        children: [
          {
            path: "/lazy",
            lazy: () => lazyRoute,
          },
        ],
      },
    ],
    { initialEntries: ["/lazy"] }
  );

  renderWithProviders(<RouterProvider router={router} />);

  return {
    resolveLazyRoute: () => {
      if (!resolveLazyRoute) {
        throw new Error("Lazy route resolver was not initialized");
      }
      resolveLazyRoute({ Component: LazyPage });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("PageTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrchestrator.activeSheet = null;
    mockOrchestrator.activeContentId = null;
    mockOrchestrator.isReceded = false;
    mockOrchestrator.onNavigateAway.mockResolvedValue(undefined);
    mockOrchestrator.onNavigateArrive.mockReturnValue(null);
  });

  it("renders the outlet content", () => {
    renderPageTransition();
    expect(screen.getByTestId("page-a")).toBeInTheDocument();
  });

  it("renders lazy route content when the outlet resolves without a pathname change", async () => {
    const { resolveLazyRoute } = renderLazyPageTransition();

    expect(screen.queryByTestId("lazy-page")).not.toBeInTheDocument();

    await act(async () => {
      resolveLazyRoute();
    });

    expect(await screen.findByTestId("lazy-page")).toBeInTheDocument();
    expect(mockStartViewTransition).not.toHaveBeenCalled();
  });

  it("triggers startViewTransition on pathname change when no sheet is open", async () => {
    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockStartViewTransition).toHaveBeenCalled();
    });
    // Should NOT call onNavigateAway when no sheet is open
    expect(mockOrchestrator.onNavigateAway).not.toHaveBeenCalled();
  });

  it("calls onNavigateAway then startViewTransition when a sheet is open", async () => {
    // Sheet is open on initial render
    mockOrchestrator.activeSheet = "right";
    mockOrchestrator.activeContentId = "members";
    mockOrchestrator.isReceded = true;

    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockOrchestrator.onNavigateAway).toHaveBeenCalledWith("/page-a");
    });

    // startViewTransition should fire after onNavigateAway resolves
    await waitFor(() => {
      expect(mockStartViewTransition).toHaveBeenCalled();
    });
  });

  it("calls onNavigateArrive after the view transition completes", async () => {
    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockOrchestrator.onNavigateArrive).toHaveBeenCalledWith("/page-b");
    });
  });

  it("restores sheet state when onNavigateArrive returns saved state", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: "left",
      sheetContentId: "create-action",
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockOrchestrator.openSheet).toHaveBeenCalledWith("left", "create-action");
    });
  });

  it("does not restore sheet when onNavigateArrive returns state with sheetOpen null", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: null,
      sheetContentId: null,
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockOrchestrator.onNavigateArrive).toHaveBeenCalledWith("/page-b");
    });
    expect(mockOrchestrator.openSheet).not.toHaveBeenCalled();
  });

  it("does not restore Hub detail sheets unless the target URL still owns the sheet", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: "left",
      sheetContentId: "hub:work-detail:item-7",
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/page-b"));

    await waitFor(() => {
      expect(mockOrchestrator.onNavigateArrive).toHaveBeenCalledWith("/page-b");
    });
    expect(mockOrchestrator.openSheet).not.toHaveBeenCalled();
  });

  it("restores Hub detail sheets when the target URL still owns the sheet", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: "left",
      sheetContentId: "hub:work-detail:item-7",
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition("/page-a", ["/page-a", "/hub/work/item-7"]);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/hub/work/item-7"));

    await waitFor(() => {
      expect(mockOrchestrator.openSheet).toHaveBeenCalledWith("left", "hub:work-detail:item-7");
    });
  });

  it("restores Hub history sheets when the target URL owns the sheet", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: "left",
      sheetContentId: "hub:history:allocation-1",
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition("/page-a", ["/page-a", "/hub/history/allocation-1"]);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/hub/history/allocation-1"));

    await waitFor(() => {
      expect(mockOrchestrator.openSheet).toHaveBeenCalledWith("left", "hub:history:allocation-1");
    });
  });

  it("does not restore Hub history sheets from legacy item query state", async () => {
    mockOrchestrator.onNavigateArrive.mockReturnValue({
      sheetOpen: "left",
      sheetContentId: "hub:history:allocation-1",
      formState: {},
      scrollPosition: 0,
    });

    renderPageTransition("/page-a", ["/page-a", "/hub/history?item=allocation-1"]);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("nav-/hub/history?item=allocation-1"));

    await waitFor(() => {
      expect(mockOrchestrator.onNavigateArrive).toHaveBeenCalledWith("/hub/history");
    });
    expect(mockOrchestrator.openSheet).not.toHaveBeenCalled();
  });

  it("does not wrap outlet in animate-page-slide-in class", () => {
    renderPageTransition();
    const outlet = screen.getByTestId("page-a");
    // The parent div should NOT have the old slide animation
    expect(outlet.parentElement?.className).not.toContain("animate-page-slide-in");
  });

  it("keeps route transition animation scoped to named content", () => {
    const css = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");

    expect(css).toContain("view-transition-name: none");
    expect(css).toContain("view-transition-name: gg-route-content");
    expect(css).toContain("::view-transition-old(root)");
    expect(css).toContain("opacity: 0 !important");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("::view-transition-new(gg-route-content)");
    expect(css).toContain("--admin-motion-route-content-duration");
    expect(css).toContain("--admin-motion-route-content-easing");
    expect(css).not.toContain("view-transition-name: gg-canvas-bottom");
  });

  it("keeps Hub stage tab pane changes motionless", () => {
    const css = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");

    expect(css).toMatch(
      /\.hub-results-pane\s*{[^}]*animation:\s*none;[^}]*transition:\s*none;[^}]*transform:\s*none;/s
    );
    expect(css).not.toContain("hub-fade-in");
  });

  it("keeps persistent navigation active-state changes motionless", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/admin-m3-overrides.css"), "utf-8");

    expect(css).toMatch(/\.admin-m3 \.canvas-navigation-bar button\s*{[^}]*transition:\s*none;/s);
    expect(css).toMatch(/\.admin-m3 \.canvas-navigation-bar\s*{[^}]*transition:\s*none;/s);
    expect(css).not.toMatch(/\.admin-m3 \.canvas-navigation-bar\s*{[^}]*transition:\s*all/s);
    expect(css).toMatch(
      /\.admin-m3 \.canvas-navigation-bar button > span:first-child\s*{[^}]*transition:\s*none;/s
    );
    expect(css).toMatch(
      /\.admin-m3 \.canvas-navigation-bar button > span:last-child\s*{[^}]*transition:\s*none;/s
    );
  });

  it("does not fire transition when pathname stays the same", async () => {
    renderPageTransition();
    const user = userEvent.setup();

    // Navigate to same path
    await user.click(screen.getByTestId("nav-/page-a"));

    // startViewTransition should not be called for same-path navigation
    expect(mockStartViewTransition).not.toHaveBeenCalled();
  });
});
