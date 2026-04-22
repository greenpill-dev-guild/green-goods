/**
 * PageTransition Tests — close-then-navigate sheet orchestration
 * @vitest-environment jsdom
 */

import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { act, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@green-goods/shared", () => ({
  useSheetOrchestrator: () => mockOrchestrator,
}));

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
        </Route>
      </Routes>
    </MemoryRouter>
  );
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

  it("does not wrap outlet in animate-page-slide-in class", () => {
    renderPageTransition();
    const outlet = screen.getByTestId("page-a");
    // The parent div should NOT have the old slide animation
    expect(outlet.parentElement?.className).not.toContain("animate-page-slide-in");
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
