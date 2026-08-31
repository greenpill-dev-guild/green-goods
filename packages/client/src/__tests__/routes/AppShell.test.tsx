/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";

vi.mock("@green-goods/shared/providers/JobQueue", () => ({
  JobQueueProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@green-goods/shared/providers/Work", () => ({
  WorkProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/Communication/Offline/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}));

vi.mock("@/components/Communication/PwaBadgeCoordinator", () => ({
  PwaBadgeCoordinator: () => null,
}));

vi.mock("@/components/Layout/AppBar", () => ({
  AppBar: () => null,
}));

vi.mock("@/routes/ENSClaimReminder", () => ({
  ENSClaimReminder: () => null,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, ScrollRestoration: () => null };
});

import AppShell from "../../routes/AppShell";

function HomeRoute() {
  return <Link to="/home/garden-1/work/work-1">Open work</Link>;
}

function GardenRoute() {
  return <Link to="/home">Finish submission</Link>;
}

function WorkDetailRoute() {
  return <Link to="/home">Back home</Link>;
}

describe("AppShell", () => {
  beforeEach(() => {
    useUIStore.getState().closeWorkDashboard();
    document.documentElement.classList.remove("modal-open");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(function scrollTo(this: HTMLElement) {
        this.scrollTop = 0;
      }),
    });
  });

  afterEach(() => {
    useUIStore.getState().closeWorkDashboard();
    document.documentElement.classList.remove("modal-open");
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
    fireEvent.click(screen.getByRole("link", { name: "Finish submission" }));

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
