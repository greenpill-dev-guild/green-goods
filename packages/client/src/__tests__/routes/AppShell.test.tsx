/** @vitest-environment happy-dom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";

vi.mock("@green-goods/shared/hooks/offline/useOfflineContent", () => ({
  useOfflineContentPreparation: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  configureConnectivityProbe: () => () => {},
}));

const { ADDRESS, identity } = vi.hoisted(() => ({
  ADDRESS: "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01",
  identity: { address: "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01" },
}));
vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => identity.address,
}));

vi.mock("@green-goods/shared/providers/JobQueue", () => ({
  JobQueueProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@green-goods/shared/providers/Work", () => ({
  WorkProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/Communication/Offline/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}));

vi.mock("@/components/Communication/Offline/InstallNudge", () => ({
  InstallNudge: () => null,
}));

vi.mock("@/components/Communication/PwaBadgeCoordinator", () => ({
  PwaBadgeCoordinator: () => null,
}));

// The shell aligns a phone wallet's network through wagmi; this shell has no wallet.
vi.mock("@green-goods/shared/hooks/blockchain/useWalletNetworkAlignment", () => ({
  useWalletNetworkAlignment: () => undefined,
}));

vi.mock("@/components/Layout/AppBar", () => ({
  AppBar: () => <nav data-testid="authenticated-nav" />,
}));

vi.mock("@/routes/ENSClaimReminder", () => ({
  ENSClaimReminder: () => null,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, ScrollRestoration: () => null };
});

import AppShell from "../../routes/AppShell";
import { hasArrivalPassed } from "../../views/Home/arrivalToast";

function HomeRoute() {
  return <Link to="/home/garden-1/work/work-1">Open work</Link>;
}

function GardenRoute() {
  const dashboard = useDashboardNavigation();
  return <button onClick={() => dashboard.openWork()}>Finish submission</button>;
}

function WorkDetailRoute() {
  return <Link to="/home">Back home</Link>;
}

const workSnapshot = {
  kind: "work" as const,
  tab: "completed" as const,
  pendingFilter: "needsReview" as const,
  completedFilter: "reviewedByYou" as const,
  timeFilter: "week" as const,
  scrollTop: 288,
};
function DashboardHomeRoute() {
  const dashboard = useDashboardNavigation();
  return (
    <>
      <button onClick={() => dashboard.leave(workSnapshot, "/home/garden-1/work/work-1")}>
        Inspect work
      </button>
      <button
        onClick={() =>
          dashboard.leave(
            { kind: "commitments", tab: "to-confirm", direction: "REQUEST", scrollTop: 144 },
            "/home/garden-1/work/work-1"
          )
        }
      >
        Inspect promise
      </button>
      <button
        onClick={() => {
          dashboard.clear();
          useUIStore.getState().closeWorkDashboard();
        }}
      >
        Close dashboard
      </button>
      <Link to="/home/profile">Profile</Link>
    </>
  );
}
function DashboardDetailRoute() {
  const dashboard = useDashboardNavigation();
  const navigate = useNavigate();
  return (
    <>
      <p>Inspected item</p>
      <button
        onClick={() => {
          if (!dashboard.back()) navigate("/home");
        }}
      >
        On-screen Back
      </button>
      <button onClick={() => dashboard.forward("/home/garden-1/work/work-1/proof")}>
        Open nested proof
      </button>
      <button onClick={() => dashboard.returnTo("/home/garden-1/work/work-1")}>Finish proof</button>
      <Link to="/home">Unrelated Home</Link>
    </>
  );
}
function DeviceHistory() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>Device Back</button>
      <button onClick={() => navigate(1)}>Device Forward</button>
    </>
  );
}
function DashboardJourney() {
  return (
    <MemoryRouter initialEntries={["/home"]}>
      <DeviceHistory />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="home" element={<DashboardHomeRoute />} />
          <Route path="home/profile" element={<Link to="/home">Unrelated Home</Link>} />
          <Route path="home/garden-1/work/work-1" element={<DashboardDetailRoute />} />
          <Route path="home/garden-1/work/work-1/proof" element={<DashboardDetailRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    useUIStore.getState().resetForAccountChange();
    identity.address = ADDRESS;
    document.documentElement.classList.remove("modal-open");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(function scrollTo(this: HTMLElement) {
        this.scrollTop = 0;
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUIStore.getState().closeWorkDashboard();
    document.documentElement.classList.remove("modal-open");
    sessionStorage.clear();
  });

  it.each([
    "On-screen Back",
    "Device Back",
  ])("restores the source dashboard through %s", (action) => {
    render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(useUIStore.getState()).toMatchObject({
      isWorkDashboardOpen: true,
      workDashboardInitialTab: "completed",
      workDashboardInitialPendingFilter: "needsReview",
      workDashboardReturnState: workSnapshot,
    });
  });

  it("keeps Forward and Back on the same source entry", () => {
    render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    fireEvent.click(screen.getByRole("button", { name: "On-screen Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Device Forward" }));
    expect(screen.getByText("Inspected item")).toBeInTheDocument();
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Device Back" }));
    expect(useUIStore.getState().workDashboardReturnState).toEqual(workSnapshot);
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(true);
  });

  it.each([
    "On-screen Back",
    "Device Back",
    "Finish proof",
  ])("preserves the commitments origin across a nested return via %s", (action) => {
    render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect promise" }));
    fireEvent.click(screen.getByRole("button", { name: "Open nested proof" }));
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "On-screen Back" }));
    expect(useUIStore.getState()).toMatchObject({
      isWorkDashboardOpen: false,
      isCommitmentsSheetOpen: true,
      commitmentsSheetReturnState: { tab: "to-confirm", direction: "REQUEST", scrollTop: 144 },
    });
  });

  it("does not reopen a dismissed dashboard when returning from another route", () => {
    render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    fireEvent.click(screen.getByRole("button", { name: "Device Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Close dashboard" }));
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Device Back" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
    // A new icon-open starts clean; its next departure establishes a new return snapshot.
    act(() => useUIStore.getState().openWorkDashboard());
    expect(useUIStore.getState().workDashboardReturnState).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    fireEvent.click(screen.getByRole("button", { name: "On-screen Back" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(true);
  });

  it("opens an unrelated Home visit without the previous dashboard", () => {
    render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    fireEvent.click(screen.getByRole("link", { name: "Unrelated Home" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
  });

  it("invalidates old history after an account switch, even when that account returns", () => {
    const view = render(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect work" }));
    identity.address = "0x2222222222222222222222222222222222222222";
    act(() => useUIStore.getState().resetForAccountChange());
    view.rerender(<DashboardJourney />);
    fireEvent.click(screen.getByRole("button", { name: "Device Back" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
    identity.address = ADDRESS;
    act(() => useUIStore.getState().resetForAccountChange());
    view.rerender(<DashboardJourney />);
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
  });

  it.each([
    ["/home", false],
    ["/home/", false],
    ["/home/garden", true],
    ["/home/profile", true],
    ["/home/garden-1/work/work-1", true],
  ])("leaves the Home arrival toast open only for a session on Home (%s)", (path, passed) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<div>Screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(hasArrivalPassed(ADDRESS)).toBe(passed);
  });

  it("scrolls content inside #app-scroll so the app bar stays outside any overscroll stretch", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="home" element={<HomeRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const main = screen.getByRole("main");
    const appScroll = document.getElementById("app-scroll");
    if (!appScroll) throw new Error("App scroll container is missing");

    // A viewport-height shell keeps the document unscrollable: Android Chrome
    // then has no document overscroll to stretch, and pulls from the top still
    // chain to it for native refresh.
    expect(main).toHaveClass("h-dvh", "overflow-clip");
    // Positioned, so main's clip also contains absolutely positioned content
    // such as screen-reader status regions; unpositioned, they escape and make
    // the document scrollable again.
    expect(main).toHaveClass("relative");
    expect(appScroll).toHaveClass("overflow-y-auto");
    // Contained overscroll would stop the pull from reaching the document.
    expect(appScroll.className).not.toMatch(/overscroll-(?:y-)?(?:contain|none)/);
    expect(main).toContainElement(appScroll);
    expect(appScroll).not.toContainElement(screen.getByTestId("authenticated-nav"));
  });

  it("clears stale dashboard state and document locks on route changes", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="home" element={<HomeRoute />} />
            <Route path="home/:gardenId/work/:workId" element={<div>Work detail</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const appScroll = document.getElementById("app-scroll");
    expect(appScroll).toBeInTheDocument();
    if (!appScroll) throw new Error("App scroll container is missing");
    appScroll.scrollTop = 720;

    act(() => useUIStore.getState().openWorkDashboard());
    document.documentElement.classList.add("modal-open");

    fireEvent.click(screen.getByRole("link", { name: "Open work" }));

    expect(screen.getByText("Work detail")).toBeInTheDocument();
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
    expect(document.documentElement).not.toHaveClass("modal-open");
    expect(appScroll.scrollTop).toBe(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("preserves an intentionally opened dashboard when submission returns home", () => {
    render(
      <MemoryRouter initialEntries={["/home/garden"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="home/garden" element={<GardenRoute />} />
            <Route path="home" element={<HomeRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    act(() => useUIStore.getState().openWorkDashboard());
    fireEvent.click(screen.getByRole("button", { name: "Finish submission" }));

    expect(screen.getByRole("link", { name: "Open work" })).toBeInTheDocument();
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(true);
  });

  it("clears stale dashboard state when work detail returns home", () => {
    render(
      <MemoryRouter initialEntries={["/home/garden-1/work/work-1"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="home" element={<HomeRoute />} />
            <Route path="home/:gardenId/work/:workId" element={<WorkDetailRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    act(() => useUIStore.getState().openWorkDashboard());
    fireEvent.click(screen.getByRole("link", { name: "Back home" }));

    expect(screen.getByRole("link", { name: "Open work" })).toBeInTheDocument();
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
  });
});
